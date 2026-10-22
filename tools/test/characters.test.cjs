/* The shipped office characters (tools/characters): the licence record, the
 * six clips and how the 3D office finds them, the page weight, the one look
 * function every screen shares, and the pixel fallback.
 *
 * No browser here: the states-to-clips check on a live floor is in
 * office3d.test.cjs. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DIR = path.join(__dirname, '..', 'characters')
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')
const manifest = () => JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'))
const glbJson = (file) => { const b = fs.readFileSync(path.join(DIR, file)), len = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + len).toString('utf8')) }
const SET = fs.readdirSync(DIR).filter((f) => /^person-[\w-]+\.glb$/.test(f))

/** Every file that is not ours or a licence text has an entry with the right hash, CC0, a page and a licence text. */
function problems(m) {
  const out = []
  const listed = new Map(m.files.map((f) => [f.file, f]))
  const shipped = []
  for (const f of fs.readdirSync(DIR)) if (/^person-[\w-]+\.glb$/.test(f)) shipped.push(f)
  if (fs.existsSync(path.join(DIR, 'sprites'))) for (const f of fs.readdirSync(path.join(DIR, 'sprites'))) shipped.push('sprites/' + f)
  for (const f of shipped) {
    const e = listed.get(f)
    if (!e) { out.push(f + ': no manifest entry'); continue }
    if (e.sha256 !== sha(fs.readFileSync(path.join(DIR, f)))) out.push(f + ': the hash does not match')
    if (e.licence !== 'CC0-1.0') out.push(f + ': the licence is not CC0-1.0')
    if (/^person-/.test(f)) {
      if (!(e.sources || []).every((s) => /^https:\/\//.test(s.pageUrl || ''))) out.push(f + ': no source page')
      if (!(e.licenceText || []).length || !e.licenceText.every((t) => fs.existsSync(path.join(DIR, t)))) out.push(f + ': the licence text is missing')
    }
  }
  return out
}

test('licence record: every shipped file has a manifest entry whose hash matches, CC0, a source page and a licence text', () => {
  assert.deepEqual(problems(manifest()), [])
  const m = manifest()
  assert.equal(m.schemaVersion, 1)
  for (const p of m.packs) assert.ok(fs.existsSync(path.join(DIR, p.licenceText)), p.licenceText)
})

test('licence record: removing one entry makes the check fail and name the file', () => {
  const m = manifest(), gone = m.files.find((f) => f.file === SET[0])
  m.files = m.files.filter((f) => f !== gone)
  assert.deepEqual(problems(m), [SET[0] + ': no manifest entry'])
  const m2 = manifest(); m2.files.find((f) => f.file === SET[1]).sha256 = '0'.repeat(64)
  assert.deepEqual(problems(m2), [SET[1] + ': the hash does not match'])
})

test('licence record: LICENCES.md lists every file with its hash, and the original licence texts are kept', () => {
  const text = fs.readFileSync(path.join(DIR, 'LICENCES.md'), 'utf8')
  for (const f of manifest().files) assert.ok(text.includes(f.sha256), f.file + ' is in LICENCES.md')
  assert.match(text, /Kay Lousberg/)
  assert.match(text, /creativecommons\.org\/publicdomain\/zero\/1\.0/)
  for (const f of ['KayKit-Adventurers-License.txt', 'KayKit-Character-Animations-License.txt']) assert.match(fs.readFileSync(path.join(DIR, 'licences', f), 'utf8'), /CC0|Creative Commons Zero/i, f)
})

// the clip names and seated test, read from the 3D office's own source
const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'world', 'office3d', 'part2.js'), 'utf8')
const CLIP_RX = new Function('return ' + /const CLIP_RX = (\{[\s\S]*?\n {2}\})/.exec(src)[1])()
const SEATED_RX = new Function('return ' + /const SEATED_RX = (\/.*\/\w*)/.exec(src)[1])()

