const { t, langScript } = require('../../dashboard-strings.cjs')
const { STYLE } = require('./style.cjs')
const { SCRIPT } = require('./script.cjs')

/** The archive: every run ever recorded, with filters and usage.
 *  `live` swaps the self-reloading file for server polling. */
function renderArchive(state, opts = {}) {
  const live = !!opts.live
  // English is the only language (dashboard-strings.cjs); opts.lang is not read
  const lang = 'en'
  const T = (key) => t(lang, key)
  const dir = 'ltr'
  // "<" escaped, so a task description containing markup can never break out
  // of the script tag.
  const data = JSON.stringify(state).replace(/</g, '\\u003c')
  const refresh = live ? '' : `<meta http-equiv="refresh" content="${state.active.length ? 4 : 15}" />`
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${refresh}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Crect width=%2716%27 height=%2716%27 rx=%273%27 fill=%27%230A0F14%27/%3E%3Crect x=%273%27 y=%273%27 width=%2710%27 height=%2710%27 fill=%27%233BE8B0%27/%3E%3C/svg%3E" />
<title>Arsenale · ${T('Archive')}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <div class="shell-prompt"><span class="u">user@host</span><span class="d">:</span><span class="p">~/agents</span><span class="d">$</span> <span class="cmd">watch --agents</span></div>
  <header>
    <h1>Arsenale · ${T('Archive')}<span class="cursor" aria-hidden="true">▌</span></h1>
    ${live ? '<span class="mode" id="mode">' + T('● Live') + '</span>' : ''}
    <span class="built" id="built"></span>
    <a class="chip agent-chip" style="text-decoration:none" href="${live ? './' : 'agent-dashboard.html'}">${T('Today’s office ←')}</a>
  </header>
  <p class="lede">${T('Every task ever given to an agent: what was asked, which model did it, and what came back.')}</p>

  <div class="tiles" id="tiles"></div>

  <h2>${T('Usage stats')}</h2>
  <div id="stats"></div>

  <h2>${T('Running right now')}</h2>
  <div id="live"></div>
  <p class="note">${live
    ? T('Refreshes every 1.5 seconds.')
    : T('This page refreshes itself every few seconds and is rebuilt on every logged event.')}</p>

  <h2>${T('Runs done')}</h2>
  <div class="controls">
    <input id="q" type="search" placeholder="${T('Search tasks, files and findings…')}" aria-label="${T('Search')}" />
    <select id="agent" aria-label="${T('Filter by agent')}"><option value="">${T('All agents')}</option></select>
    <select id="project" aria-label="${T('Filter by project')}"><option value="">${T('All projects')}</option></select>
    <select id="status" aria-label="${T('Filter by result')}">
      <option value="">${T('Any result')}</option>
      <option value="ok">${T('No issues')}</option>
      <option value="findings">${T('Has findings')}</option>
      <option value="failed">${T('Failed')}</option>
      <option value="stopped">${T('Stopped')}</option>
    </select>
  </div>
  <div class="runs" id="runs"></div>
  <div id="pager"></div>

  <h2>${T('Agents defined')}</h2>
  <div class="agents" id="agents"></div>
  <p class="note">${T('Agents are Markdown files; shared rules are in <code>AGENT-RULES.md</code>.')}</p>
</div>

<script>
let DATA = ${data};
const LIVE = ${live};
${langScript(lang, live)}
${SCRIPT}
</script>
</body>
</html>
`
}

module.exports = { renderArchive }
