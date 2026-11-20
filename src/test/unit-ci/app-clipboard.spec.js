const { test } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

const globalState = require('../../app/lib/glob-state')
const systemCalls = []
const originalLoad = Module._load

Module._load = function (request, ...args) {
  if (request === 'electron') {
    return {
      clipboard: {
        readText () {
          systemCalls.push(['read'])
          return Promise.resolve('system')
        },
        writeText (text) {
          systemCalls.push(['write', text])
        }
      }
    }
  }
  return originalLoad.call(this, request, ...args)
}

let clipboard
try {
  clipboard = require('../../app/lib/clipboard')
} finally {
  Module._load = originalLoad
}

test('system clipboard is the default', async () => {
  assert.equal(await clipboard.readText(), 'system')
  clipboard.writeText('manual copy')
  assert.deepEqual(systemCalls, [['read'], ['write', 'manual copy']])
})

test('private clipboard can be enabled without calling the system clipboard', () => {
  globalState.set('privateClipboard', true)
  const nativeCalls = systemCalls.length

  assert.equal(clipboard.readText(), '')
  clipboard.writeText('remote copy')
  assert.equal(clipboard.readText(), 'remote copy')
  clipboard.writeText('')
  assert.equal(clipboard.readText(), '')
  assert.equal(systemCalls.length, nativeCalls)
})
