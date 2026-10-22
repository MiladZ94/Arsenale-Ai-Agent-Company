/* The people of the page: the look function (characters/look.cjs), the
 * rendered portraits and sprites it hands out, and the small CSS they need.
 * Live page only; a built file has none of this and keeps its pixel people. */
const fs = require('fs')
const path = require('path')

const CHAR_DIR = path.join(__dirname, '..', '..', 'characters')
const SPRITE_DIR = path.join(CHAR_DIR, 'sprites')
const cache = new Map()
function cached(file, make) {
  let st
  try { st = fs.statSync(file) } catch { return null }
  const hit = cache.get(file)
  if (hit && hit.m === st.mtimeMs && hit.s === st.size) return hit.v
  const v = make(fs.readFileSync(file))
  cache.set(file, { m: st.mtimeMs, s: st.size, v })
  return v
}
const scriptSafe = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')

/** The names of the shipped characters (person-<name>.glb), the plain one last and apart. */
function characterNames() {
  let files = []
  try { files = fs.readdirSync(CHAR_DIR) } catch { return { names: [], plain: false } }
  const all = files.map((f) => /^person-([\w-]+)\.glb$/.exec(f)).filter(Boolean).map((m) => m[1]).sort()
  return { names: all.filter((n) => n !== 'plain'), plain: all.includes('plain') }
}

/** The <script> with OFFICE_LOOK: who looks like whom, and the images. The
 *  images are the sprite files that exist; with none, OFFICE_LOOK still
 *  answers (the 3D office uses it) and gives no image. */
function characterScripts() {
  const { names } = characterNames()
  if (!names.length) return ''
  // only now: a tools folder without characters/ (a slim copy) must still build the page, with pixel people
  const { officeLook } = require('../../characters/look.cjs')
  let themes = {}
  try { themes = require('../../agent-company.cjs').THEMES } catch { /* no colours: no shirts */ }
  const images = {}
  let files = []
  try { files = fs.readdirSync(SPRITE_DIR) } catch { /* no sprites */ }
  for (const f of files) {
    const m = /^([ps]-[\w-]+)\.webp$/.exec(f)
    if (!m) continue
    const b64 = cached(path.join(SPRITE_DIR, f), (b) => b.toString('base64'))
    if (b64) images[m[1]] = 'data:image/webp;base64,' + b64
  }
  return '<script>const OFFICE_LOOK = (' + scriptSafe(officeLook.toString()) + ')(' + JSON.stringify(names) + ', ' + JSON.stringify(themes) + ', ' + JSON.stringify(images) + ');</script>'
}

const PEOPLE_STYLE = `
.ev .av img,.wz .av img{display:block}
.walker .wf{display:block;width:45px;height:45px;background-repeat:no-repeat;background-size:225px 45px;animation:wfr .52s steps(1) infinite}
@keyframes wfr{0%{background-position:-45px 0}25%{background-position:-90px 0}50%{background-position:-135px 0}75%{background-position:-180px 0}}
`

module.exports = { characterScripts, characterNames, PEOPLE_STYLE }
