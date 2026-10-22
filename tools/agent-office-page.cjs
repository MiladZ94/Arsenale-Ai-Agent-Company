/* The office view of the agent dashboard: an isometric pixel office where
 * every agent owns a desk in a department. Working agents type at their desk
 * under a speech bubble, agents who handed something in today rest in the
 * lounge, reports land in the supervisor's in-tray, and the drawer at the
 * bottom opens today's shift board (one lane per agent, time right to left).
 *
 * build-agent-dashboard.cjs reads the records and calls renderOffice(). The
 * page itself is drawn in the browser by officeClient(), from the same state
 * the server's api/state returns, so it can redraw on every poll and move the
 * clock (elapsed time, "quiet for 10 minutes") without new data.
 *
 * On the live page, with WebGL, the floor is drawn in 3D instead: office3d
 * from office-world.cjs (shared with Arsenale) draws walled zone rooms, a
 * desk and a figure per run, a lounge for the idle and a side list, from the
 * same state (scene3d in pages/office/client). The flat office stays as the
 * fallback, and is what the built file always shows.
 *
 * officeClient is never run in Node: its source is written into the page.
 * Keep it free of anything that only exists in Node.
 *
 * The office is one of three views. The rail "waiting for you" and the other
 * two views (decisions and gates, tools and usage) come from controlRoom().
 *
 * Language: English only (tools/dashboard-strings.cjs). The shell text and
 * the browser code both go through T(key), which returns the English text;
 * see the bottom of renderOffice() for how LANG and T get into the page.
 *
 * The code is in pages/office/ (render, style, home-desks, control-room, client);
 * this file keeps the require path the rest of Arsenale uses.
 */
const { renderOffice } = require('./pages/office/render.cjs')
const { homeDesks } = require('./pages/office/home-desks.cjs')
const { OFFICE_STYLE, CR_STYLE } = require('./pages/office/style.cjs')
const { controlRoom } = require('./pages/office/control-room.cjs')
const { officeClient } = require('./pages/office/client.cjs')

module.exports = { renderOffice, officeClient, controlRoom, OFFICE_STYLE, CR_STYLE, homeDesks }
