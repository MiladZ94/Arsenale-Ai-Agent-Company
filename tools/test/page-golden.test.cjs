/* The dashboard pages are byte-identical to the golden hashes (page-golden.cjs):
 * moving page source between modules must not change one byte of what a
 * browser receives. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const { render, sha, GOLDEN } = require('./page-golden.cjs')

test('every page builder renders byte-identical output for the frozen state', () => {
  const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'))
  const pages = render()
  assert.deepEqual(pages.map((p) => p[0]), Object.keys(golden))
  for (const [name, html] of pages) {
    assert.equal(html.length, golden[name].length, name + ': length')
    assert.equal(sha(html), golden[name].sha256, name + ': hash')
  }
})
