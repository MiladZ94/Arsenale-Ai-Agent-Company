/* Setup for autonomous version runs: `arsenale init`, `arsenale autonomous
 * start|status|resume` and `arsenale awake start|stop` (spec autonomous-mode
 * 5.11, 5.13, 5.14). Files only, plus one optional OS no-sleep helper that is
 * named in awakePlan(). Starts no agent. Nothing here reads a path outside the
 * Arsenale folder, the project folder, the data folder and the agent folder
 * of the user's tool.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { spawnSync, spawn } = require('child_process')

const ROOT = path.join(__dirname, '..')
const home = () => path.resolve(process.env.ARSENALE_HOME || path.join(os.homedir(), '.arsenale'))
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
const atomicWrite = (f, text) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  const tmp = f + '.' + process.pid + '.tmp'
  fs.writeFileSync(tmp, text)
  fs.renameSync(tmp, f)
}

function opt(args, name) {
  const i = args.indexOf(name)
  if (i < 0) return undefined
  const v = args[i + 1]
  const has = v !== undefined && !v.startsWith('--')
  args.splice(i, has ? 2 : 1)
  return has ? v : true
}
function flag(args, name) { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true }

/** Asks on the terminal. With no terminal the answer is no, unless --yes. */
function makeAsk(yes, out, dry) {
  return (q) => {
    if (dry) { out(q + ' [dry run: would ask]'); return true }
    if (yes) { out(q + ' [y/N] y (--yes)'); return true }
    if (!process.stdin.isTTY) { out(q + ' [y/N] no terminal to ask on: skipped (use --yes to accept)'); return false }
    process.stdout.write(q + ' [y/N] ')
    const buf = Buffer.alloc(64)
    let n = 0
    try { n = fs.readSync(0, buf, 0, 64, null) } catch { /* closed */ }
    return /^y/i.test(buf.toString('utf8', 0, n).trim())
  }
}

/** Copies src files into dst, one by one. Never replaces a file the user
 *  edited: a file is replaced only when it still equals what a previous run
 *  wrote (recorded in the data folder) or when --force is given (then backed
 *  up first). */
function installTree(srcRoot, dstRoot, rec, o) {
  const res = { added: 0, updated: 0, same: 0, kept: [] }
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])
  for (const f of walk(srcRoot).sort()) {
    const dst = path.join(dstRoot, path.relative(srcRoot, f))
    const body = fs.readFileSync(f)
    const h = sha(body)
    if (!fs.existsSync(dst)) {
      o.log('  add      ' + dst); res.added++
      if (!o.dry) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, body); rec[dst] = h }
      continue
    }
    const cur = sha(fs.readFileSync(dst))
    if (cur === h) { res.same++; if (!o.dry) rec[dst] = h; continue }
    if (cur === rec[dst] || o.force) {
      if (cur !== rec[dst] && !o.dry) {
        const b = path.join(o.backups, path.relative(path.parse(dst).root, dst))
        fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(dst, b)
      }
      o.log('  replace  ' + dst); res.updated++
      if (!o.dry) { fs.writeFileSync(dst, body); rec[dst] = h }
    } else res.kept.push(dst)
  }
  return res
}

/* ------------------------------------------------------------------ init */

const localDate = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

