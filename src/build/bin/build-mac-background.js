/**
 * Package a local Apple Silicon preview after compile and prepare-file.
 * It uses a distinct bundle ID, data directory and MCP default port.
 */
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const config = require('../electron-builder.json')

const appDir = 'work/app'
const output = 'dist/background'
const productName = 'Electerm Background'

if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('Run this build on an Apple Silicon Mac.')
}
if (!fs.existsSync(path.join(appDir, 'assets/index.html'))) {
  throw new Error('Run npm run compile and npm run prepare-file first.')
}

const pack = require('../../../work/app/package.json')
fs.writeFileSync(path.join(appDir, 'background-entry.js'), `const { app } = require('electron')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')

const profile = join(app.getPath('appData'), '${productName}')
const appData = join(profile, 'data')
const userData = join(profile, 'electron')
const logs = join(profile, 'logs')
for (const dir of [appData, userData, logs]) mkdirSync(dir, { recursive: true })
app.setName('electerm-background')
app.setPath('appData', appData)
app.setPath('userData', userData)
app.setAppLogsPath(logs)
process.env.DATA_PATH = appData

require('./app')
`)

const settingsPath = path.join(appDir, 'common/default-setting.js')
const settings = fs.readFileSync(settingsPath, 'utf8')
fs.writeFileSync(settingsPath, settings.replace('checkUpdateOnStart: true', 'checkUpdateOnStart: false'))
const widgetPath = path.join(appDir, 'widgets/widget-mcp-server.js')
const widget = fs.readFileSync(widgetPath, 'utf8')
fs.writeFileSync(widgetPath, widget.replace("name: 'port',\n      type: 'number',\n      default: 30837,", "name: 'port',\n      type: 'number',\n      default: 30838,"))

const run = (file, args) => execFileSync(file, args, { stdio: 'inherit' })
const configPath = path.join(output, 'electron-builder.background.json')
const entitlements = path.join(output, 'entitlements.background.plist')
fs.mkdirSync(output, { recursive: true })
// Local ad-hoc signatures have no Team ID for hardened runtime library checks.
fs.copyFileSync(config.mac.entitlements, entitlements)
run('/usr/libexec/PlistBuddy', ['-c', 'Add :com.apple.security.cs.disable-library-validation bool true', entitlements])
fs.writeFileSync(configPath, JSON.stringify({
  ...config,
  appId: 'org.electerm.electerm.background',
  productName,
  directories: { ...config.directories, output },
  protocols: [],
  fileAssociations: [],
  publish: null,
  extraMetadata: { name: 'electerm-background', main: 'background-entry.js' },
  mac: {
    ...config.mac,
    publish: null,
    identity: '-',
    notarize: false,
    entitlements,
    entitlementsInherit: entitlements
  }
}, null, 2))

run('node_modules/.bin/electron-builder', ['--config', configPath, '--mac', 'dir', '--arm64', '--publish', 'never'])
const bundle = path.join(output, 'mac-arm64', productName + '.app')
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle])
run('/usr/bin/ditto', [
  '-c', '-k', '--keepParent', bundle,
  path.join(output, `electerm-${pack.version}-background-mac-arm64.zip`)
])