test('clips: every character has exactly Idle, Walk, Sit, Typing, Stand and Celebrate, and the office finds each for its state', () => {
  assert.ok(SET.length >= 6, 'the set: ' + SET.join(', '))
  for (const f of SET) {
    const j = glbJson(f)
    assert.deepEqual(j.animations.map((a) => a.name).sort(), ['Celebrate', 'Idle', 'Sit', 'Stand', 'Typing', 'Walk'], f)
    assert.equal(j.asset.generator, 'Arsenale character build', f)
    const names = j.animations.map((a) => a.name)
    const find = (state) => { for (const rx of CLIP_RX[state]) { const c = names.find((n) => rx.test(n)); if (c) return c } return null }
    assert.deepEqual({ typing: find('typing'), walk: find('walk'), sit: find('sit'), idle: find('idle'), stand: find('stand'), celebrate: find('celebrate') },
      { typing: 'Typing', walk: 'Walk', sit: 'Sit', idle: 'Idle', stand: 'Stand', celebrate: 'Celebrate' }, f)
    assert.ok(names.some((n) => SEATED_RX.test(n)), 'Sit seats the person: ' + f)
    assert.equal(names.filter((n) => SEATED_RX.test(n)).length, 1, 'only Sit counts as seated: ' + f)
  }
})

test('clips: Typing is the seated clip with the arms moving, and loops over the length of Sit', () => {
  const j = glbJson(SET[0]), dur = (a) => Math.max(...a.samplers.map((s) => j.accessors[s.input].max[0]))
  const by = Object.fromEntries(j.animations.map((a) => [a.name, a]))
  assert.ok(Math.abs(dur(by.Typing) - dur(by.Sit)) < 1e-3)
  const armKeys = (a) => Math.max(...a.channels.filter((c) => /^lowerarm\./.test(j.nodes[c.target.node].name) && c.target.path === 'rotation').map((c) => j.accessors[a.samplers[c.sampler].input].count))
  assert.equal(armKeys(by.Typing), Math.round(dur(by.Sit) / 0.8) * 8 + 1, 'the arms of Typing are the synthesised keyboard motion, not the arms of Sit')
})

test('shape: no props or costume mesh, one skin, a tintable Shirt material, vertex colours, no texture', () => {
  for (const f of SET) {
    const j = glbJson(f)
    assert.equal(j.skins.length, 1, f)
    assert.ok(!j.images && !j.textures, f + ' carries no texture')
    assert.ok(j.materials.some((m) => m.name === 'Shirt'), f + ' has a Shirt material')
    for (const p of j.meshes[0].primitives) assert.ok('COLOR_0' in p.attributes, f)
    assert.ok(!j.nodes.some((n) => /cape|helmet|hat|quiver|mask|shield|sword|axe|staff|bow/i.test(n.name)), f + ' has no prop nodes')
  }
})

test('payload: the characters the page inlines are 6 MB or less, the sprites and portraits 3 MB or less', () => {
  const b64 = SET.reduce((n, f) => n + Math.ceil(fs.statSync(path.join(DIR, f)).size / 3) * 4, 0) + Math.ceil(fs.statSync(path.join(DIR, 'default.glb')).size / 3) * 4
  assert.ok(b64 <= 6 * 1024 * 1024, 'characters ' + b64)
  const sp = fs.readdirSync(path.join(DIR, 'sprites')).reduce((n, f) => n + fs.statSync(path.join(DIR, 'sprites', f)).size, 0)
  assert.ok(sp <= 3 * 1024 * 1024, 'sprites ' + sp)
})

test('sprites: every character in every office colour has a 256 px portrait and a strip of five 64 px frames', () => {
  const atlas = JSON.parse(fs.readFileSync(path.join(DIR, 'sprites', 'atlas.json'), 'utf8'))
  const { THEMES } = require('../agent-company.cjs')
  assert.deepEqual(Object.keys(atlas.colours).sort(), Object.keys(THEMES).sort())
  assert.equal(atlas.portrait, 256); assert.equal(atlas.sprite, 64)
  const dim = (file) => { const b = fs.readFileSync(file); return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)), kind: b.toString('latin1', 12, 16) } }
  for (const v of [...atlas.variants, atlas.plain]) {
    assert.ok(SET.includes('person-' + v + '.glb'), v)
    for (const c of Object.keys(atlas.colours)) {
      const p = path.join(DIR, 'sprites', atlas.file.portrait.replace('{v}', v).replace('{c}', c)), s = path.join(DIR, 'sprites', atlas.file.sprite.replace('{v}', v).replace('{c}', c))
      assert.ok(fs.existsSync(p) && fs.existsSync(s), v + '-' + c)
      assert.equal(dim(p).kind, 'VP8X', 'a WebP with alpha'); assert.deepEqual([dim(p).w, dim(p).h], [256, 256])
      assert.deepEqual([dim(s).w, dim(s).h], [320, 64])
    }
  }
})