function sectionOf(text, heading) {
  const re = new RegExp('^## ' + heading.replace(/[()]/g, '\\$&') + '[ \\t]*$', 'm')
  const m = re.exec(text)
  if (!m) return null
  const rest = text.slice(m.index)
  const next = rest.slice(m[0].length).search(/^## /m)
  return next < 0 ? rest : rest.slice(0, m[0].length + next)
}

function git(dir, args) { const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', windowsHide: true }); return r.error ? null : r }

function init(argv, out) {
  const args = argv.slice()
  const dry = flag(args, '--dry-run'), yes = flag(args, '--yes') || flag(args, '-y'), force = flag(args, '--force')
  const dir = path.resolve(opt(args, '--dir') || process.cwd())
  const claudeDir = path.resolve(opt(args, '--claude-dir') || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'))
  const data = home()
  const ask = makeAsk(yes, out, dry)
  const o = { dry, force, log: out, backups: path.join(data, 'backups', 'init-' + new Date().toISOString().replace(/\D/g, '').slice(0, 17) + '-' + process.pid) }
  out('Arsenale init' + (dry ? ' (dry run: nothing is changed)' : '') + '\n  project: ' + dir + '\n  agent folder: ' + claudeDir)
  if (!fs.existsSync(dir)) { out('The folder does not exist: ' + dir); return 1 }

  // 1. agents, rules, skills, shipped autonomous files
  const recFile = path.join(data, 'init-installed.json')
  const rec = readJson(recFile, {})
  if (ask('Install the agents, rules and skills into ' + claudeDir + ' and the autonomous files into ' + data + '?')) {
    const parts = [
      [path.join(ROOT, 'agents'), path.join(claudeDir, 'agents')],
      [path.join(ROOT, 'adapters', 'claude-code', 'skills'), path.join(claudeDir, 'skills')],
      [path.join(ROOT, 'autonomous'), path.join(data, 'autonomous')],
    ]
    const kept = []
    for (const [s, d] of parts) kept.push(...installTree(s, d, rec, o).kept)
    if (!dry) atomicWrite(recFile, JSON.stringify(rec, null, 2))
    if (kept.length) { out('  kept (edited by you, use --force to replace):'); kept.forEach((k) => out('    ' + k)) }
    out('  note: for Codex or Gemini, install.sh / install.ps1 adds the instructions block.')
  } else out('  skipped.')

  // 2. git
  const g = git(dir, ['rev-parse', '--git-dir'])
  if (g === null) out('git was not found: install it, worktrees need it.')
  else if (g.status !== 0) {
    if (ask('This folder is not a git repo. Run git init?')) { if (!dry) git(dir, ['init']); out(dry ? '  would run git init' : '  git init') }
    else out('  not a git repo: autonomous runs need one.')
  } else if (git(dir, ['rev-parse', '--verify', 'HEAD']).status !== 0) {
    if (ask('The repo has no commit yet (worktrees need one). Make an empty first commit?')) {
      if (dry) out('  would make an empty first commit')
      else {
        const c = git(dir, ['-c', 'user.name=Arsenale', '-c', 'user.email=arsenale@localhost', 'commit', '--allow-empty', '-m', 'Start'])
        if (c && c.status === 0) out('  empty first commit')
        else out('  the first commit failed (' + String((c && (c.stderr || c.stdout)) || 'git not run').trim().split('\n')[0] + '): make one yourself before a run.')
      }
    }
  }

  // 3. PROJECT.md, REVIEW.md, docs/specs
  const tpl = fs.readFileSync(path.join(ROOT, 'agents', 'PROJECT.template.md'), 'utf8').replace(/\r\n/g, '\n')
  const pkg = readJson(path.join(dir, 'package.json'), {})
  const name = String(pkg.name || path.basename(dir))
  const projectMd = path.join(dir, 'PROJECT.md')
  if (!fs.existsSync(projectMd)) {
    if (ask('Create PROJECT.md from the template?')) {
      let t = tpl.replace('<app name>', () => name + ' (to confirm)').replace('<YYYY-MM-DD>', () => localDate())
      if (pkg.scripts && pkg.scripts.test) t = t.replace('| Full | <e.g. `npm test`> |', '| Full | `npm test` (to confirm) |')
      out('  create   ' + projectMd); if (!dry) atomicWrite(projectMd, t)
    }
  } else {
    const cur = fs.readFileSync(projectMd, 'utf8')
    const missing = ['Test suites', 'Owner gates (autonomous mode)'].filter((h) => sectionOf(cur.replace(/\r\n/g, '\n'), h) === null)
    if (!missing.length) out('  PROJECT.md already has the sections.')
    else {
      out('  PROJECT.md is missing: ' + missing.join(', '))
      if (ask('Append them to PROJECT.md?')) {
        const add = missing.map((h) => sectionOf(tpl, h).replace(/\s+$/, '')).join('\n\n')
        if (!dry) atomicWrite(projectMd, cur.replace(/\s+$/, '') + '\n\n' + add + '\n')
        out('  append   ' + missing.join(', '))
      }
    }
  }
  const reviewMd = path.join(dir, 'REVIEW.md')
  if (!fs.existsSync(reviewMd) && ask('Create REVIEW.md from the template?')) {
    out('  create   ' + reviewMd)
    if (!dry) atomicWrite(reviewMd, fs.readFileSync(path.join(ROOT, 'agents', 'REVIEW.template.md'), 'utf8').replace('<app name>', () => name))
  }
  const specs = path.join(dir, 'docs', 'specs')
  if (!fs.existsSync(specs) && ask('Create docs/specs for the version lists?')) {
    out('  create   ' + specs)
    if (!dry) { fs.mkdirSync(specs, { recursive: true }); fs.writeFileSync(path.join(specs, '.gitkeep'), '') }
  }
  out('Next: arsenale autonomous start <version>')
  return 0
}

/* ------------------------------------------------------- autonomous start */

const VERSION_RE = /^[A-Za-z0-9][\w.-]{0,29}$/ // no ".", ".." or leading "-" in a file name
const SEMVER_LIKE = /^\d+(\.\d+){0,2}([-.][\w.]+)?$/ // 1, 1.2, 1.2.3, 1.2.3-beta.1
const slug =(s) => String(s).toLowerCase().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'app'

function runPaths(dir, version) {
  const app = (readJson(path.join(dir, 'package.json'), {}).name) || path.basename(dir)
  return { app, runId: slug(app) + '-' + version, stateFile: path.join(dir, 'docs', 'specs', version + '-list.md'), branch: 'auto/' + version + '/integration' }
}

function register(p, version, status, budget) {
  const input = { id: p.runId, app: p.app, version, stateFile: 'docs/specs/' + version + '-list.md', integrationBranch: p.branch }
  if (status) input.status = status
  if (budget) input.budget = budget
  return require('./runlog.cjs').versionRun(input, null)
}

function autonomous(argv, out) {
  const args = argv.slice()
  const sub = args.shift()
  const dir = path.resolve(opt(args, '--dir') || process.cwd())
  const version = args.shift()
  if (!['start', 'status', 'resume'].includes(sub) || !version) { out('usage: arsenale autonomous start|status|resume <version> [--dir <repo>]'); return 1 }
  if (!VERSION_RE.test(version)) { out('The version may use letters, digits, dot, dash and underscore only.'); return 1 }
  if (sub === 'start' && !SEMVER_LIKE.test(version)) { out('The version must look like 1.2 or 1.2.3 or 1.2.3-beta.1: "' + version + '" is not a version number.'); return 1 }
  const p = runPaths(dir, version)
  const rel = 'docs/specs/' + version + '-list.md'
  if (sub === 'start') {
    let budget = 2000000
    if (fs.existsSync(p.stateFile)) out(rel + ' already exists: left as it is.')
    else {
      const bud = readJson(path.join(ROOT, 'autonomous', 'budget-defaults.json'), {})
      if (Number.isSafeInteger(bud.defaultVersionBudget) && bud.defaultVersionBudget > 0) budget = bud.defaultVersionBudget
      const t = fs.readFileSync(path.join(ROOT, 'autonomous', 'version-list.template.md'), 'utf8')
        .replace(/\{\{VERSION\}\}/g, () => version).replace(/\{\{APP\}\}/g, () => p.app).replace(/\{\{RUN_ID\}\}/g, () => p.runId)
        .replace(/\{\{BRANCH\}\}/g, () => p.branch).replace(/\{\{BUDGET\}\}/g, () => String(budget))
      atomicWrite(p.stateFile, t)
      out('created ' + rel)
    }
    // an existing mirror keeps its status and budget; only a missing one is made
    if (!readJson(path.join(home(), 'version-runs', p.runId + '.json'), null)) register(p, version, 'planning', budget)
    out('version run: ' + p.runId)
    out('Next step for the supervisor: read WORKFLOW.md "Autonomous mode", then run the planning checklist (autonomous/planning-checklist.md) and fill ' + rel + '. Start building only after the owner says the run may start.')
    return 0
  }
  if (!fs.existsSync(p.stateFile)) { out('No state file ' + rel + ' in ' + dir + ': run "arsenale autonomous start ' + version + '" first.'); return 1 }
  const text = fs.readFileSync(p.stateFile, 'utf8').replace(/\r\n/g, '\n')
  const status = (/^- Status:\s*(.+)$/m.exec(text) || [])[1] || 'unknown'
  if (sub === 'status') {
    out('version run: ' + p.runId + '\nstatus: ' + status + '\nbudget: ' + ((/^- Budget:\s*(.+)$/m.exec(text) || [])[1] || 'unknown'))
    const ph = (sectionOf(text, 'Phase plan') || '').split('\n').filter((l) => /^\| P\d/.test(l))
    out('phases: ' + (ph.length ? '' : 'none'))
    ph.forEach((l) => out('  ' + l.split('|').map((c) => c.trim()).filter(Boolean).join('  ')))
    const gates = (sectionOf(text, 'Open owner gates') || '').split('\n').slice(1).join(' ').trim()
    out('open gates: ' + (gates || 'none'))
    return 0
  }
  const known = ['planning', 'running', 'waiting for owner', 'stopped', 'blocked', 'done']
  const s = status.toLowerCase()
  register(p, version, known.includes(s) ? s : undefined)
  out('version run re-registered: ' + p.runId + ' (status: ' + status + ')')
  orphans(p.runId, out)
  out('Next step for the supervisor: read ' + rel + ', run "arsenale answers" and "arsenale inbox", then continue from the first phase that is not merged and gated.')
  return 0
}

/** Runs of this version still marked as going: one whose recorded PID is gone
 *  is closed as stopped (by PID, never by name); a live one is left alone, and
 *  so is one with no PID, which cannot be judged. */
function orphans(runId, out) {
  const L = require('./runlog.cjs')
  const ACTIVE = require('./paths.cjs').ACTIVE
  let names = []
  try { names = fs.readdirSync(ACTIVE) } catch { /* none */ }
  let dead = 0, live = 0, unknown = 0
  for (const n of names.filter((x) => x.endsWith('.json'))) {
    const r = readJson(path.join(ACTIVE, n), null)
    if (!r || r.versionRun !== runId) continue
    if (!r.pid) { unknown++; continue }
    if (L.pidAlive(r.pid)) { live++; continue }
    try {
      L.finishRun({ id: r.id, agent: r.agent, task: r.task, status: 'stopped', summary: 'Process ' + r.pid + ' is gone (marked stopped by autonomous resume).' }, null)
      dead++
    } catch (e) { out('  could not close ' + r.id + ': ' + e.message) }
  }
  out('runs of this version: ' + dead + ' marked stopped (process gone), ' + live + ' still alive, ' + unknown + ' without a recorded PID (left as they are)')
}

/* ----------------------------------------------------------------- awake */

/** The one command that keeps the machine awake while a PID lives, or null
 *  where Arsenale has no safe way. macOS: caffeinate (ships with the OS).
 *  Linux: systemd-inhibit around "tail --pid", which ends when the PID ends.
 *  Windows: none; a hidden helper that calls the power API is exactly what
 *  security tools flag, so it is a documented manual step instead. */
function awakePlan(platform, pid) {
  if (platform === 'darwin') return { cmd: 'caffeinate', args: ['-i', '-w', String(pid)] }
  if (platform === 'linux') return { cmd: 'systemd-inhibit', args: ['--what=idle:sleep', '--who=arsenale', '--why=autonomous run', 'tail', '--pid=' + pid, '-f', '/dev/null'] }
  return null
}
const isAlive = (pid) => { try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } }
/** The command line of a PID (macOS and Linux only, where awake works), or null. */
const inspectPid = (pid) => {
  const r = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8', windowsHide: true })
  return r.error || r.status !== 0 ? null : r.stdout.trim() || null
}

function awake(argv, out, deps) {
  const d = Object.assign({ platform: process.platform, spawn, alive: isAlive, inspect: inspectPid }, deps)
  const args = argv.slice()
  const sub = args.shift()
  const file = path.join(home(), 'awake.json')
  const rec = readJson(file, null)
  if (sub === 'stop') {
    if (!rec) { out('Not holding the machine awake.'); return 0 }
    // only the holder this command started: a PID can be reused by an
    // unrelated process, so the live command line must still be the helper
    // watching the recorded PID
    if (rec.holder && d.alive(rec.holder)) {
      const cmdline = d.inspect(rec.holder)
      if (cmdline && cmdline.includes(String(rec.via)) && cmdline.includes(String(rec.watching))) { try { process.kill(rec.holder) } catch { /* gone meanwhile */ } }
      else out('Process ' + rec.holder + ' is not the helper any more: left running.')
    }
    try { fs.unlinkSync(file) } catch { /* already gone */ }
    out('Released.'); return 0
  }
  if (sub !== 'start') { out('usage: arsenale awake start [--pid N] | stop'); return 1 }
  const pidArg = opt(args, '--pid')
  const pid = pidArg === undefined ? process.ppid : Number(pidArg)
  if (!Number.isInteger(pid) || pid < 1) { out('--pid needs a process id.'); return 1 }
  const plan = awakePlan(d.platform, pid)
  if (!plan) {
    out('Arsenale cannot hold Windows awake by itself. Before an overnight run, set Settings > System > Power > "Screen and sleep" to Never, and set it back afterwards.')
    return 1
  }
  if (rec && rec.holder && d.alive(rec.holder)) { out('Already holding (holder ' + rec.holder + ', watching ' + rec.watching + ').'); return 0 }
  let child
  try { child = d.spawn(plan.cmd, plan.args, { stdio: 'ignore', detached: true, windowsHide: true }) } catch (e) { out('Could not start ' + plan.cmd + ': ' + e.message); return 1 }
  if (!child || !child.pid) { out('Could not start ' + plan.cmd + '.'); return 1 }
  if (child.on) child.on('error', () => { /* tool missing: "awake stop" clears the record */ })
  if (child.unref) child.unref()
  atomicWrite(file, JSON.stringify({ holder: child.pid, watching: pid, since: new Date().toISOString(), via: plan.cmd }, null, 2))
  out('Holding the machine awake while process ' + pid + ' lives (' + plan.cmd + ' ' + child.pid + '). Release with: arsenale awake stop')
  return 0
}

module.exports = { init, autonomous, awake, awakePlan, installTree, sectionOf }
