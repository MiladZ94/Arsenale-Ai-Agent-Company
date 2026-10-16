/** Desks for whatever agents exist: { seats: {name: [zone, slot]}, zones:
 *  {name: zone} }. The zone comes from the agent's `zone:` frontmatter or its
 *  labels `dept`, else from words in its name ("…-reviewer" reviews, "ui-…"
 *  designs, "…-docs" writes), else build. Slots are handed out by name, so a
 *  desk does not move when another agent is added to a different zone. A full
 *  zone spills into the zone with the most free desks; with every desk taken an
 *  agent has no home desk and takes a guest desk while it works. Leads have no
 *  desk: an office's head sits at the round table.
 *
 *  `pinned` ({name: [zone, slot]}, config.json "desks") is placed first, so a
 *  layout someone is used to keeps its desks; a pin to a desk that does not
 *  exist or is already taken is ignored and that agent is placed as usual.
 *
 *  Shared with agent-company.cjs (an employee's default zone) and written into
 *  the page for officeClient, so it must stay a pure function. */
function homeDesks(agents, pinned) {
  const CAP = { build: 4, review: 6, docs: 4, design: 4 }
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
  const zoneOf = (a) => {
    const d = String(a.dept || '').toLowerCase()
    if (d === 'lead' || has(CAP, d)) return d
    const n = String(a.name || '').toLowerCase()
    if (/-lead$|^lead-/.test(n)) return 'lead'
    if (/^(ui|ux)-|design|spec|visual|scout|product/.test(n)) return 'design'
    if (/review|audit|secur|migrat|perform|validat|verif/.test(n)) return 'review'
    if (/doc|guide|explain|seo|writer|agent-builder/.test(n)) return 'docs'
    return 'build'
  }
  const seats = {}, zones = {}
  const taken = { build: [], review: [], docs: [], design: [] }
  const used = { build: 0, review: 0, docs: 0, design: 0 }
  const take = (name, z, i) => { seats[name] = [z, i]; taken[z][i] = true; used[z]++ }
  const firstFree = (z) => { for (let i = 0; i < CAP[z]; i++) if (!taken[z][i]) return i; return -1 }
  const spill = []
  const list = (agents || []).filter((a) => a && a.name).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))
  const pins = pinned && typeof pinned === 'object' ? pinned : {}
  for (const a of list) {
    const p = has(pins, a.name) ? pins[a.name] : null
    if (!Array.isArray(p) || !has(CAP, p[0]) || !Number.isInteger(p[1]) || p[1] < 0 || p[1] >= CAP[p[0]] || taken[p[0]][p[1]]) continue
    zones[a.name] = p[0]
    take(a.name, p[0], p[1])
  }
  for (const a of list) {
    if (has(seats, a.name)) continue
    const z = zoneOf(a)
    zones[a.name] = z
    if (z === 'lead') continue
    const i = firstFree(z)
    if (i >= 0) take(a.name, z, i)
    else spill.push(a.name)
  }
  for (const name of spill) {
    const z = Object.keys(CAP).sort((x, y) => (CAP[y] - used[y]) - (CAP[x] - used[x]))[0]
    const i = firstFree(z)
    if (i >= 0) take(name, z, i)
  }
  return { seats, zones }
}

module.exports = { homeDesks }
