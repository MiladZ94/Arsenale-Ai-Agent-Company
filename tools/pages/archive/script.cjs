const SCRIPT = `
const STATUS = {
  ok: T('No issues'), findings: T('Has findings'), failed: T('Failed'), stopped: T('Stopped'),
};
// the bracketed terminal-style code shown on each status chip; STATUS above still
// feeds the status filter dropdown.
const STATUS_CODE = { ok: T('OK'), findings: T('FINDINGS'), failed: T('FAILED'), stopped: T('STOPPED') };
const el = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-GB'); };
// digits with a thousands separator (155,703).
const fmt = (n) => (n || 0).toLocaleString('en-US');

function took(ms) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm' + (s % 60 ? ' ' + (s % 60) + 's' : '');
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}

function tiles() {
  const flagged = DATA.runs.filter((r) => r.status === 'findings' || r.status === 'failed');
  const time = DATA.runs.reduce((a, r) => a + (r.durMs || 0), 0);
  const items = [
    [T('RUNNING'), T('Running'), DATA.active.length, DATA.active.length ? 'live' : ''],
    [T('DONE'), T('Runs done'), DATA.runs.length, ''],
    [T('AGENTS'), T('Agents defined'), DATA.agents.length, ''],
    [T('FINDINGS'), T('Runs with findings'), flagged.length, flagged.length ? 'alert' : ''],
    [T('TIME'), T('Time spent'), took(time) || '0', ''],
  ];
  el('tiles').innerHTML = items.map(([key, label, value, kind]) =>
    '<div class="tile ' + kind + '"><span class="tile-key">[ ' + key + ' ]</span><b>' + esc(typeof value === 'number' ? fmt(value) : value) + '</b><span class="tile-label">' + esc(label) + '</span></div>').join('');
}

/** Everything the usage section shows, recomputed from the given runs each
 *  render — the caller narrows this to one project when that filter is set,
 *  so the whole stats section scopes with it. */
function computeStats(runs) {
  const now = new Date();
  const isToday = (iso) => {
    const d = new Date(iso);
    return !isNaN(d) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };
  const totalTokens = runs.reduce((a, r) => a + (r.tokens || 0), 0);
  const todayTokens = runs.filter((r) => isToday(r.finishedAt)).reduce((a, r) => a + (r.tokens || 0), 0);

  const byAgent = new Map();
  for (const r of runs) {
    const k = r.agent || T('unknown');
    const e = byAgent.get(k) || { name: k, tokens: 0, runs: 0, time: 0 };
    e.tokens += r.tokens || 0; e.runs += 1; e.time += r.durMs || 0;
    byAgent.set(k, e);
  }
  const agents = [...byAgent.values()]
    .map((a) => ({ ...a, avgTokens: a.runs ? Math.round(a.tokens / a.runs) : 0, avgTime: a.runs ? Math.round(a.time / a.runs) : 0 }))
    .sort((a, b) => b.tokens - a.tokens);

  const byModel = new Map();
  for (const r of runs) {
    const label = (r.modelKey || T('unknown')) + (r.effort ? ' · ' + r.effort : '');
    const e = byModel.get(label) || { name: label, tokens: 0, runs: 0 };
    e.tokens += r.tokens || 0; e.runs += 1;
    byModel.set(label, e);
  }
  const models = [...byModel.values()].sort((a, b) => b.tokens - a.tokens);

  const byProject = new Map();
  for (const r of runs) {
    const k = r.projectKey || T('unknown');
    const e = byProject.get(k) || { name: k, runs: 0 };
    e.runs += 1;
    byProject.set(k, e);
  }
  const projects = [...byProject.values()].sort((a, b) => b.runs - a.runs);

  // Last 7 calendar days including today, oldest first, by local day boundary.
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    const tokens = runs
      .filter((r) => { const t = new Date(r.finishedAt).getTime(); return t >= start.getTime() && t < end.getTime(); })
      .reduce((a, r) => a + (r.tokens || 0), 0);
    days.push({ label: start.toLocaleDateString('en-CA', { month: '2-digit', day: '2-digit' }), tokens });
  }

  return { totalTokens, todayTokens, agents, models, projects, days };
}

/** A horizontal bar list: items already sorted, key is the value each bar's width is based on. */
function barList(items, key, extra) {
  if (!items.length) return '<div class="empty">' + T('No data.') + '</div>';
  const max = Math.max(...items.map((i) => i[key]), 1);
  return '<div class="bar-list">' + items.map((i) => {
    const pct = i[key] ? Math.max(2, Math.round((i[key] / max) * 100)) : 0;
    return '<div class="bar-row">'
      + '<span class="bar-label">' + esc(i.name) + '</span>'
      + '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%"></span></span>'
      + '<span class="bar-value">' + fmt(i[key]) + (extra ? extra(i) : '') + '</span>'
      + '</div>';
  }).join('') + '</div>';
}

function stats() {
  const project = el('project').value;
  const runs = project ? DATA.runs.filter((r) => (r.projectKey || '') === project) : DATA.runs;
  const s = computeStats(runs);
  const agentExtra = (a) => ' <span class="bar-sub">(' + fmt(a.runs) + T(' runs · avg ') + fmt(a.avgTokens)
    + T(' tokens · total time ') + (took(a.time) || T('unknown')) + T(' · avg time ') + (took(a.avgTime) || T('unknown')) + ')</span>';
  const modelExtra = (m) => ' <span class="bar-sub">(' + fmt(m.runs) + T(' runs)') + '</span>';

  const maxDay = Math.max(...s.days.map((d) => d.tokens), 1);
  const spark = '<div class="spark">' + s.days.map((d) => {
    const h = d.tokens ? Math.max(3, Math.round((d.tokens / maxDay) * 100)) : 2;
    return '<div class="spark-col">'
      + '<span class="spark-val">' + fmt(d.tokens) + '</span>'
      + '<span class="spark-bar" style="height:' + h + '%"></span>'
      + '<span class="spark-day">' + esc(d.label) + '</span>'
      + '</div>';
  }).join('') + '</div>';

  el('stats').innerHTML =
    '<div class="tiles">'
    + '<div class="tile"><span class="tile-key">[ ' + T('TOKENS') + ' ]</span><b>' + fmt(s.totalTokens) + '</b><span class="tile-label">' + T('Total tokens used (all time)') + '</span></div>'
    + '<div class="tile"><span class="tile-key">[ ' + T('TOKENS') + ' ]</span><b>' + fmt(s.todayTokens) + '</b><span class="tile-label">' + T('Tokens used today') + '</span></div>'
    + '</div>'
    + '<div class="stat-block"><h3>' + T('Tokens and time by agent') + '</h3>' + barList(s.agents, 'tokens', agentExtra) + '</div>'
    + '<div class="stat-block"><h3>' + T('Tokens and runs by model') + '</h3>' + barList(s.models, 'tokens', modelExtra) + '</div>'
    + '<div class="stat-block"><h3>' + T('Runs by project') + '</h3>' + barList(s.projects, 'runs') + '</div>'
    + '<div class="stat-block"><h3>' + T('Tokens used in the last 7 days') + '</h3>' + spark + '</div>';
}

function liveCards() {
  const box = el('live');
  if (!DATA.active.length) {
    box.innerHTML = '<div class="empty">' + T('No agent is working right now.') + '</div>';
    return;
  }
  const clock = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':'
      + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
  };
  box.innerHTML = '<div class="live-grid">' + DATA.active.map((a) => {
    const steps = a.steps && a.steps.length ? a.steps : (a.doing ? [{ at: a.startedAt, text: a.doing }] : []);
    const log = steps.length
      ? steps.map((s, i) => '<div class="term-line' + (i === steps.length - 1 ? ' now' : '') + '">'
        + '<span class="term-prompt">' + (i === steps.length - 1 ? '❯' : '$') + '</span>'
        + '<span class="term-at">' + esc(clock(s.at)) + '</span>'
        + '<span class="term-text">' + esc(s.text) + '</span></div>').join('')
      : '<div class="term-empty">' + T('Waiting for the first report from this agent…') + '</div>';
    return '<div class="live-card">'
      + '<div class="win-bar">'
      + '<span class="win-dots" aria-hidden="true"><i></i><i></i><i></i></span>'
      + '<span class="dot" aria-hidden="true"></span>'
      + '<span class="chip live-chip">' + esc(a.agent) + '</span>'
      + '<span class="live-task">' + esc(a.task) + '</span>'
      + '<span class="elapsed" data-since="' + esc(a.startedAt) + '"></span>'
      + '</div>'
      + '<div class="term" data-log="1">' + log + '</div>'
      + '<div class="kv" style="margin:0">'
      + '<span><b>' + T('Model:') + '</b> ' + esc(a.model || '—') + (a.effort ? ' (' + esc(a.effort) + ')' : '') + '</span>'
      + (a.project ? '<span><b>' + T('Project:') + '</b> ' + esc(a.project) + '</span>' : '')
      + '<span><b>' + T('Started:') + '</b> ' + esc(when(a.startedAt)) + '</span>'
      + '<span><b>' + T('Steps:') + '</b> ' + fmt(steps.length) + '</span>'
      + '</div></div>';
  }).join('') + '</div>';
  // Follow the newest line, the way a terminal does.
  document.querySelectorAll('.term[data-log]').forEach((t) => { t.scrollTop = t.scrollHeight; });
  tick();
}

function tick() {
  const now = Date.now();
  document.querySelectorAll('.elapsed').forEach((s) => {
    const started = new Date(s.dataset.since).getTime();
    s.textContent = isNaN(started) ? '' : took(Math.max(1000, now - started)) + ' so far';
  });
}

// Runs have no stored id, so this is what identifies the same run across a
// live-refresh rebuild: stable enough to keep the reader's page and open rows
// where they left them, since these three fields never change once written.
const runKey = (r) => (r.finishedAt || '') + '|' + (r.agent || '') + '|' + (r.task || '');

function card(r, open) {
  const status = Object.prototype.hasOwnProperty.call(STATUS, r.status) ? r.status : 'ok';
  const meta = [r.modelKey && r.modelKey + (r.effort ? ' · ' + r.effort : ''), r.projectKey, took(r.durMs), when(r.finishedAt)]
    .filter(Boolean).join(' · ');
  const findings = (r.findings || []).map((f) => '<li><span class="mark">!</span>' + esc(f) + '</li>').join('');
  const files = (r.files || []).map((f) => '<span class="file">' + esc(f) + '</span>').join('');
  return '<div class="run' + (open ? ' open' : '') + '">'
    + '<button class="run-head" type="button" aria-expanded="' + (open ? 'true' : 'false') + '" data-key="' + esc(runKey(r)) + '">'
    + '<span class="caret" aria-hidden="true">&lsaquo;</span>'
    + '<span class="chip status-' + status + '">[ ' + STATUS_CODE[status] + ' ]</span>'
    + '<span class="run-agent">' + esc(r.agent) + '</span>'
    + '<span class="run-task">' + esc(r.task) + '</span>'
    + '<span class="run-meta">' + esc(meta) + '</span>'
    + '</button>'
    + '<div class="run-body"' + (open ? '' : ' hidden') + '>'
    + '<div class="kv"><span><b>' + T('Model:') + '</b> ' + esc(r.model || '—') + (r.effort ? ' (' + esc(r.effort) + ')' : '') + '</span>'
    + '<span><b>' + T('Finished:') + '</b> ' + esc(when(r.finishedAt)) + '</span>'
    + (r.durMs ? '<span><b>' + T('Duration:') + '</b> ' + esc(took(r.durMs)) + '</span>' : '')
    + (r.command ? '<span><b>' + T('Command:') + '</b> <span class="file">' + esc(r.command) + '</span></span>' : '') + '</div>'
    + (r.summary ? '<p>' + esc(r.summary) + '</p>' : '')
    + (findings ? '<ul class="findings">' + findings + '</ul>' : '')
    + (files ? '<div class="files">' + files + '</div>' : '')
    + '</div></div>';
}

const PAGE_SIZE = 10;
let page = 1;
const expandedKeys = new Set();

/** Filters only — paging and the open/closed rows are handled by render(). */
function filteredRuns() {
  const q = el('q').value.trim().toLowerCase();
  const agent = el('agent').value;
  const status = el('status').value;
  const project = el('project').value;
  return DATA.runs.filter((r) => {
    if (agent && r.agent !== agent) return false;
    if (status && r.status !== status) return false;
    if (project && (r.projectKey || '') !== project) return false;
    if (!q) return true;
    return JSON.stringify(r).toLowerCase().includes(q);
  });
}

function renderPager(totalPages, total) {
  const box = el('pager');
  if (totalPages <= 1) { box.innerHTML = ''; return; }
  let html = '<div class="pager">'
    + '<button type="button" data-page="' + (page - 1) + '"' + (page === 1 ? ' disabled' : '') + '>&laquo; ' + T('Previous') + '</button>';
  for (let p = 1; p <= totalPages; p++) {
    html += '<button type="button" class="' + (p === page ? 'current' : '') + '" data-page="' + p + '">' + fmt(p) + '</button>';
  }
  html += '<button type="button" data-page="' + (page + 1) + '"' + (page === totalPages ? ' disabled' : '') + '>' + T('Next') + ' &raquo;</button>'
    + '<span class="pager-total">' + fmt(total) + T(' items') + '</span></div>';
  box.innerHTML = html;
}

function render() {
  if (!DATA.runs.length) {
    el('runs').innerHTML = '<div class="empty">' + T('No agent has done any work yet.') + '</div>';
    el('pager').innerHTML = '';
    return;
  }
  const shown = filteredRuns();
  if (!shown.length) {
    el('runs').innerHTML = '<div class="empty">' + T('Nothing matches this search.') + '</div>';
    el('pager').innerHTML = '';
    return;
  }
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = shown.slice(start, start + PAGE_SIZE);
  el('runs').innerHTML = pageItems.map((r) => card(r, expandedKeys.has(runKey(r)))).join('');
  renderPager(totalPages, shown.length);
}

/** A filter change starts the reader back at the newest page of the new list.
 *  The project filter also scopes the stats section, so redraw that too. */
function onFilterChange() {
  page = 1;
  stats();
  render();
}

function agentCards() {
  el('agents').innerHTML = DATA.agents.length
    ? DATA.agents.map((a) =>
      '<div class="agent"><div class="agent-top">'
      + '<span class="agent-name">' + esc(a.name) + '</span>'
      + '</div>'
      + '<div class="agent-flags">--model ' + esc(a.model || '—') + (a.effort ? ' --effort ' + esc(a.effort) : '') + '</div>'
      + (a.title ? '<div class="agent-title">' + esc(a.title) + '</div>' : '')
      + '<div class="agent-desc">' + esc(a.descriptionEn) + '</div></div>').join('')
    : '<div class="empty">' + T('No agent is defined yet.') + '</div>';
}

/** The agent filter keeps whatever the reader picked, even as new agents appear. */
function agentOptions() {
  const chosen = el('agent').value;
  const names = [...new Set(DATA.runs.map((r) => r.agent))].sort();
  el('agent').innerHTML = '<option value="">' + T('All agents') + '</option>'
    + names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
  if (names.includes(chosen)) el('agent').value = chosen;
}

/** Same idea, for the project filter — this is what lets one machine's
 *  dashboard cover every project, not just the one it was built for. */
function projectOptions() {
  const chosen = el('project').value;
  const names = [...new Set(DATA.runs.map((r) => r.projectKey).filter(Boolean))].sort();
  el('project').innerHTML = '<option value="">' + T('All projects') + '</option>'
    + names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
  if (names.includes(chosen)) el('project').value = chosen;
}

function renderAll() {
  // Options first: stats() and render() below both read the project filter's
  // current value, which this rebuilds without losing what the reader picked.
  agentOptions();
  projectOptions();
  tiles();
  stats();
  liveCards();
  agentCards();
  render();
  el('built').textContent = T('Updated at ') + when(DATA.builtAt);
}

renderAll();
setInterval(tick, 1000);

el('q').addEventListener('input', onFilterChange);
el('agent').addEventListener('change', onFilterChange);
el('project').addEventListener('change', onFilterChange);
el('status').addEventListener('change', onFilterChange);
el('runs').addEventListener('click', (e) => {
  const head = e.target.closest('.run-head');
  if (!head) return;
  const run = head.parentElement;
  const body = run.querySelector('.run-body');
  const open = body.hidden;
  body.hidden = !open;
  run.classList.toggle('open', open);
  head.setAttribute('aria-expanded', String(open));
  const key = head.dataset.key;
  if (open) expandedKeys.add(key); else expandedKeys.delete(key);
});
el('pager').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-page]');
  if (!btn || btn.disabled) return;
  const p = Number(btn.dataset.page);
  if (!p || p === page) return;
  page = p;
  render();
});

if (LIVE) {
  // Served by the local server: ask it for the state and redraw only when
  // something actually changed, so an opened row is not closed under the
  // reader's hands every second.
  let last = JSON.stringify([DATA.runs, DATA.active, DATA.agents]);
  let stateTag = '';
  const badge = el('mode');
  async function poll() {
    try {
      // 304 with no body while nothing changed on disk
      const res = await fetch('api/state', { cache: 'no-store', headers: stateTag ? { 'If-None-Match': stateTag } : {} });
      if (res.status !== 304 && !res.ok) throw new Error('HTTP ' + res.status);
      badge.className = 'mode';
      badge.textContent = T('● Live');
      if (res.status === 304) { el('built').textContent = T('Updated at ') + when(new Date().toISOString()); return; }
      stateTag = res.headers.get('ETag') || '';
      const fresh = await res.json();
      const now = JSON.stringify([fresh.runs, fresh.active, fresh.agents]);
      if (now === last) { el('built').textContent = T('Updated at ') + when(fresh.builtAt); return; }
      last = now;
      DATA = fresh;
      renderAll();
    } catch {
      badge.className = 'mode stale';
      badge.textContent = T('● Disconnected from server');
    }
  }
  poll();
  setInterval(poll, 1500);
} else {
  // The built file: it reloads itself, so keep the reader where they were.
  try {
    const saved = JSON.parse(sessionStorage.getItem('agent-dashboard') || '{}');
    if (saved.q) el('q').value = saved.q;
    if (saved.agent) el('agent').value = saved.agent;
    if (saved.project) el('project').value = saved.project;
    if (saved.status) el('status').value = saved.status;
    if (saved.q || saved.agent || saved.project || saved.status) { stats(); render(); }
    if (saved.y) window.scrollTo(0, saved.y);
    window.addEventListener('beforeunload', () => {
      try {
        sessionStorage.setItem('agent-dashboard', JSON.stringify({
          q: el('q').value, agent: el('agent').value, project: el('project').value, status: el('status').value, y: window.scrollY,
        }));
      } catch { /* a private window simply forgets */ }
    });
  } catch { /* the page works without this */ }
}
`

module.exports = { SCRIPT }
