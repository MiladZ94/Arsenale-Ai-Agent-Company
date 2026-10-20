const path = require('path')
const { clientFunction } = require('../source.cjs')

/* ======================================================================
 * The office floor in 3D (Arsenale office v3: a room on the ground, no shadows).
 *
 * h: { esc, digits, calm(), onPick(id), onView(view), characters: { default,
 *      byAgent } (base64 GLB), onLost() }.
 * The page calls sync(model) on every redraw. Nothing in sync touches the
 * camera except a change of office (model.key) or the first layout; the
 * page's 1.5 s poll therefore never moves the view.
 *
 * model: { key, view (saved view or null), selected (podium id),
 *          title (the office's name, on the reception), supLabel (the
 *          supervisor's sign), boards: [{ title, lines: [text], bad }] (the
 *          project screens, at most three),
 *          podiums: [{ id, kind: 'desk'|'lead'|'tray', agent, state, anim,
 *            shirt, hair, skin, name, sub, glyph, attrs, aria, present,
 *            count (tray) }],
 *          links: [[fromId, toId]],
 *          overlay: html whose elements carry data-anchor="<podium id>" and
 *            data-at="head" | "card" | "tray" | "mid" (with data-anchor2) }
 * ====================================================================== */
// The body is in office3d/part*.js, joined by clientFunction (pages/source.cjs).
const office3d = clientFunction(path.join(__dirname, 'office3d'), 'office3d(h)', ['part1.js', 'part2.js', 'part3.js'])

module.exports = { office3d }
