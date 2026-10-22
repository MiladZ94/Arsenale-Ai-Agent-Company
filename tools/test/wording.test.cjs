/* Wording guard (spec 1.1, sections 4.9 and 16): no Arabic-script text, and
 * no authorship mark of a writing assistant, in any file of the repo.
 *
 * Arsenale is English only. It works with coding assistants and names them
 * (Claude Code, Codex CLI, Gemini CLI, Cursor …): that is what the product is
 * for, and this guard never fails on a tool, vendor or model name. What it
 * catches is text that claims an assistant made the file itself: a co-author
 * trailer, a tool footer, the robot emoji such footers carry, a model
 * speaking of itself, a by-line that names an assistant, a machine-written
 * label.
 *
 * The guard reads the files git would commit (tracked, and new ones not
 * ignored), so it also sees work that is not committed yet.
 *
 * Every pattern is built from pieces, and the emoji from its code point, so
 * this file holds neither an Arabic-script character nor a mark it bans.
 *
 * Run: npm test */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO = path.join(__dirname, '..', '..')

// Arabic, Arabic Supplement, Arabic Extended-A, Presentation Forms A and B
const RANGES = [[0x600, 0x6ff], [0x750, 0x77f], [0x8a0, 0x8ff], [0xfb50, 0xfdff], [0xfe70, 0xfeff]]
const isArabicScript = (cp) => RANGES.some(([a, b]) => cp >= a && cp <= b)

const j = (...p) => p.join('')
const ROBOT = String.fromCodePoint(0x1f916)
// who an authorship line names: an assistant, a model, or "an AI"
const WHO = j('(clau', 'de|chat', 'gpt|\\bgp', 't-?\\d*|copi', 'lot|gem', 'ini|co', 'dex|cur', 'sor|an? ', 'AI\\b|\\bAI\\b|an? ', 'LLM|a language model|an? (coding |writing )?assistant)')
const MARKS = [
  [j('co-auth', 'ored-by'), 'a co-author trailer'],
  [j('\\bgenerated ', 'with\\b'), 'a tool footer'],
  [ROBOT, 'the robot emoji'],
  [j('\\bas an ', 'AI\\b'), 'a model speaking of itself'],
  [j('\\b(written|drafted|authored|created|generated|produced) (by|with|using) ', WHO), 'a by-line naming an assistant'],
  [j('\\bAI[- ](generated|written|authored)\\b'), 'a machine-written label'],
].map(([src, what]) => [new RegExp(src, 'iu'), what])

// [files it applies to, why]; the whole list of exceptions
const EXEMPT = [
  [/^docs\/specs\/1\.1-spec\.md$/, 'the spec quotes the marks this guard bans'],
]

// third-party code is not ours to reword; images and archives are not text
const SKIP_DIR = /^(tools\/vendor|node_modules|\.git)\//
const BINARY = /\.(png|gif|jpe?g|ico|webp|woff2?|ttf|otf|pdf|zip|gz|mp4|webm|glb)$/i

function repoFiles() {
  const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  assert.equal(r.status, 0, 'git ls-files failed: ' + r.stderr)
  return [...new Set(r.stdout.split('\0').filter(Boolean))]
    .filter((f) => !SKIP_DIR.test(f) && !BINARY.test(f) && fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile())
}

/** The findings of one text: [line number, what] pairs. */
function scan(file, text) {
  const found = []
  const exempt = EXEMPT.some(([files]) => files.test(file))
  text.split(/\r?\n/).forEach((line, i) => {
    for (const ch of line) if (isArabicScript(ch.codePointAt(0))) { found.push([i + 1, 'Arabic-script character U+' + ch.codePointAt(0).toString(16).toUpperCase()]); break }
    if (exempt) return
    for (const [re, what] of MARKS) if (re.test(line)) found.push([i + 1, what])
  })
  return found
}

test('no Arabic-script text and no authorship mark in any file of the repo', () => {
  const bad = []
  for (const f of repoFiles()) {
    const text = fs.readFileSync(path.join(REPO, f), 'utf8')
    if (text.includes('\0')) continue
    for (const [n, what] of scan(f, text)) bad.push(f + ':' + n + ' ' + what)
  }
  assert.deepEqual(bad.slice(0, 40), [], bad.length + ' wording problem(s)')
})

test('the guard fails on a planted Arabic-script character and on each authorship mark, naming the line', () => {
  const planted = [
    'fine line',
    'an Arabic letter: ' + String.fromCharCode(0x628),
    j('Co-Auth', 'ored-By: Someone <x@example.invalid>'),
    ROBOT + ' ' + j('Gener', 'ated with') + ' a tool',
    j('As an ', 'AI') + ', I cannot',
    j('This file was writ', 'ten by Clau', 'de.'),
    j('Drafted with Chat', 'GPT'),
    j('All of it is AI-gen', 'erated'),
  ].join('\n')
  const got = scan('README.md', planted).map(([n, what]) => n + ' ' + what)
  assert.deepEqual(got, [
    '2 Arabic-script character U+628',
    '3 a co-author trailer',
    '4 a tool footer', '4 the robot emoji',
    '5 a model speaking of itself',
    '6 a by-line naming an assistant',
    '7 a by-line naming an assistant',
    '8 a machine-written label',
  ])
})

test('supported tools, vendors and models may be named', () => {
  const ok = [
    'Works with Claude Code, Claude Desktop, Codex CLI, Gemini CLI, Cursor, Aider and ChatGPT (not connectable).',
    'Run a company of AI agents you can watch at work.',
    'The heavy tier is opus, the standard tier sonnet, the light tier haiku; gpt-5-codex is logged as it is.',
    'adapters/claude-code/hooks/arsenale-hook.cjs, ~/.claude/CLAUDE.md, claude mcp add, -ClaudeDir',
    'A report written by the tester, a page generated from the demo data.',
  ].join('\n')
  assert.deepEqual(scan('README.md', ok), [])
})

