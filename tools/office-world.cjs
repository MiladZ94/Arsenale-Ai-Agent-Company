/* The look of the company's world: the campus and the office floor.
 *
 * One copy, here (with tools/vendor/three/ and tools/assets/); see
 * tools/OFFICE-WORLD-NOTE.md. Keep this file free of any one company's
 * names, offices or people: it is public.
 *
 * Parts (in pages/world/):
 *  - worldKit(): the shared three.js kit: the engine, the 12 procedural
 *    building shapes, the avatar, the desk, the asset loader.
 *  - campusArt(h): the campus board, a lot grid with one building per office,
 *    build mode with a hotbar, move, rotate and archive tools. It draws what
 *    the page hands it and asks POST api/campus for every change.
 *  - office3d(h): the office floor: walled zone rooms, a desk and a figure per
 *    run, a lounge for the idle, a side list. Returns null when three.js or
 *    WebGL is not there, and the page keeps its flat office.
 *  - WORLD_PALETTE: the role, room and state colours (palette.cjs).
 *  - worldScripts(), in Node: the pinned three.js and the asset models,
 *    inlined into the page (the dashboards' servers serve pages and JSON
 *    only, and the pages load nothing from a CDN).
 *
 * worldKit, campusArt and office3d are never run in Node: like the pages' own
 * client code their source is written into the page, so they may use only what
 * a browser has, plus the page's globals THREE, THREE_ADDONS, WORLD_PALETTE and
 * ASSET_MODELS. Every font is Arial (the house rule), canvas text included.
 */
// Dropped from the require cache with this file, so a changed drawing shows on the next reload.
for (const k of Object.keys(require.cache)) if (k.includes(require('path').join('tools', 'pages'))) delete require.cache[k]
const { FONT, WORLD_STYLE } = require('./pages/world/style.cjs')
const { campusArt } = require('./pages/world/campus.cjs')
const { office3d } = require('./pages/world/office3d.cjs')
const { worldKit } = require('./pages/world/kit.cjs')
const { WORLD_PALETTE } = require('./pages/world/palette.cjs')
const { worldScripts, VENDOR_FILES } = require('./pages/world/scripts.cjs')

module.exports = { FONT, WORLD_STYLE, campusArt, office3d, worldKit, WORLD_PALETTE, worldScripts, VENDOR_FILES }
