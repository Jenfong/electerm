const { clipboard } = require('electron')
const globalState = require('./glob-state')

// In private mode, remote clipboard events and app clipboard actions
// share only this process-local text buffer.
let privateText = ''

function usesPrivateClipboard () {
  return globalState.get('privateClipboard') === true
}

function readText () {
  return usesPrivateClipboard() ? privateText : clipboard.readText()
}

function writeText (text) {
  if (usesPrivateClipboard()) {
    if (typeof text === 'string') privateText = text
    return
  }
  clipboard.writeText(text)
}

module.exports = { usesPrivateClipboard, readText, writeText }
