/* The licence record of the shipped characters: manifest.json (one entry for
 * each shipped file, with its SHA-256) and LICENCES.md (the same, for a
 * person). The two build scripts call this when they finish; the test in
 * tools/test/characters.test.cjs reads manifest.json and checks every hash. */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DIR = __dirname
const FILE = path.join(DIR, 'manifest.json')
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { return { schemaVersion: 1, licence: 'CC0-1.0', packs: [], files: [] } }
}
function save(m) {
  m.files.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'model' ? -1 : b.kind === 'model' ? 1 : a.kind < b.kind ? -1 : 1) || (a.file < b.file ? -1 : 1))
  fs.writeFileSync(FILE, JSON.stringify(m, null, 1) + '\n')
}

/** Replace the model entries (and the pack records) of the manifest. */
function setModels(entries, packs) {
  const m = read()
  m.packs = packs.map((p) => ({ id: p.id, library: p.library, author: p.author, pageUrl: p.pageUrl, downloadedAt: p.downloadedAt, archiveSha256: p.archiveSha256, licence: 'CC0-1.0', licenceText: 'licences/' + p.licenceFile }))
  m.files = m.files.filter((f) => f.kind !== 'model').concat(entries.map((e) => Object.assign({ licence: 'CC0-1.0' }, e)))
  save(m)
}
/** Replace the entries of the rendered images (portraits, sprites, the atlas). */
function setImages(entries) {
  const m = read()
  m.files = m.files.filter((f) => f.kind === 'model').concat(entries.map((e) => Object.assign({ licence: 'CC0-1.0' }, e)))
  save(m)
}

/** Hash every file again, then write manifest.json and LICENCES.md. */
function refresh() {
  const m = read()
  const own = {
    file: 'default.glb', kind: 'model', licence: 'CC0-1.0', own: true,
    sources: [{ library: 'Arsenale', author: 'Arsenale', originalFile: 'make-default-character.cjs' }], licenceText: ['LICENSE.txt'],
    changes: ['made by make-default-character.cjs from three.js primitives; the fallback when the set is missing'],
  }
  m.files = m.files.filter((f) => f.file !== 'default.glb')
  m.files.push(own)
  for (const f of m.files) {
    const buf = fs.readFileSync(path.join(DIR, f.file))
    f.sha256 = sha(buf); f.bytes = buf.length
  }
  save(m)
  fs.writeFileSync(path.join(DIR, 'LICENCES.md'), licencesText(m))
  return m
}

function licencesText(m) {
  const L = []
  L.push('# Licences of the shipped characters', '')
  L.push('Every file in this folder that is not our own is CC0 1.0 (public domain dedication,')
  L.push('https://creativecommons.org/publicdomain/zero/1.0/). Credit is not required; it is kept here')
  L.push('because the owner asked for it. Written by tools/characters/manifest.cjs: do not edit by hand.', '')
  L.push('## Sources', '')
  for (const p of m.packs) {
    L.push('- **' + p.library + '**, by ' + p.author)
    L.push('  - Page: ' + p.pageUrl + ' (licence shown there: Creative Commons Zero v1.0 Universal)')
    L.push('  - Downloaded: ' + p.downloadedAt + '; archive SHA-256 ' + p.archiveSha256)
    L.push('  - Licence text, as it came in the pack: `' + p.licenceText + '`')
  }
  L.push('', 'Our own script made `default.glb` (CC0, see LICENSE.txt). The sprites and portraits are rendered from the', 'models below by build-sprites.cjs, so they carry the same licence and the same authors.', '')
  L.push('## What was changed', '')
  const model = m.files.find((f) => f.kind === 'model' && f.sources && f.sources.length > 1)
  if (model) for (const c of model.changes) L.push('- ' + c)
  L.push('', '## Models', '', '| File | Source file (original SHA-256) | SHA-256 | Bytes |', '|---|---|---|---:|')
  for (const f of m.files.filter((x) => x.kind === 'model')) {
    const s = f.sources[0]
    L.push('| ' + f.file + ' | ' + (f.own ? 'own script (' + s.originalFile + ')' : s.pack + ': ' + s.originalFile + ' (' + s.originalSha256 + ')') + ' | ' + f.sha256 + ' | ' + f.bytes + ' |')
  }
  const anims = [...new Map(m.files.filter((x) => x.kind === 'model' && !x.own).flatMap((x) => x.sources.slice(1)).map((s) => [s.originalFile, s])).values()]
  if (anims.length) {
    L.push('', '## Animation files the clips come from (kaykit-character-animations)', '', '| Source file | SHA-256 |', '|---|---|')
    for (const s of anims) L.push('| ' + s.originalFile + ' | ' + s.originalSha256 + ' |')
  }
  const imgs = m.files.filter((x) => x.kind !== 'model')
  if (imgs.length) {
    L.push('', '## Rendered images (sprites/)', '', '| File | Kind | Rendered from | SHA-256 | Bytes |', '|---|---|---|---|---:|')
    for (const f of imgs) L.push('| ' + f.file + ' | ' + f.kind + ' | ' + (f.derivedFrom || '') + ' | ' + f.sha256 + ' | ' + f.bytes + ' |')
  }
  return L.join('\n') + '\n'
}

module.exports = { setModels, setImages, refresh, read, sha }
