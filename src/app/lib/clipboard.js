const { app, clipboard } = require('electron')

// Background receives clipboard events from unattended remote sessions.
// Keep their contents in this process and never persist them to disk.
let privateText = ''

function usesPrivateClipboard () {
  return app?.getName?.() === 'electerm-background'
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
