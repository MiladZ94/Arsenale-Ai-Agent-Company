const { t, langScript } = require('../../dashboard-strings.cjs')
const { COMPANY_STYLE, companyViews } = require('../../agent-company-page.cjs')
// The campus art and the 3D office (office-world.cjs, see OFFICE-WORLD-NOTE.md).
// Loaded fresh with this file, so a changed drawing shows on the next reload.
delete require.cache[require.resolve('../../office-world.cjs')]
const { WORLD_STYLE, campusArt, office3d, worldKit, WORLD_PALETTE, worldScripts } = require('../../office-world.cjs')
const { ACTIVITY_STYLE, activityView } = require('../../activity-page.cjs')
const { VR_STYLE, versionRunView } = require('../../version-run-page.cjs')
const { EVERYONE_STYLE, everyoneViews } = require('../../everyone-page.cjs')
const { outfitIndex } = require('../world/palette.cjs')
const { everyoneArt } = require('../../everyone-art.cjs')
const { homeDesks } = require('./home-desks.cjs')
const { OFFICE_STYLE, CR_STYLE } = require('./style.cjs')
const { controlRoom } = require('./control-room.cjs')
const { officeClient } = require('./client.cjs')

/** The office page. `live` swaps the self-reloading file for server polling;
 *  `token` (live only) lets the page post answers to the server. */
