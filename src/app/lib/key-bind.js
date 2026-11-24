/**
 * disable some default keyboard shortcuts
 */

const { clipboard } = require('electron')
const { isMac } = require('../common/runtime-constants')
const { usesPrivateClipboard } = require('./clipboard')

const rdpPasteTargets = new WeakMap()

exports.setRdpPasteTarget = (contents, tabId, active) => {
  if (!usesPrivateClipboard() || typeof tabId !== 'string' || !tabId) return
  if (active === true) {
    rdpPasteTargets.set(contents, { tabId })
  } else if (rdpPasteTargets.get(contents)?.tabId === tabId) {
    rdpPasteTargets.delete(contents)
  }
}

exports.disableShortCuts = function (win) {
  const { webContents } = win
  webContents.on('before-input-event', (event, input) => {
    const target = rdpPasteTargets.get(webContents)
    if (isMac && target && win.isFocused() && input.code === 'KeyV' &&
      input.meta && !input.control && !input.alt && !input.shift && !input.isComposing) {
      event.preventDefault()
      if (input.type !== 'keyDown' || input.isAutoRepeat) return
      try {
        // Only this explicit macOS paste gesture reads the system clipboard.
        const text = clipboard.readText()
        if (text) {
          webContents.send('rdp-system-paste', { tabId: target.tabId, text })
        }
      } catch (e) {
        console.warn('Could not read text for the RDP paste shortcut.')
      }
      return
    }

    if (
      input.key.toLowerCase() === 'r' &&
      (
        (isMac && input.meta) ||
        (!isMac && input.control && input.shift)
      )
    ) {
      event.preventDefault()
    }
  })
}