// ---- assets: the strings inside a model or a drawing are text too (spec 1.2, 4.1 rule 14)
const TOOLED = /^(tools\/vendor|node_modules|\.git)\//
function allFiles() {
  const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  assert.equal(r.status, 0, 'git ls-files failed: ' + r.stderr)
  return [...new Set(r.stdout.split('\0').filter(Boolean))].filter((f) => !TOOLED.test(f) && fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile())
}
/** Every string of the JSON chunk of a GLB (names, generator, copyright, extras), one per line. */
function glbStrings(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) return null
  let off = 12
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off), kind = buf.readUInt32LE(off + 4)
    if (kind === 0x4e4f534a) {
      const out = []
      const walk = (v) => { if (typeof v === 'string') out.push(v); else if (v && typeof v === 'object') for (const k of Object.keys(v)) { out.push(k); walk(v[k]) } }
      walk(JSON.parse(buf.subarray(off + 8, off + 8 + len).toString('utf8')))
      return out
    }
    off += 8 + len
  }
  return null
}
// a drawing that says which program made it: a generator comment, an editor's namespace
const SVG_TOOL = new RegExp([j('<!--\\s*(Gener', 'ator|Created (with|by))'), j('Created ', 'with'), j('\\bGener', 'ator\\b'), j('inks', 'cape'), j('sodi', 'podi'), j('adobe ', 'illustrator'), j('sket', 'ch\\b')].join('|'), 'i')
const scanSvg = (file, text) => scan(file, text).concat(text.split(/\r?\n/).flatMap((line, i) => (SVG_TOOL.test(line) ? [[i + 1, 'a generator mark in a drawing']] : [])))
// a rendered image that carries text or metadata of its own (PNG text chunks, WebP EXIF or XMP)
function imageMeta(buf) {
  const found = []
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) {
    for (let off = 8; off + 12 <= buf.length;) { const len = buf.readUInt32BE(off), k = buf.toString('latin1', off + 4, off + 8); if (/^(tEXt|zTXt|iTXt|eXIf)$/.test(k)) found.push(k); off += 12 + len }
  } else if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    for (let off = 12; off + 8 <= buf.length;) { const len = buf.readUInt32LE(off + 4), k = buf.toString('latin1', off, off + 4); if (/^(EXIF|XMP )$/.test(k)) found.push(k); off += 8 + len + (len & 1) }
  }
  return found
}

test('no authorship mark in the strings of any GLB, in any SVG, and no metadata in a rendered image', () => {
  const bad = []
  for (const f of allFiles()) {
    const buf = fs.readFileSync(path.join(REPO, f))
    if (/\.glb$/i.test(f)) {
      const strings = glbStrings(buf)
      if (!strings) { bad.push(f + ' is not a readable GLB'); continue }
      for (const [n, what] of scan(f, strings.join('\n'))) bad.push(f + ' (string ' + n + ') ' + what)
    } else if (/\.svg$/i.test(f)) {
      for (const [n, what] of scanSvg(f, buf.toString('utf8'))) bad.push(f + ':' + n + ' ' + what)
    } else if (/\.(png|webp)$/i.test(f)) {
      for (const k of imageMeta(buf)) bad.push(f + ' carries a ' + k.trim() + ' chunk')
    }
  }
  assert.deepEqual(bad.slice(0, 40), [], bad.length + ' asset problem(s)')
})

test('every shipped office character names its build as the generator', () => {
  const dir = path.join(REPO, 'tools', 'characters')
  const files = fs.readdirSync(dir).filter((f) => /^person-[\w-]+\.glb$/.test(f))
  assert.ok(files.length >= 2, 'the shipped set is there')
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f)), len = buf.readUInt32LE(12)
    assert.equal(JSON.parse(buf.subarray(20, 20 + len).toString('utf8')).asset.generator, 'Arsenale character build', f)
  }
})

test('the asset guard fails on a planted mark in a GLB, a drawing and an image', () => {
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0', generator: j('Gener', 'ated with'), copyright: j('This model was writ', 'ten by Clau', 'de.') }, nodes: [{ name: 'Body' }] }), 'utf8')
  const pad = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)])
  const head = Buffer.alloc(20); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + pad.length, 8); head.writeUInt32LE(pad.length, 12); head.writeUInt32LE(0x4e4f534a, 16)
  const strings = glbStrings(Buffer.concat([head, pad]))
  assert.deepEqual(scan('x.glb', strings.join('\n')).map(([, what]) => what), ['a tool footer', 'a by-line naming an assistant'])
  assert.deepEqual(scanSvg('x.svg', '<svg>\n<!-- ' + j('Gener', 'ator: a drawing program') + ' -->\n</svg>').map(([n, what]) => n + ' ' + what), ['2 a generator mark in a drawing'])
  assert.deepEqual(scanSvg('x.svg', '<svg><rect/></svg>'), [])
  const chunk = (k, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(k, 4, 'latin1'); d.copy(b, 8); return b }
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.alloc(13)), chunk('tEXt', Buffer.from('Software\0x')), chunk('IEND', Buffer.alloc(0))])
  assert.deepEqual(imageMeta(png), ['tEXt'])
})

test('the old Arabic-script guards in the page tests stay English-only checks', () => {
  // the tests that look for Arabic script build their range from numbers; none holds a literal
  for (const f of ['language.test.cjs', 'version-run-page.test.cjs']) {
    const text = fs.readFileSync(path.join(__dirname, f), 'utf8')
    assert.ok([...text].every((ch) => !isArabicScript(ch.codePointAt(0))), f)
  }
})
