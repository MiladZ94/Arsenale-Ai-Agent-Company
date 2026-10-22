/* Who looks like whom, in the page (see pages/world/people.cjs: the function
 * is written into the page like everyoneArt is, so it uses only what the
 * browser has).
 *
 * A person's seed (their id, or id + ':' + the look they picked) picks one
 * character of the shipped set, and the office they sit in picks the shirt.
 * The 3D office, the campus, the flat office and every list ask this one
 * function, so the same person looks the same on every screen and in every
 * browser. The supervisor is always the plain mannequin.
 *
 * `names`: the character names (person-<name>.glb); `themes`: the named
 * office colours; `images`: { 'p-<name>-<colour>': data URL } of the rendered
 * portraits and strips (empty when the sprite files are missing, and then
 * every caller keeps its pixel people). */
function officeLook(names, themes, images) {
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
  const rgb = (hex) => { const n = parseInt(String(hex || '').slice(1), 16); return isNaN(n) ? [138, 151, 166] : [n >> 16, (n >> 8) & 255, n & 255] }
  const urls = new Map()
  /** The character name for a seed. */
  const variant = (seed) => (/^supervisor(:|$)/.test(String(seed)) ? 'plain' : names[hash(seed) % names.length])
  /** The named office colour nearest to a colour, so a colour that is not one of the themes still has a shirt. */
  const nearest = (hex) => {
    const c = rgb(hex); let best = '', bd = Infinity
    for (const k of Object.keys(themes)) { const t = rgb(themes[k]), d = (t[0] - c[0]) ** 2 + (t[1] - c[1]) ** 2 + (t[2] - c[2]) ** 2; if (d < bd) { bd = d; best = k } }
    return best
  }
  /** The address of a rendered image ('p' portrait, 's' strip of five frames), or null when there is none. */
  const url = (kind, seed, hex) => {
    const key = kind + '-' + variant(seed) + '-' + nearest(hex), data = images && images[key]
    if (!data) return null
    if (!urls.has(key)) {
      try {
        const bin = atob(data.slice(data.indexOf(',') + 1)), u = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
        urls.set(key, URL.createObjectURL(new Blob([u], { type: 'image/webp' })))
      } catch (e) { urls.set(key, data) }
    }
    return urls.get(key)
  }
  return { names, hash, variant, nearest, url }
}

module.exports = { officeLook }
