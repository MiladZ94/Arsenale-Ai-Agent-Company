/* The look of the company's world: the campus and the office floor.
 *
 * One copy, here (with tools/vendor/three/ and tools/characters/default.glb);
 * see tools/OFFICE-WORLD-NOTE.md. Keep this file free of any one company's
 * names, offices or people: it is public.
 *
 * Three parts:
 *  - campusArt(h): the campus, light isometric white buildings standing on
 *    the ground grid, one paved plot per office, the office's card above its
 *    building, zoom and pan. No shadows anywhere.
 *    It draws what the page hands it; counting work, money and budgets stays
 *    in the page (companyViews).
 *  - office3d(h): the office floor in three.js r184, a room on the ground:
 *    a work station per person round the supervisor's station, a lounge
 *    where idle people rest, a reception, walls with windows and the project
 *    screens. People walk between them as their state changes (lounge ->
 *    supervisor -> desk -> supervisor -> lounge). A portrait card above each
 *    desk shows the person's state; the handed-in tray is on the supervisor's
 *    desk; the camera pans, orbits and zooms and survives every redraw.
 *    Returns null when three.js or WebGL is not there, and the page keeps its
 *    flat office.
 *  - worldScripts(opts), in Node: the pinned three.js files and the
 *    characters, inlined into the page as <script> blocks (the dashboards'
 *    servers serve pages and JSON only, and the pages load nothing from a CDN).
 *
 * campusArt and office3d are never run in Node: like the pages' own client
 * code their source is written into the page, so they may use only what a
 * browser has, plus the page's globals T(key), LANG, THREE and THREE_ADDONS.
 * Every font is Arial (the house rule), canvas text included.
 *
 * The code is in pages/world/ (style, campus, office3d, scripts); this file keeps the
 * one require path the pages use.
 */
// Dropped from the require cache with this file, so a changed drawing shows on the next reload.
for (const k of Object.keys(require.cache)) if (k.includes(require('path').join('tools', 'pages'))) delete require.cache[k]
const { FONT, WORLD_STYLE } = require('./pages/world/style.cjs')
const { campusArt } = require('./pages/world/campus.cjs')
const { office3d } = require('./pages/world/office3d.cjs')
const { worldScripts, VENDOR_FILES } = require('./pages/world/scripts.cjs')

module.exports = { FONT, WORLD_STYLE, campusArt, office3d, worldScripts, VENDOR_FILES }
