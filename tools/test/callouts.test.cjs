/* House style: a callout (a waiting question, a phone message, a task's open
 * question) is a plain box with a thin all-round border. No thick one-sided
 * accent stripe. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

test('dry run S5: no callout carries a thick left or start border stripe', () => {
  const sels = ['.wait', '.wait.late', '.ev .tk .q', '.ev .phone .n']
  let seen = 0
  for (const f of ['pages/everyone/style.cjs', 'pages/office/style.cjs']) {
    const css = fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
    for (const m of css.matchAll(/(^|\n)([^{}\n]+)\{([^}]*)\}/g)) {
      if (!sels.includes(m[2].trim())) continue
      seen++
      assert.doesNotMatch(m[3], /border-(inline-start|left)(-color)?\s*:\s*([2-9]px|var)/, f + ': ' + m[2].trim() + ' has an accent stripe')
    }
  }
  assert.ok(seen >= 4, 'the four callout rules were found (' + seen + ')')
})