function renderOffice(state, opts = {}) {
  const live = !!opts.live
  // English is the only language (dashboard-strings.cjs); opts.lang is not read
  const lang = 'en'
  const T = (key) => t(lang, key)
  const dir = 'ltr'
  const data = JSON.stringify(state).replace(/</g, '\\u003c')
  const archive = live ? 'archive' : 'agent-dashboard-archive.html'
  // the server's per-start secret: only a page it served can post an answer
  const token = live && opts.token ? String(opts.token) : ''
  const refresh = live ? '' : `<meta http-equiv="refresh" content="${state.active.length ? 4 : 15}" />`
  // the company, if one is set up (agent-company.cjs companyState); without it
  // the page is the single office it always was
  // with no company yet the wizard still draws each office pack in its colour
  const company = opts.company && opts.company.configured ? opts.company : { configured: false, themes: require('../../agent-company.cjs').THEMES }
  const co = company.configured
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${refresh}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Crect width=%2716%27 height=%2716%27 rx=%273%27 fill=%27%230A0F14%27/%3E%3Crect x=%273%27 y=%273%27 width=%2710%27 height=%2710%27 fill=%27%233BE8B0%27/%3E%3C/svg%3E" />
<title>Arsenale</title>
<style>${OFFICE_STYLE}${CR_STYLE}${COMPANY_STYLE}${WORLD_STYLE}${ACTIVITY_STYLE}${VR_STYLE}${EVERYONE_STYLE}</style>
</head>
<body>
<div class="board" id="board">
  <header class="top">
    <h1${co ? ' class="co"' : ''}>Arsenale${co ? '<span class="brand-b">' + T('BOARD VIEW') + '</span>' : ''}</h1><span class="date" id="date"></span>
    <div class="views" role="group" aria-label="${T('View')}"><button type="button" data-view="campus" aria-pressed="false">${T('Campus')}</button><button type="button" data-view="office" id="vtab-office" aria-pressed="true">${T('Office')}</button>${co
      // the two views from before the company stay one release, under "More" (spec Q11)
      ? '<button type="button" data-omenu="office" id="omenu-office" aria-label="' + T('Choose an office') + '" aria-haspopup="true">▾</button><button type="button" data-view="tasks" aria-pressed="false">' + T('Tasks') + '</button><button type="button" data-view="appr" aria-pressed="false">' + T('Approvals') + '</button><button type="button" data-view="dlv" aria-pressed="false">' + T('Finished work') + '</button><button type="button" data-view="team" aria-pressed="false">' + T('Team') + '</button><button type="button" data-view="act" aria-pressed="false">' + T('Activity') + '</button><button type="button" data-view="vr" aria-pressed="false">' + T('Version run') + '</button><button type="button" data-omenu="legacy" id="omenu-legacy" aria-haspopup="true">' + T('More') + ' ▾</button>'
      : `<button type="button" data-view="appr" aria-pressed="false">${T('Approvals')}</button><button type="button" data-view="dec" aria-pressed="false">${T('Decisions & gates')}</button><button type="button" data-view="use" aria-pressed="false">${T('Tools & usage')}</button><button type="button" data-view="act" aria-pressed="false">${T('Activity')}</button><button type="button" data-view="vr" aria-pressed="false">${T('Version run')}</button><button type="button" data-view="set" aria-pressed="false">${T('Settings')}</button>`}</div>
    <ul class="counts" id="counts" aria-label="${T('Summary')}"></ul>
    <span class="live" id="mode"${live ? ' title="' + T('Refreshes every 1.5 seconds') + '"' : ''}><i></i> ${live ? T('Live') : T('Built file · refreshes automatically')}</span>
  </header>
  <div class="v-office" id="v-office">
  <aside class="insp" id="insp" aria-label="${T('Agent details')}" aria-live="polite"></aside>
  <main class="stage" id="stage" tabindex="0" aria-label="${T('Office view — mouse wheel or + and - to zoom, drag or arrow keys to pan, 0 to fit')}"><div class="stage-in" id="stage-in"></div><div class="ohead" id="ohead"></div>
    <div class="zoombar" id="zoombar" role="group" aria-label="${T('Office zoom')}"><button type="button" data-zoom="out" title="${T('Zoom out (-)')}" aria-label="${T('Zoom out')}">−</button><output id="zoomv">${T('100%')}</output><button type="button" data-zoom="in" title="${T('Zoom in (+)')}" aria-label="${T('Zoom in')}">+</button><button type="button" class="fitb" data-zoom="fit" title="${T('Fit whole office (0)')}">${T('Fit')}</button><span class="zh">${T('Mouse wheel: zoom · Drag: pan')}</span></div>
    <p class="legend" id="legend"></p></main>
  <section class="drawer" id="drawer" aria-labelledby="dr-h"></section>
  <div class="split split-v" id="split-v" role="separator" aria-orientation="vertical" aria-controls="insp" tabindex="0" title="${T('Drag to resize the panel; double-click: default size')}" aria-label="${T('Details panel width')}"></div>
  <div class="split split-h" id="split-h" role="separator" aria-orientation="horizontal" aria-controls="drawer" tabindex="0" title="${T('Drag to resize the report strip height; double-click: default size')}" aria-label="${T('Report strip height')}"></div>
  </div>
  <main class="vm" id="v-dec" aria-label="${T('Decisions & gates')}" hidden></main>
  <main class="vm" id="v-use" aria-label="${T('Tools & usage')}" hidden></main>
  <main class="vm" id="v-act" aria-label="${T('Activity')}" hidden></main>
  <main class="vm" id="v-vr" aria-label="${T('Version run')}" hidden></main>
  <main class="cv" id="v-campus" aria-label="${T('Campus')}" hidden></main>
  <main class="cv" id="v-org" aria-label="${T('Org chart')}" hidden></main>
  <main class="ev" id="v-ev" hidden></main>
  <aside class="rail" id="rail" aria-labelledby="rail-h"></aside>
  <nav class="mini-rail" id="minirail" aria-label="${T('Waiting for you, collapsed')}"></nav>
</div>
<div class="omenu" id="omenu" hidden></div>
<div class="cdlg-back" id="cdlg" hidden></div>
<div class="wiz-back" id="wiz" hidden></div>
${live ? worldScripts() : ''}
<script>
let DATA = ${data};
const LIVE = ${live};
const ARCHIVE_HREF = ${JSON.stringify(archive)};
let ANSWER_TOKEN = ${JSON.stringify(token)};
let COMPANY = ${JSON.stringify(company).replace(/</g, '\\u003c')};
const homeDesks = (${homeDesks.toString()});
${langScript(lang, live)}
const WORLD_PALETTE = ${JSON.stringify(WORLD_PALETTE)};
const outfitIndex = (${outfitIndex.toString()});
const worldKit = (${worldKit.toString()});
const campusArt = (${campusArt.toString()});
const office3d = (${office3d.toString()});
const controlRoom = (${controlRoom.toString()});
const companyViews = (${companyViews.toString()});
const activityView = (${activityView.toString()});
const versionRunView = (${versionRunView.toString()});
const everyoneArt = (${everyoneArt.toString()});
const everyoneViews = (${everyoneViews.toString()});
(${officeClient.toString()})();
</script>
</body>
</html>
`
}

module.exports = { renderOffice }