const { officeLook } = require('../characters/look.cjs')
const NAMES = ['1', '2', '3', '4', '5']
const THEMES2 = { teal: '#2FA98A', blue: '#4E8BD4', coral: '#D9785A' }

test('look: the same seed gives the same character everywhere; the supervisor is the plain one; the look number changes it', () => {
  const a = officeLook(NAMES, THEMES2, {}), b = officeLook(NAMES, THEMES2, {})
  for (const id of ['implementer', 'tester', 'copywriter', 'copywriter:3', 'mira', 'x']) { assert.equal(a.variant(id), b.variant(id)); assert.ok(NAMES.includes(a.variant(id))) }
  assert.equal(a.variant('supervisor'), 'plain'); assert.equal(a.variant('supervisor:2'), 'plain')
  const seen = new Set(Array.from({ length: 60 }, (_, i) => a.variant('agent-' + i)))
  assert.equal(seen.size, NAMES.length, 'every character is used')
  assert.notEqual(new Set(['copywriter:1', 'copywriter:2', 'copywriter:3', 'copywriter:4', 'copywriter:5', 'copywriter:6'].map((s) => a.variant(s))).size, 1, 'the look number moves the pick')
})

test('look: an office colour that is not a theme still gets the nearest shirt; no image means null', () => {
  const l = officeLook(NAMES, THEMES2, { 'p-1-blue': 'data:image/webp;base64,AAAA' })
  assert.equal(l.nearest('#4F7FD9'), 'blue'); assert.equal(l.nearest('#D07F3A'), 'coral'); assert.equal(l.nearest(''), 'blue')
  assert.equal(officeLook(NAMES, THEMES2, {}).url('p', 'x', '#4E8BD4'), null)
})

test('look: the same function and the same pick in the page and in the build (the hash the pixel people use)', () => {
  const { everyoneArt } = require('../everyone-art.cjs')
  const A = everyoneArt(), l = officeLook(NAMES, THEMES2, {})
  for (const s of ['implementer', 'a:3', 'zz']) assert.equal(A.hash(s), l.hash(s))
})

test('fallback: without sprites the people are the pixel people; with them, the rendered ones', () => {
  const { everyoneArt } = require('../everyone-art.cjs')
  assert.equal(typeof globalThis.OFFICE_LOOK, 'undefined')
  const A = everyoneArt()
  assert.match(A.person('tester', '#4E8BD4', 32), /<svg/)
  assert.match(A.personG('tester', '#4E8BD4', 0, 0, 3), /<g transform/)
  globalThis.OFFICE_LOOK = { url: () => null }
  try {
    assert.match(everyoneArt().person('tester', '#4E8BD4', 32), /<svg/, 'a look with no image keeps the pixel person')
    globalThis.OFFICE_LOOK = { url: (kind) => 'blob:' + kind }
    const B = everyoneArt()
    assert.match(B.person('tester', '#4E8BD4', 32), /<img src="blob:p"/)
    assert.match(B.personG('tester', '#4E8BD4', 0, 0, 3, true), /<image href="blob:s"/)
    assert.match(B.personG('tester', '#4E8BD4', 0, 0, 5), /<image href="blob:p"/)
  } finally { delete globalThis.OFFICE_LOOK }
})

test('page: the live page carries the set, the look and the images; each GLB is inlined once', () => {
  const { characterScripts } = require('../pages/world/people.cjs')
  const html = characterScripts()
  assert.match(html, /^<script>const OFFICE_LOOK = /)
  assert.ok(html.includes('"p-1-teal":"data:image/webp;base64,'))
  const { worldScripts } = require('../office-world.cjs')
  const w = worldScripts()
  const m = /const OFFICE_CHARACTERS = (\{.*\});<\/script>/.exec(w)
  const chars = JSON.parse(m[1])
  assert.deepEqual(Object.keys(chars), ['default', 'byAgent', 'set'])
  assert.deepEqual(Object.keys(chars.set).sort(), ['1', '2', '3', '4', '5', 'plain'])
})
