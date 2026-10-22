  // ========== live: every run now, how far it is, what is stuck (spec 1.1, 4.1 to 4.4; GET api/live)
  const LIVE_QUIET_MIN = 10   // the soft "quiet" hint; the stall and dead limits come with api/live
  const SEVERITY = { working: 0, quiet: 1, stalled: 2, dead: 3 }
  const secAgo = (iso) => { const t = Date.parse(iso); return isNaN(t) ? null : Math.max(0, Math.round((Date.now() - t) / 1000)) }
  /** "12 s ago", "7 min ago", "2 h 5 min ago"; a time in the future reads as now. */
  function agoShort(iso) {
    const s = secAgo(iso)
    if (s === null) return '—'
    if (s < 60) return digits(s) + T(' s ago')
    const m = Math.floor(s / 60)
    if (m < 60) return digits(m) + T(' min ago')
    return digits(Math.floor(m / 60)) + T(' h ') + (m % 60 ? digits(m % 60) + T(' min ') : '') + T('ago')
  }
  const minsText = (m) => (m < 60 ? digits(m) + T(' min') : digits(Math.floor(m / 60)) + T(' h') + (m % 60 ? ' ' + digits(m % 60) + T(' min') : ''))
  const clockIn = (min) => hm(new Date(Date.now() + min * 60000).toISOString())
  const modelOf = (r) => { const a = (DATA.active || []).find((x) => x.id === r.id); return (a && a.model) || '' }
  const vrMirror = (id) => ((st.data.vruns && st.data.vruns.runs) || []).find((x) => x.id === id)
  const phaseName = (r) => { const m = r.versionRun && vrMirror(r.versionRun); const ph = m && (m.phases || []).find((p) => p.id === r.phase); return ph ? r.phase + ' · ' + (ph.name || '') : r.phase || '' }

  /** The two numbers of one run: a solid bar for what the agent reported, a
   *  tick for Arsenale's estimate; a hatched bar when only an estimate exists. */
  function pbar(r) {
    const rep = r.reported, est = r.estimate
    const w = rep !== null && rep !== undefined ? rep : est !== null && est !== undefined ? est : 0
    const only = (rep === null || rep === undefined) && est !== null && est !== undefined
    const num = (v) => (v === null || v === undefined ? '—' : digits(v) + ' %')
    return '<div class="pb2"><div class="bar' + (only ? ' hatch' : '') + '"><i style="width:' + w + '%"></i>' + (!only && est !== null && est !== undefined ? '<b class="tick" style="left:' + est + '%"></b>' : '') + '</div>' +
      '<div class="pn"><span class="rp">' + T('reported ') + '<b>' + num(rep) + '</b></span><span class="es">' + T('est. ') + '<b>' + num(est) + '</b></span>' + (r.differ ? '<span class="df" title="' + esc(T('The reported and the estimated percent are more than 25 points apart')) + '">' + ic('warn', 12) + '</span>' : '') + '</div></div>'
  }
  function statePill(r) {
    if (r.inQueue) return '<span class="lp q">' + ic('clock', 12) + ' ' + T('in the queue') + '</span>'
    if (r.state === 'dead') return '<span class="lp dead">' + T('dead') + '</span>'
    if (r.state === 'stalled') return '<span class="lp bad">' + ic('clock', 12) + ' ' + T('stalled ') + minsText(r.quietMin) + '</span>'
    if (r.state === 'quiet') return '<span class="lp warn">' + ic('clock', 12) + ' ' + T('quiet ') + minsText(r.quietMin) + '</span>'
    return ''
  }
  function runRow(r, many) {
    const pill = statePill(r)
    // not "quiet": the office view has a global .quiet rule
    const cls = r.state === 'stalled' ? ' rst' : r.state === 'quiet' ? ' rqt' : r.state === 'dead' ? ' rdd' : ''
    const eta = r.etaMin === null || r.etaMin === undefined ? '<span class="mut">—</span>' : '<b class="hi">' + minsText(r.etaMin) + '</b><div class="mut sm">' + T('about ') + clockIn(r.etaMin) + '</div>'
    const phase = phaseName(r)
    const stepTxt = r.step ? T('step ') + digits(r.step.index) + T(' of ') + digits(r.step.of) + (r.step.name ? ': ' + r.step.name : '') : ''
    const act = r.state === 'stalled' || r.state === 'dead' ? '<div class="la"><button type="button" class="b sm' + armedCls('ra|nudge|' + r.id) + '" data-ev="run-act" data-arg="nudge|' + esc(r.id) + '">' + esc(armedLabel('ra|nudge|' + r.id, T('Nudge'))) + '</button><button type="button" class="b sm bad' + armedCls('ra|stop|' + r.id) + '" data-ev="run-act" data-arg="stop|' + esc(r.id) + '">' + esc(armedLabel('ra|stop|' + r.id, T('Stop'))) + '</button></div>' : ''
    const runNo = many ? ' <span class="mut sm">' + T('run ') + digits(many) + '</span>' : ''
    return '<tr class="lr2' + cls + '"><td><div class="rw" style="gap:10px">' + face(r.agent || 'supervisor', 30, true) + '<div style="min-width:0"><b class="hi">' + esc(r.agent) + '</b>' + runNo + '<div class="mut sm ell" style="max-width:130px">' + esc(modelOf(r)) + '</div></div></div></td>' +
      '<td><div class="hi lt" dir="auto" title="' + esc(r.task) + '">' + esc(r.task) + '</div><div class="mut sm lt" dir="auto">' + esc([officeNameOfProject(r.project), r.doing].filter(Boolean).join(' · ')) + '</div></td>' +
      '<td class="soft">' + (phase ? '<div dir="auto">' + esc(phase) + '</div>' : '<span class="mut">—</span>') + (stepTxt ? '<div class="mut sm" dir="auto">' + esc(stepTxt) + '</div>' : '') + '</td>' +
      '<td>' + pbar(r) + '</td><td class="num soft">' + (r.files === null || r.files === undefined ? '<span class="mut">—</span>' : ic('doc', 13) + ' ' + digits(r.files)) + '</td>' +
      '<td>' + (pill || '<span class="soft">' + esc(agoShort(r.lastActivityAt)) + '</span>') + (pill && r.lastActivityAt ? '<div class="mut sm">' + esc(agoShort(r.lastActivityAt)) + '</div>' : '') + '</td>' +
      '<td>' + eta + '</td><td class="ac">' + act + '</td></tr>'
  }
  const officeNameOfProject = (p) => (p ? String(p) : '')

  /** One run as a card: who, the task, where it is, one thick bar, the percent and the ETA. */
  function runCard(r, many) {
    const pill = statePill(r)
    const tone = r.state === 'stalled' || r.state === 'dead' ? 'bad' : r.state === 'quiet' ? 'warn' : ''
    const rep = r.reported, est = r.estimate
    const has = (v) => v !== null && v !== undefined
    const shown = has(rep) ? rep : has(est) ? est : null
    const e = emp(r.agent)
    const sub = [e && e.name ? titleOf(e) : modelOf(r), r.project].filter(Boolean).join(' · ')
    const where = [phaseName(r) || r.doing || '', r.lastActivityAt ? T('last report ') + agoShort(r.lastActivityAt) : ''].filter(Boolean).join(' · ')
    // the estimate is named when it says something the reported percent does not
    const foot = has(rep) ? (has(est) && Math.abs(est - rep) >= 5 ? T('estimate ') + digits(est) + ' %' : T('reported')) : has(est) ? T('estimate only') : T('nothing reported yet')
    const act = (r.state === 'stalled' || r.state === 'dead') && canWrite() ? '<div class="rw rca"><button type="button" class="b sm' + armedCls('ra|nudge|' + r.id) + '" data-ev="run-act" data-arg="nudge|' + esc(r.id) + '">' + esc(armedLabel('ra|nudge|' + r.id, T('Nudge'))) + '</button><button type="button" class="b sm bad' + armedCls('ra|stop|' + r.id) + '" data-ev="run-act" data-arg="stop|' + esc(r.id) + '">' + esc(armedLabel('ra|stop|' + r.id, T('Stop'))) + '</button></div>' : ''
    return '<div class="card rcard' + (tone ? ' ' + tone : '') + '"><div class="rw rch">' + face(r.agent || 'supervisor', 44, true) + '<div style="min-width:0;flex:1 1 130px"><b class="hi rnm" dir="auto" title="' + esc(nameOf(r.agent)) + '" style="display:block">' + esc(nameOf(r.agent)) + (many ? ' <span class="mut">' + T('run ') + digits(many) + '</span>' : '') + '</b><div class="mut rnm" dir="auto" title="' + esc(sub) + '">' + esc(sub) + '</div></div>' + pill + '</div>' +
      '<div class="hi rct lt" dir="auto" title="' + esc(r.task) + '">' + esc(r.task) + '</div><div class="mut sm ell" dir="auto">' + esc(where) + '</div>' +
      '<div class="rw rcb"><div class="bar thick' + (tone ? ' ' + tone : '') + (shown !== null && !has(rep) ? ' hatch' : '') + '"><i style="width:' + (shown || 0) + '%"></i>' + (has(rep) && has(est) ? '<b class="tick" style="left:' + est + '%"></b>' : '') + '</div><b class="hi rcp">' + (shown === null ? '—' : digits(shown) + ' %') + '</b></div>' +
      '<div class="rw rcf"><span class="mut">' + esc(foot) + (r.differ ? ' <span class="df" title="' + esc(T('The reported and the estimated percent are more than 25 points apart')) + '">' + ic('warn', 13) + '</span>' : '') + '</span><span class="sp"></span><span class="soft">' + T('ETA ') + '<b class="hi">' + (has(r.etaMin) ? minsText(r.etaMin) : '—') + '</b></span></div>' + act + '</div>'
  }
  /** The dead runs as one card among the runs: how many, and Clean them. */
  function deadTile(dead) {
    if (!dead.length) return ''
    const label = dead.length === 1 ? T('Clean it') : dead.length === 2 ? T('Clean both') : T('Clean all ') + digits(dead.length)
    return '<div class="card rcard dtile"><b class="hi" style="font-size:18px">' + digits(dead.length) + ' ' + T(dead.length === 1 ? 'dead run to clean' : 'dead runs to clean') + '</b><p class="soft">' + T('Quiet for hours and never reported. Cleaning only hides them here; the log stays in Activity.') + '</p>' +
      (canWrite() ? '<div><button type="button" class="b sm' + armedCls('ra|clean|all') + '" data-ev="run-act" data-arg="clean|all">' + esc(armedLabel('ra|clean|all', label)) + '</button></div>' : '') + '</div>'
  }
  function runsTable(rows, dead) {
    const flagged = !!st.liveFlag
    const cards = st.liveView !== 'table'
    let list = rows.filter((r) => !flagged || r.state !== 'working' || r.differ)
    const eta = (r) => (r.etaMin === null || r.etaMin === undefined ? 1e9 : r.etaMin)
    const plain = (r) => (r.state === 'working' && !r.differ ? 1 : 0)
    // cards: the flagged first, then the nearest to done; the table keeps the quietest last within each state
    list = list.slice().sort((a, b) => (st.liveGroup ? String(a.project).localeCompare(String(b.project)) : 0) ||
      (cards ? plain(a) - plain(b) || SEVERITY[b.state] - SEVERITY[a.state] || eta(a) - eta(b) : SEVERITY[a.state] - SEVERITY[b.state] || b.quietMin - a.quietMin))
    const count = {}
    for (const r of rows) count[r.agent] = (count[r.agent] || 0) + 1
    const seen = {}
    const nth = (r) => { seen[r.agent] = (seen[r.agent] || 0) + 1; return count[r.agent] > 1 ? seen[r.agent] : 0 }
    const tools = '<span class="sp"></span><span class="seg" role="group" aria-label="' + T('Show the runs as') + '"><button type="button" data-ev="live-view" data-arg="cards" aria-pressed="' + cards + '">' + T('Cards') + '</button><button type="button" data-ev="live-view" data-arg="table" aria-pressed="' + !cards + '">' + T('Table') + '</button></span>' +
      '<button type="button" class="b sm" data-ev="live-opt" data-arg="group" aria-pressed="' + !!st.liveGroup + '">' + T('Group by project') + '</button><button type="button" class="b sm" data-ev="live-opt" data-arg="flag" aria-pressed="' + flagged + '">' + T('Show only flagged') + '</button>'
    const note = T('Quiet means no step reported for ') + digits(LIVE_QUIET_MIN) + T(' minutes; stalled at ') + digits(st.data.live.limits.stallMinutes) + T(' minutes (') + '<button type="button" class="lnk" data-ev="goto-limits">' + T('Settings, Decisions') + '</button>' + T('). A stalled run is never stopped by Arsenale.')
    if (cards) {
      const html = '<div class="lrun"><div class="rw lth2"><b class="hi">' + T('Running now') + '</b><span class="mut">' + T('flagged first, then by ETA') + '</span>' + tools + '</div>'
      if (!list.length && !dead.length) return html + '<p class="empty">' + (rows.length ? T('Nothing is flagged.') : T('No agent is running.')) + '</p></div>'
      return html + '<div class="rgrid">' + list.map((r) => runCard(r, nth(r))).join('') + deadTile(dead) + '</div><p class="mut sm" style="margin-top:12px">' + note + '</p></div>'
    }
    const body = list.map((r) => runRow(r, nth(r))).join('')
    let html = '<div class="card ltab"><div class="lth rw"><b class="hi">' + T('Running now') + '</b><span class="mut">' + T('quietest last within each state') + '</span>' + tools + '</div>'
    if (!list.length) return html + '<p class="empty" style="padding:18px">' + (rows.length ? T('Nothing is flagged.') : T('No agent is running.')) + '</p></div>'
    html += '<div class="lscroll"><table class="lt2"><colgroup><col style="width:150px"><col><col style="width:130px"><col style="width:170px"><col style="width:52px"><col style="width:110px"><col style="width:90px"><col style="width:80px"></colgroup><thead><tr><th>' + T('Agent') + '</th><th>' + T('Task') + '</th><th>' + T('Phase') + '</th><th>' + T('Progress') + '</th><th class="num">' + T('Files') + '</th><th>' + T('Last activity') + '</th><th>' + T('ETA') + '</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>'
    return html + '<p class="mut sm" style="padding:12px 18px">' + note + '</p></div>'
  }

  /** One version run: the overall percent, one segment per phase. */
  function vrCard(v) {
    const m = vrMirror(v.id) || {}
    const phases = (m.phases || []).map((p) => ({ p, c: (v.phases || []).find((x) => x.id === p.id) }))
    const total = phases.reduce((n, x) => n + ((x.c && x.c.weight) || 1), 0) || 1
    const tok = (id) => { const t = ((m.ledger && m.ledger.phases) || []).find((x) => x.phase === id); return t && t.tokens ? tokens(t.tokens) + ' ' + T('tokens') : '' }
    const used = m.ledger && m.ledger.tokens
    const pctNow = v.percent
    const startMs = Date.parse(m.startedAt)
    const el = isNaN(startMs) ? null : Date.now() - startMs
    const eta = pctNow !== null && pctNow !== undefined && pctNow >= 10 && pctNow < 100 && el !== null && el >= 120000 ? Math.round(el * (100 - pctNow) / pctNow / 60000) : null
    const cls = (s) => (/merged|done/i.test(s) ? 'ok' : /block|fail/i.test(s) ? 'bad' : /gate|wait/i.test(s) ? 'warn' : /build|run/i.test(s) ? 'run' : '')
    // one block: the overall percent in display size, then a thick track per phase in its state's colour
    let html = '<div class="card lvr"><div class="lvh rw"><span class="lbl">' + T('Version run') + '</span><b class="hi vtt" dir="auto">' + esc(v.app || v.id) + (v.version ? ' ' + esc(v.version) : '') + '</b>' + (v.status ? '<span class="chip ' + (cls(v.status) === 'ok' ? 'ok' : cls(v.status) === 'bad' ? 'bad' : cls(v.status) === 'warn' ? 'warn' : '') + '">' + esc(v.status) + '</span>' : '') +
      '<span class="mut ell" dir="auto">' + esc([m.integrationBranch, !isNaN(startMs) ? T('started ') + hm(m.startedAt) : '', used && m.budget ? tokens(used) + T(' of ') + tokens(m.budget) + ' ' + T('tokens') : used ? tokens(used) + ' ' + T('tokens') : ''].filter(Boolean).join(' · ')) + '</span><span class="sp"></span>' +
      (eta !== null ? '<span class="soft vgo">' + T('about ') + '<b class="hi">' + minsText(eta) + '</b>' + T(' to go · done about ') + '<b class="hi">' + clockIn(eta) + '</b></span>' : '') + '<a class="lnk" href="#/rundetail">' + T('All phases and requests') + '</a></div>'
    // the narrow layout keeps the tracks and says in one line which phase is on now
    const now = phases.find((x) => !/merged|done/i.test(String(x.p.status || '')) && !(x.c && x.c.percent >= 100))
    const nowLine = now ? '<div class="vnow">' + T('Now: ') + '<b class="hi" dir="auto">' + esc(now.p.id) + ' ' + esc(now.p.name || '') + '</b>' + (now.p.status ? ' · <span class="vst ' + cls(now.p.status) + '">' + esc(now.p.status) + '</span>' : '') + '</div>' : ''
    html += '<div class="lvb"><div class="lvbig"><b class="pc">' + (pctNow === null || pctNow === undefined ? '—' : digits(pctNow) + '<small> %</small>') + '</b><span class="mut">' + T('overall') + '</span></div>'
    html += '<div class="vph" role="img" aria-label="' + esc(T('Progress of each phase')) + '">' + phases.map((x) => { const w = (x.c && x.c.weight) || 1, pc = x.c ? Math.round(x.c.percent) : 0, c = cls(x.p.status || ''); return '<div class="vp" style="flex:' + w + ' 1 0"><span class="trk ' + c + '"><i style="width:' + pc + '%"></i></span><div class="rw vph2" style="gap:6px"><b class="hi vpn" dir="auto" title="' + esc(x.p.id + ' ' + (x.p.name || '')) + '">' + esc(x.p.id) + ' ' + esc(x.p.name || '') + '</b><span class="sp"></span><span class="soft vpc">' + (x.c ? digits(pc) + ' %' : '—') + '</span></div><div class="vst ' + c + '">' + esc(x.p.status || '') + (tok(x.p.id) ? '<span class="mut"> · ' + tok(x.p.id) + '</span>' : '') + '</div></div>' }).join('') + '</div>' + nowLine + '</div></div>'
    return html
  }

  function queueCard(q) {
    const w = (q.waiting || []).filter((x) => !x.gone)
    let html = '<div class="card pad lside"><div class="rw" style="gap:10px;margin-bottom:12px"><b class="hi" style="font-size:16px">' + T('Test queue') + '</b><span class="chip sm">' + T('one full suite at a time') + '</span></div>'
    if (!q.holder && !w.length) return html + '<p class="soft">' + T('Nobody is testing.') + '</p></div>'
    if (q.holder) {
      const h2 = q.holder
      html += '<div class="qh' + (h2.hung ? ' hung' : '') + '"><div class="rw" style="gap:10px">' + face(h2.agent || 'supervisor', 30, true) + '<div style="min-width:0;flex:1"><b class="hi">' + esc(h2.agent) + '</b>' + (h2.repo ? ' <span class="soft sm" dir="auto">' + esc(shortPath(h2.repo)) + '</span>' : '') + '<div class="mut sm">' + T('full suite') + '</div></div><span class="chip ok sm">' + ic('play', 11, 2.4) + ' ' + T('running') + '</span></div>' +
        '<div class="mut sm" style="margin-top:8px">' + T('since ') + hm(h2.startedAt) + ' · ' + dur(h2.heldMs) + (h2.hung ? ' · <span class="wk">' + T('longer than an hour: check it') + '</span>' : '') + '</div></div>'
    }
    if (w.length) {
      html += '<div class="lbl" style="margin:14px 0 6px">' + T('Waiting for the slot') + '</div>' + w.slice(0, 5).map((x) => '<div class="qw rw" style="gap:10px"><span class="no">' + digits(x.position) + '</span><div style="min-width:0;flex:1"><b class="hi sm">' + esc(x.agent) + '</b>' + (x.repo ? ' <span class="soft sm" dir="auto">' + esc(shortPath(x.repo)) + '</span>' : '') + '</div><span class="soft sm">' + dur(x.waitMs) + '</span></div>').join('') + (w.length > 5 ? '<p class="mut sm" style="margin-top:6px">+' + digits(w.length - 5) + ' ' + T('more') + '</p>' : '')
    }
    return html + '<p class="mut sm" style="margin-top:12px">' + T('A waiting agent is not stalled: its quiet timer is paused while it waits.') + '</p></div>'
  }
  const shortPath = (p) => { const a = String(p).replace(/[\\/]+$/, '').split(/[\\/]/); return a[a.length - 1] || String(p) }

  function deadCard(dead) {
    if (!dead.length) return ''
    return '<div class="card pad lside dead"><div class="rw" style="gap:10px;margin-bottom:8px"><b class="hi" style="font-size:16px">' + T('Dead runs') + '</b><span class="chip bad sm">' + digits(dead.length) + '</span><span class="sp"></span><button type="button" class="b sm bad' + armedCls('ra|clean|all') + '" data-ev="run-act" data-arg="clean|all">' + ic('trash', 13) + ' ' + esc(armedLabel('ra|clean|all', T('Clean all ') + digits(dead.length))) + '</button></div>' +
      '<p class="soft sm" style="margin-bottom:8px">' + T('Quiet for hours and never reported. Cleaning only hides them here; the log stays in Activity.') + '</p>' +
      dead.map((d) => '<div class="dr rw" style="gap:10px">' + face(d.agent || 'supervisor', 26, true) + '<div style="min-width:0;flex:1"><b class="hi sm">' + esc(d.agent) + '</b>' + (d.model ? ' <span class="mut sm">' + esc(d.model) + '</span>' : '') + '<div class="mut sm">' + T('started ') + esc(day(d.startedAt)) + ' ' + hm(d.startedAt) + '</div></div><div style="text-align:end"><b class="bd sm">' + (d.quietMin === null ? '—' : minsText(d.quietMin)) + '</b><div class="mut sm">' + T('quiet') + '</div></div><button type="button" class="b sm" data-ev="run-act" data-arg="clean|' + esc(d.id) + '">' + T('Clean') + '</button></div>').join('') + '</div>'
  }

  function resumeCard(res) {
    const list = (res && res.candidates) || []
    if (!list.length) return ''
    return '<div class="card pad"><div class="sec">' + T('Unfinished work') + ' <small>' + T('Runs that ended with work left in their folder. Resume asks your assistant to continue; it starts nothing itself.') + '</small></div>' +
      list.map((c) => '<div class="rr rw" style="gap:12px">' + face(c.agent || 'supervisor', 28, true) + '<div style="min-width:0;flex:1"><b class="hi">' + esc(c.agent) + '</b> <span class="mut sm" dir="auto">' + esc(c.branch || '') + '</span><div class="soft sm lt" dir="auto">' + esc(c.task) + '</div><div class="mut sm">' + digits(c.changed || 0) + ' ' + T((c.changed || 0) === 1 ? 'file changed' : 'files changed') + (c.unmerged ? ' · ' + digits(c.unmerged) + ' ' + T('commits not merged') : '') + ' · ' + T('last activity ') + esc(agoShort(c.lastActivityAt)) + ' · ' + (c.hasBrief ? T('brief stored') : '<span class="wk">' + T('No brief stored') + '</span> · ' + T('limited')) + '</div></div>' +
        (c.sentAt ? '<span class="chip ok sm">' + ic('check', 11, 3) + ' ' + T('Resume sent, waiting for your assistant') + '</span>' : canWrite() ? '<button type="button" class="b sm pri" data-ev="resume" data-arg="resume|' + esc(c.run) + '">' + T('Resume') + '</button><button type="button" class="b sm ghost" data-ev="resume" data-arg="dismiss|' + esc(c.run) + '">' + T('Dismiss') + '</button>' : '') + '</div>').join('') +
      (st.err['rs'] ? '<p class="msg err">' + esc(errTxt(st.err['rs'])) + '</p>' : '') + '</div>'
  }

  function stallBanners(alerts, rows) {
    const open = alerts.slice(0, 3)
    return open.map((a) => {
      const r = rows.find((x) => x.id === a.run) || {}
      return '<div class="banner stb" role="alert"><span style="color:var(--bad);line-height:0">' + ic('warn', 22) + '</span><div style="min-width:0"><b class="hi">' + esc(a.agent ? nameOf(a.agent) : T('A run')) + '</b> <span class="soft">' + T('has been quiet for ') + minsText(a.quietMin) + '.</span><div class="mut sm ell" dir="auto">' + esc(r.task || '') + '</div></div><span class="sp"></span>' +
        (canWrite() ? '<button type="button" class="b sm' + armedCls('ra|nudge|' + a.run) + '" data-ev="run-act" data-arg="nudge|' + esc(a.run) + '">' + esc(armedLabel('ra|nudge|' + a.run, T('Nudge'))) + '</button><button type="button" class="b sm bad' + armedCls('ra|stop|' + a.run) + '" data-ev="run-act" data-arg="stop|' + esc(a.run) + '">' + esc(armedLabel('ra|stop|' + a.run, T('Stop'))) + '</button><button type="button" class="b sm ghost" data-ev="alert-dismiss" data-arg="' + esc(a.run) + '">' + T('Dismiss') + '</button>' : '') + '</div>'
    }).join('') + (alerts.length > 3 ? '<p class="mut sm" style="margin:-14px 0 14px">+' + digits(alerts.length - 3) + ' ' + T('more stalled runs') + '</p>' : '')
  }

  function liveMain() {
    if (!LIVE) return liveOnly()
    load('live', 'api/live', false, 2500)
    load('vruns', 'api/version-runs', false, 6000)
    load('lacts', 'api/run-actions', false, 5000)
    const d = st.data.live
    if (!d) return head(T('Live')) + (st.err.live ? '<p class="msg err">' + esc(errTxt(st.err.live)) + '</p>' : '<p class="empty" role="status">' + T('Loading…') + '</p>')
    const rows = d.runs || []
    const dead = ((st.data.lacts && st.data.lacts.dead) || [])
    const n = (s) => rows.filter((r) => r.state === s).length
    const q = d.queue || { holder: null, waiting: [] }
    const queued = (q.holder ? 1 : 0) + (q.waiting || []).filter((x) => !x.gone).length
    const waitingN = (q.waiting || []).filter((x) => !x.gone).length
    // the counts in one line: a number turns amber or red only when it is above 0, and no card is filled red
    // a count of zero is not shown (owner rule), so the line holds only what is there
    const cnt = (num, label, tone, tip) => String(num) === digits(0) ? '' : '<span class="lsn"' + (tip ? ' title="' + esc(tip) + '"' : '') + '><b class="' + (tone || '') + '">' + num + '</b> ' + label + '</span>'
    const sum = '<div class="lsum">' + cnt(digits(rows.length - n('stalled') - n('dead')), T('running')) + cnt(digits(n('quiet')), T('quiet'), n('quiet') ? 'warn' : '', T('quiet for ') + digits(LIVE_QUIET_MIN) + T(' min or more')) + cnt(digits(n('stalled')), T('stalled'), n('stalled') ? 'bad' : '', T('stalled: quiet ') + digits(d.limits.stallMinutes) + T(' min or more')) + cnt(digits(dead.length), T('dead runs to clean'), dead.length ? 'bad' : '') +
      cnt(digits(q.holder ? 1 : 0) + (waitingN ? ' + ' + digits(waitingN) : ''), T('in the test queue') + (waitingN ? ' ' + T('(waiting)') : '')) + '</div>'
    const sub = hm(new Date().toISOString()) + ' · ' + T('refreshed ') + (secAgo(d.at) === null ? '—' : digits(secAgo(d.at)) + T(' s ago')) + ' · ' + digits(rows.length) + ' ' + T(rows.length === 1 ? 'run open' : 'runs open')
    const legend = '<span class="lgd"><i class="g1"></i>' + T('reported by the agent') + '</span><span class="lgd"><i class="g2"></i>' + T('estimated by Arsenale') + '</span><span class="lgd"><i class="g3"></i>' + T('estimate only: nothing reported yet') + '</span>'
    let html = '<div class="lhead">' + head(T('Live'), sub, sum + '<div class="lgbar">' + legend + '</div>') + '</div>'
    if (st.err.live) html += '<p class="msg err" role="status">' + esc(errTxt(st.err.live)) + '</p>'
    html += stallBanners((d.alerts || []), rows)
    const vrs = (d.versionRuns || []).filter((v) => !/done|finished|complete|stopped|cancel/i.test(String(v.status || '')))
    html += vrs.map(vrCard).join('')
    if (st.liveView !== 'table') {
      // cards: the dead runs are a card among the runs; the test queue shows only while someone is in it
      html += runsTable(rows, dead) + '<div class="lbelow">' + resumeCard(d.resume) + (q.holder || waitingN ? queueCard(q) : '') + '</div>'
      return html + msgHtml()
    }
    html += '<div class="lgrid"><div style="min-width:0;display:flex;flex-direction:column;gap:18px">' + runsTable(rows, []) + resumeCard(d.resume) + '</div><div style="display:flex;flex-direction:column;gap:18px;min-width:0">' + queueCard(q) + deadCard(dead) + '</div></div>'
    return html + msgHtml()
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-ev]')
    if (!t) return
    const a = t.dataset.ev, arg = t.dataset.arg || ''
    if (a === 'live-opt') { st[arg === 'group' ? 'liveGroup' : 'liveFlag'] = !st[arg === 'group' ? 'liveGroup' : 'liveFlag']; h.redraw(); return }
    if (a === 'live-view') { st.liveView = arg === 'table' ? 'table' : 'cards'; try { localStorage.setItem('arsenale-live-view', st.liveView) } catch { /* a private window */ } h.redraw(); return }
    if (a === 'goto-limits') { st.setTab = 'decisions'; location.hash = '#/settings'; return }
    if (a === 'run-act') {
      const [op, run] = arg.split('|')
      // Stop and Clean all ask twice (their buttons say so); Nudge and one Clean change nothing that cannot be redone
      if ((op === 'stop' || (op === 'clean' && run === 'all')) && !arm('ra|' + op + '|' + run)) return
      act(() => send('api/run-action', { op, run }), () => {
        st.dmsg = { ok: true, text: op === 'clean' ? T('Hidden from this page. The log stays in Activity.') : op === 'nudge' ? T('Your assistant is asked to nudge this run.') : T('Your assistant is asked to stop this run.') }
        load('live', 'api/live', true); load('lacts', 'api/run-actions', true)
      })
      return
    }
    if (a === 'alert-dismiss') { act(() => send('api/alerts', { run: arg }), () => load('live', 'api/live', true)); return }
    if (a === 'resume') {
      const [op, run] = arg.split('|')
      st.err.rs = ''
      send('api/resume', { op, run }).then(() => load('live', 'api/live', true), (err) => { st.err.rs = err.message; bump() })
    }
  })
