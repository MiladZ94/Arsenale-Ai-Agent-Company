/* The asset manifest (tools/assets.cjs): every file Arsenale ships under
 * tools/assets has a CC0-1.0 entry with the right hash, and the loader
 * prefers a real file when there is one and refuses everything else. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const A = require('../assets.cjs')

test('every shipped asset file has a manifest entry with licence CC0-1.0 and the right hash', () => {
  const m = A.readManifest()
  const byFile = new Map(m.assets.map((a) => [a.file, a]))
  for (const f of A.shippedFiles()) {
    const a = byFile.get(f)
    assert.ok(a, f + ' is shipped with no entry in tools/assets/manifest.json')
    assert.equal(a.licence, 'CC0-1.0', f + ' is not CC0-1.0')
    for (const k of ['name', 'author', 'source', 'fetched', 'sha256']) assert.ok(a[k], f + ' has no ' + k)
    assert.equal(A.sha256(fs.readFileSync(path.join(A.DIR, f))), a.sha256, f + ' differs from its hash')
  }
  assert.ok(fs.existsSync(path.join(A.DIR, 'NOTICE.md')))
})

function folder(t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'arsenale-assets-'))
  t.after(() => fs.rmSync(d, { recursive: true, force: true }))
  return d
}
const entry = (file, buf, extra) => Object.assign({ file, use: 'building:docs', name: 'n', author: 'a', source: 'https://example.invalid/', licence: 'CC0-1.0', fetched: '2026-10-16', sha256: A.sha256(buf) }, extra)

test('the loader takes a CC0 file whose hash matches, and nothing else', (t) => {
  const d = folder(t)
  const good = Buffer.from('glb-good'), bad = Buffer.from('glb-bad')
  fs.writeFileSync(path.join(d, 'good.glb'), good)
  fs.writeFileSync(path.join(d, 'bad.glb'), bad)
  fs.writeFileSync(path.join(d, 'nc.glb'), good)
  fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify({ assets: [
    entry('good.glb', good),
    entry('bad.glb', Buffer.from('other'), { use: 'building:legal' }),
    entry('nc.glb', good, { use: 'building:data', licence: 'CC-BY-NC-4.0' }),
    entry('missing.glb', good, { use: 'building:design' }),
    entry('../escape.glb', good, { use: 'building:release' }),
  ] }))
  const r = A.pageAssets(d)
  assert.deepEqual(Object.keys(r.models), ['building:docs'])
  assert.equal(Buffer.from(r.models['building:docs'], 'base64').toString(), 'glb-good')
  assert.ok(r.problems.some((p) => /bad\.glb.*hash/.test(p)))
  assert.ok(r.problems.some((p) => /nc\.glb.*CC0/.test(p)))
  assert.ok(r.problems.some((p) => /escape/.test(p)))
})

test('with no asset files the page gets no models (the shapes are drawn)', () => {
  assert.deepEqual(A.pageAssets().models, {})
})

test('a shipped file with no entry is found by the check above', (t) => {
  const d = folder(t)
  fs.writeFileSync(path.join(d, 'loose.glb'), 'x')
  fs.writeFileSync(path.join(d, 'manifest.json'), '{"assets":[]}')
  const names = new Set(A.readManifest(d).assets.map((a) => a.file))
  assert.deepEqual(A.shippedFiles(d).filter((f) => !names.has(f)), ['loose.glb'])
})
