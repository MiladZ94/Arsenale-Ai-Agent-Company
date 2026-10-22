/* Windows: a folder limited to this user, read back as it really is.
 *
 * The notify folder (notify.cjs) holds the phone channels' secrets. On macOS
 * and Linux its mode says who may read it; on Windows mode bits mean nothing
 * and a new folder inherits its parent's rights, which often let other
 * accounts read it. So the folder gets one entry, this user with full
 * control, inherited by every file in it (atomic writes make a new file each
 * time), and nothing inherited from above:
 *
 *   icacls <dir> /inheritance:r /grant:r <DOMAIN\user>:(OI)(CI)F
 *
 * A mark file once recorded that this was done, and was trusted from then
 * on; an ACL changed later (a restore, a copy, another tool) went unseen.
 * Now every `arsenale serve` start reads the ACL (check) and re-applies it
 * when it is wrong (ensure), and Settings shows what check reads.
 *
 * icacls is run with an argument list, no shell, hidden. Its output is in the
 * console code page and partly localised; only the entries are read: one
 * entry, for this user, (OI)(CI) and (F), none inherited ("(I)"). Anything
 * that cannot be read that way counts as not owner-only, which is the safe
 * side: the launcher re-applies, the page warns.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const MARK = '.owner-only'
const CACHE_MS = 30000
const cache = new Map()

const user = () => process.env.USERNAME || os.userInfo().username
const who = () => (process.env.USERDOMAIN ? process.env.USERDOMAIN + '\\' : '') + user()

function icacls(args) {
  try { return spawnSync('icacls', args, { encoding: 'utf8', windowsHide: true, shell: false }) } catch (e) { return { error: e } }
}
const why = (r) => String((r && r.error && r.error.message) || (r && (r.stderr || r.stdout)) || 'failed').trim()

/** The entries of one icacls listing: [{ who, flags }]. */
function entries(stdout, dir) {
  const lines = String(stdout || '').split(/\r?\n/)
  const first = lines[0] || ''
  // the first line is "<dir> <entry>", the next ones are indented entries,
  // then a blank line and a (localised) summary
  if (first.toLowerCase().indexOf(dir.toLowerCase()) !== 0) return null
  const raw = [first.slice(dir.length)]
  for (const l of lines.slice(1)) { if (!l.trim()) break; if (!/^\s/.test(l)) break; raw.push(l) }
  const out = []
  for (const r of raw.map((x) => x.trim()).filter(Boolean)) {
    const m = /^(.+?):((?:\([^)]*\))+)$/.exec(r)
    if (!m) return null
    out.push({ who: m[1], flags: m[2] })
  }
  return out
}

/** { ok, reason }: whether `dir` has exactly the owner-only entry. Off
 *  Windows always ok (the mode is checked by the caller). `cached` reuses a
 *  reading of the last 30 s, for a page that polls. */
function check(dir, opts) {
  if (process.platform !== 'win32') return { ok: true, reason: '' }
  const key = path.resolve(dir)
  const hit = cache.get(key)
  if (opts && opts.cached && hit && Date.now() - hit.at < CACHE_MS) return hit.result
  let result
  if (!fs.existsSync(key)) result = { ok: false, reason: 'no folder' }
  else {
    const r = icacls([key])
    const list = !r || r.error || r.status !== 0 ? null : entries(r.stdout, key)
    if (!list) result = { ok: false, reason: 'icacls: ' + why(r) }
    else {
      const me = who().toLowerCase(), name = '\\' + user().toLowerCase()
      const mine = (w) => w.toLowerCase() === me || w.toLowerCase().endsWith(name)
      const good = list.length === 1 && mine(list[0].who) && /\(OI\)/.test(list[0].flags) && /\(CI\)/.test(list[0].flags) && /\(F\)/.test(list[0].flags) && !/\(I\)/.test(list[0].flags)
      result = good ? { ok: true, reason: '' } : { ok: false, reason: list.length + ' entr' + (list.length === 1 ? 'y' : 'ies') + (list.some((e) => /\(I\)/.test(e.flags)) ? ', inherited' : '') }
    }
  }
  cache.set(key, { at: Date.now(), result })
  return result
}

/** Makes `dir` owner-only when check() says it is not, then reads it again.
 *  Returns { ok, applied, reason }; never throws. The mark is written when
 *  the reading is good, for older builds that look only at it. */
function ensure(dir) {
  if (process.platform !== 'win32') return { ok: true, applied: false, reason: '' }
  const key = path.resolve(dir)
  try { fs.mkdirSync(key, { recursive: true }) } catch (e) { return { ok: false, applied: false, reason: e.message } }
  let applied = false
  let now = check(key)
  if (!now.ok) {
    const r = icacls([key, '/inheritance:r', '/grant:r', who() + ':(OI)(CI)F'])
    applied = true
    cache.delete(key)
    if (!r || r.error || r.status !== 0) return { ok: false, applied, reason: 'icacls: ' + why(r) }
    // /inheritance:r only drops what is inherited: a folder whose entries
    // are its own (made where the parent passes nothing down, or copied
    // with them) keeps Users or Authenticated Users, so those go one by one
    const left = icacls([key])
    const list = !left || left.error || left.status !== 0 ? null : entries(left.stdout, key)
    const me = who().toLowerCase(), name = '\\' + user().toLowerCase()
    for (const e of list || []) {
      const w = e.who.toLowerCase()
      if (w === me || w.endsWith(name)) continue
      icacls([key, '/remove', /^S-1-[\d-]+$/i.test(e.who) ? '*' + e.who : e.who])
    }
    cache.delete(key)
    now = check(key)
  }
  if (now.ok) { try { fs.writeFileSync(path.join(key, MARK), new Date().toISOString() + '\n') } catch { /* the reading is what counts */ } }
  return { ok: now.ok, applied, reason: now.reason }
}

module.exports = { MARK, check, ensure, entries }
