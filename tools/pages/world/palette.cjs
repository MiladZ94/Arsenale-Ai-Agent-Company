/* The colours of the people and the rooms, one table for the campus, the
 * office and the tests. The page receives it as WORLD_PALETTE (render.cjs).
 *
 * ROLE is the body colour of a person by zone: white initials sit on it, so
 * every entry keeps a contrast of at least 4.5:1 with white (WCAG AA for
 * normal text); tools/test/office-layout.test.cjs checks it. TINT is the floor
 * of the zone's room; LABEL its name. STATE is how a state looks: the badge
 * fill (white number on it, at least 4.5:1 as well) and the badge SHAPE, so
 * a state is never told by colour alone. */
const ROLE = {
  lead: '#2F5FB3', plan: '#2F5FB3', build: '#B45309', review: '#1F7A57', verify: '#1F7A57', docs: '#0F766E', design: '#7E3FB2',
  ship: '#6B46C1', ops: '#8A4B08', data: '#0E7490', legal: '#9A3412', guest: '#5B6B7C',
}
const TINT = {
  lead: '#DCE6F6', plan: '#DCE6F6', build: '#F6E3CC', review: '#D8EEE2', verify: '#D8EEE2', docs: '#D5ECE9', design: '#E9DDF4',
  ship: '#E4DDF4', ops: '#F1E4CF', data: '#D3EBF1', legal: '#F3DDD2', guest: '#E6E9ED',
}
const LABEL = {
  lead: 'Lead', plan: 'Plan', build: 'Build', review: 'Review', verify: 'Verify', docs: 'Docs', design: 'Design',
  ship: 'Ship', ops: 'Ops', data: 'Data', legal: 'Legal', guest: 'Guest',
}
// shape: circle, diamond, square, triangle, ring
const STATE = {
  working: { fill: '#19795A', word: 'Working', shape: 'circle' },
  quiet: { fill: '#5B6B7C', word: 'Quiet', shape: 'triangle' },
  waiting: { fill: '#B45309', word: 'Waiting', shape: 'diamond' },
  failed: { fill: '#C62828', word: 'Failed', shape: 'square' },
  findings: { fill: '#B45309', word: 'Findings', shape: 'diamond' },
  stopped: { fill: '#5B6B7C', word: 'Stopped', shape: 'square' },
  done: { fill: '#2F5FB3', word: 'Done', shape: 'ring' },
}

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255) }
/** WCAG contrast ratio of two #rrggbb colours. */
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

const WORLD_PALETTE = { ROLE, TINT, LABEL, STATE }

module.exports = { ROLE, TINT, LABEL, STATE, WORLD_PALETTE, contrast }
