/* The kinds of work (spec 1.2, rule 21): one fixed list, so routing is the
 * same for every assistant and nobody types tags. An office holds kinds; a
 * run has at most one, and goes to the office that holds it.
 *
 * `zone` is the desk zone a person's kind is taken from when nothing names
 * one (agent-company.cjs ZONES). Kinds without a zone are only ever named:
 * on an office, a task, an employee or `arsenale start`.
 *
 * Ids are stored in offices.json, run records and tasks: never rename one.
 */
const KINDS = [
  { id: 'build', label: 'Building software', zone: 'build' },
  { id: 'review', label: 'Code review', zone: 'review' },
  { id: 'verify', label: 'Testing', zone: 'verify' },
  { id: 'security', label: 'Security', zone: '' },
  { id: 'docs', label: 'Writing docs', zone: 'docs' },
  { id: 'design', label: 'Design', zone: 'design' },
  { id: 'data', label: 'Data', zone: 'data' },
  { id: 'plan', label: 'Planning', zone: 'plan' },
  { id: 'ship', label: 'Releases', zone: 'ship' },
  { id: 'ops', label: 'Operations', zone: 'ops' },
  { id: 'legal', label: 'Legal', zone: 'legal' },
  { id: 'research', label: 'Research', zone: '' },
  { id: 'content', label: 'Marketing and content', zone: '' },
  { id: 'support', label: 'Customer support', zone: '' },
  { id: 'finance', label: 'Finance', zone: '' },
  { id: 'people', label: 'People and HR', zone: '' },
]
// a Set, never an object lookup: "__proto__" or "constructor" is not a kind
const KIND_IDS = new Set(KINDS.map((k) => k.id))
const isKind = (v) => typeof v === 'string' && KIND_IDS.has(v)
const labelOf = (id) => (KINDS.find((k) => k.id === id) || { label: '' }).label
const kindOfZone = (zone) => (zone ? (KINDS.find((k) => k.zone === zone) || { id: '' }).id : '')

/** A stored list made safe to read: known ids only, each once, in list order
 *  as written. Anything else (an older or hand-edited file) reads as none. */
function cleanKinds(v) {
  if (!Array.isArray(v)) return []
  const out = []
  for (const k of v) if (isKind(k) && !out.includes(k)) out.push(k)
  return out
}

module.exports = { KINDS, KIND_IDS, isKind, labelOf, kindOfZone, cleanKinds }
