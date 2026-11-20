const { test } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

let name = 'electerm'
const systemCalls = []
const originalLoad = Module._load

Module._load = function (request, ...args) {
  if (request === 'electron') {
    return {
      app: { getName: () => name },
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

test('official build continues using the macOS clipboard', async () => {
  assert.equal(await clipboard.readText(), 'system')
  clipboard.writeText('manual copy')
  assert.deepEqual(systemCalls, [['read'], ['write', 'manual copy']])
})

test('Background starts with a private clipboard and never calls the system clipboard', () => {
  name = 'electerm-background'
  const nativeCalls = systemCalls.length

  assert.equal(clipboard.readText(), '')
  clipboard.writeText('remote copy')
  assert.equal(clipboard.readText(), 'remote copy')
  clipboard.writeText('')
  assert.equal(clipboard.readText(), '')
  assert.equal(systemCalls.length, nativeCalls)
})
