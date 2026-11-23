const { createHash } = require('node:crypto')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

module.exports = function setBackgroundBuildUuid ({ appOutDir, electronPlatformName, packager }) {
  const appId = packager.config.appId
  if (electronPlatformName !== 'darwin' || appId !== 'org.electerm.electerm.background') {
    throw new Error('The Background build UUID hook requires the macOS Background app.')
  }

  const product = packager.appInfo.productFilename
  const executable = join(appOutDir, product + '.app', 'Contents', 'MacOS', product)
  const binary = readFileSync(executable)
  // This build only ships thin arm64 Mach-O executables.
  if (binary.readUInt32LE(0) !== 0xfeedfacf || binary.readUInt32LE(4) !== 0x0100000c) {
    throw new Error('Expected a thin arm64 Mach-O executable.')
  }

  const headerSize = 32
  const commandCount = binary.readUInt32LE(16)
  const end = headerSize + binary.readUInt32LE(20)
  if (end > binary.length) throw new Error('Invalid Mach-O load commands.')

  let offset = headerSize
  for (let i = 0; i < commandCount; i++) {
    if (offset + 8 > end) break
    const command = binary.readUInt32LE(offset)
    const size = binary.readUInt32LE(offset + 4)
    if (size < 8 || offset + size > end) break
    if (command === 0x1b && size === 24) {
      const original = binary.subarray(offset + 8, offset + size)
      // macOS can confuse unrelated apps using the same Electron build UUID.
      // Namespace the upstream UUID by bundle ID before the app is signed.
      const uuid = createHash('sha256').update(appId).update(original).digest().subarray(0, 16)
      uuid[6] = (uuid[6] & 0x0f) | 0x80
      uuid[8] = (uuid[8] & 0x3f) | 0x80
      uuid.copy(original)
      writeFileSync(executable, binary)
      return
    }
    offset += size
  }
  throw new Error('No valid LC_UUID found in the Background executable.')
}
