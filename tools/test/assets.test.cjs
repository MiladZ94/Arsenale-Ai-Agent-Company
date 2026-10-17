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

test('every manifest entry names the pack licence text that ships with it', () => {
  for (const a of A.readManifest().assets) {
    assert.ok(a.licenceFile && /^licenses\/[\w.-]+$/.test(a.licenceFile), a.file + ' names no licence text')
    const txt = fs.readFileSync(path.join(A.DIR, a.licenceFile), 'utf8')
    assert.match(txt, /creativecommons\.org\/publicdomain\/zero\/1\.0/i, a.licenceFile + ' is not the CC0 text')
  }
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

test('with no asset files the page gets no models (the shapes are drawn)', (t) => {
  assert.deepEqual(A.pageAssets(folder(t)).models, {})
})

test('the shipped models all load: one building per office type, the office furniture, one character style, its rendered portraits in each of the ten outfits and the building pictures of the wizard, real files, no problems', () => {
  const r = A.pageAssets()
  assert.deepEqual(r.problems, [])
  const types = require('../campus.cjs').TYPES.map((t) => 'building:' + t.id).sort()
  const keys = Object.keys(r.models).sort()
  assert.deepEqual(keys.filter((k) => /^building:/.test(k)), types)
  assert.deepEqual(keys.filter((k) => /^furniture:/.test(k)), ['furniture:chair', 'furniture:desk', 'furniture:plant', 'furniture:screen', 'furniture:sofa'])
  assert.deepEqual(keys.filter((k) => /^character:/.test(k)), ['character:office'])
  const outfits = require('../pages/world/palette.cjs').OUTFIT.length
  assert.deepEqual(keys.filter((k) => /^portrait:/.test(k)), ['desk', 'front', 'left', 'right'].flatMap((v) => Array.from({ length: outfits }, (_, n) => 'portrait:' + v + n)).sort())
  assert.deepEqual(keys.filter((k) => /^icon:/.test(k)), types.map((t) => t.replace('building:', 'icon:')).sort())
  assert.equal(keys.length, types.length * 2 + 6 + 4 * outfits)
  // the models are GLB files; the portraits are PNGs rendered from them (tools/render-portraits.cjs)
  for (const [k, b64] of Object.entries(r.models)) assert.equal(Buffer.from(b64, 'base64').subarray(0, 4).toString('latin1'), /^(portrait|icon):/.test(k) ? 'PNG' : 'glTF', k)
})

test('every office type has its own model (twelve different files), and no file is over 6 MB or all together over 10 MB', () => {
  const m = A.readManifest().assets.filter((a) => /^building:/.test(a.use))
  assert.equal(new Set(m.map((a) => a.file)).size, 12, 'twelve types, twelve files')
  let total = 0
  for (const f of A.shippedFiles()) { const n = fs.statSync(path.join(A.DIR, f)).size; assert.ok(n <= 6 * 1024 * 1024, f + ' is over 6 MB'); total += n }
  assert.ok(total < 10 * 1024 * 1024, 'the shipped models are ' + total + ' bytes')
})

test('the loader takes furniture and character entries and refuses an unknown kind', (t) => {
  const d = folder(t)
  const buf = Buffer.from('glb')
  fs.writeFileSync(path.join(d, 'a.glb'), buf)
  fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify({ assets: [
    entry('a.glb', buf, { use: 'furniture:desk' }),
    entry('a.glb', buf, { use: 'character:office' }),
    entry('a.glb', buf, { use: 'vehicle:car' }),
    entry('a.glb', buf, { use: 'furniture:Desk' }),
  ] }))
  const r = A.pageAssets(d)
  assert.deepEqual(Object.keys(r.models).sort(), ['character:office', 'furniture:desk'])
  assert.equal(r.problems.filter((p) => /bad entry/.test(p)).length, 2)
})

test('a shipped file with no entry is found by the check above', (t) => {
  const d = folder(t)
  fs.writeFileSync(path.join(d, 'loose.glb'), 'x')
  fs.writeFileSync(path.join(d, 'manifest.json'), '{"assets":[]}')
  const names = new Set(A.readManifest(d).assets.map((a) => a.file))
  assert.deepEqual(A.shippedFiles(d).filter((f) => !names.has(f)), ['loose.glb'])
})

test('the outfit pictures and building pictures add under 2 MB, and the old unvaried portraits are gone', () => {
  const m = A.readManifest().assets.filter((a) => /^(portraits|icons)\//.test(a.file))
  assert.equal(m.length, 4 * require('../pages/world/palette.cjs').OUTFIT.length + require('../campus.cjs').TYPES.length)
  assert.ok(m.reduce((n, a) => n + a.size, 0) < 2 * 1024 * 1024, 'the rendered pictures are over 2 MB')
  for (const a of m) assert.match(a.modified, /^derived: .*tools\/render-portraits\.cjs; CC0 as its sources?$/, a.file + ' does not say how it was made')
  for (const old of ['front', 'left', 'right', 'desk']) assert.equal(fs.existsSync(path.join(A.DIR, 'portraits', old + '.png')), false, old + '.png is replaced by ' + old + '-<n>.png')
})

test('the outfit of an agent is a function of its id alone, one of ten distinct colours, each readable against the white shirt', () => {
  const { OUTFIT, outfitIndex, contrast } = require('../pages/world/palette.cjs')
  assert.equal(OUTFIT.length, 10)
  assert.equal(new Set(OUTFIT).size, 10)
  for (const c of OUTFIT) assert.ok(contrast(c, '#FFFFFF') >= 3, c + ' is too pale against a white shirt (3:1 for a graphic)')
  const ids = ['version-lead', 'phase-runner', 'code-reviewer', 'security-auditor', 'docs-writer', 'qa', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n']
  const seen = new Set()
  for (const id of ids) {
    const n = outfitIndex(id)
    assert.ok(Number.isInteger(n) && n >= 0 && n < 10, id)
    assert.equal(outfitIndex(id), n, 'stable')
    assert.equal(outfitIndex(id + ':3'), n, 'the look a member picks changes the angle, never the outfit')
    seen.add(n)
  }
  assert.ok(seen.size >= 7, 'twenty agents wear only ' + seen.size + ' of the ten outfits')
})
