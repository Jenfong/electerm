const { test } = require('node:test')
const assert = require('assert/strict')
const { EventEmitter } = require('events')
const Module = require('module')

process.env.NODE_ENV = 'development'
let privateMode = true
let reads = 0
const originalLoad = Module._load
Module._load = function (request, ...args) {
  if (request === '../common/runtime-constants') return { isMac: true }
  if (request === 'electron') {
    return {
      app: { getName: () => privateMode ? 'electerm-background' : 'electerm' },
      clipboard: {
        readText () {
          reads++
          return 'manual paste 文本'
        }
      }
    }
  }
  return originalLoad.call(this, request, ...args)
}

let shortcut
try {
  shortcut = require('../../app/lib/key-bind')
} finally {
  Module._load = originalLoad
}

function fixture () {
  let focused = true
  const contents = new EventEmitter()
  const delivered = []
  contents.send = (...args) => delivered.push(args)
  const win = { webContents: contents, isFocused: () => focused }
  shortcut.disableShortCuts(win)
  return {
    contents,
    delivered,
    blur () { focused = false },
    key (overrides) {
      let prevented = false
      contents.emit('before-input-event', { preventDefault () { prevented = true } }, {
        key: 'v', code: 'KeyV', type: 'keyDown', meta: true, ...overrides
      })
      return prevented
    }
  }
}

test('a focused Background RDP tab receives the text from an explicit system paste', () => {
  const f = fixture()
  assert.equal(f.key(), false)
  assert.equal(reads, 0)
  shortcut.setRdpPasteTarget(f.contents, 'rdp-1', true)
  assert.equal(f.key(), true)
  assert.equal(reads, 1)
  assert.deepEqual(f.delivered, [['rdp-system-paste', { tabId: 'rdp-1', text: 'manual paste 文本' }]])
  assert.equal(f.key({ type: 'keyUp' }), true)
  assert.equal(reads, 1)
})

test('only the active RDP target receives Command+V', () => {
  const f = fixture()
  const start = reads
  shortcut.setRdpPasteTarget(f.contents, 'rdp-1', true)
  shortcut.setRdpPasteTarget(f.contents, 'rdp-2', true)
  shortcut.setRdpPasteTarget(f.contents, 'rdp-1', false)
  assert.equal(f.key({ meta: false, control: true }), false)
  assert.equal(f.key({ shift: true }), false)
  assert.equal(f.key({ isAutoRepeat: true }), true)
  assert.equal(f.key(), true)
  assert.equal(f.delivered[0][1].tabId, 'rdp-2')
  f.blur()
  assert.equal(f.key(), false)
  assert.equal(reads, start + 1)
})

test('the official app retains its own shortcut behavior', () => {
  privateMode = false
  const f = fixture()
  shortcut.setRdpPasteTarget(f.contents, 'rdp-1', true)
  assert.equal(f.key(), false)
})
