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

test('the old Arabic-script guards in the page tests stay English-only checks', () => {
  // the tests that look for Arabic script build their range from numbers; none holds a literal
  for (const f of ['language.test.cjs', 'version-run-page.test.cjs']) {
    const text = fs.readFileSync(path.join(__dirname, f), 'utf8')
    assert.ok([...text].every((ch) => !isArabicScript(ch.codePointAt(0))), f)
  }
})
