  // ========== decisions: everything that waits for the owner, in three columns (spec 1.1, 4.5; 14.2)
  const KIND_NAME = { merge: 'Merge', 'next-phase': 'Next phase', build: 'Build', publish: 'Release' }
  const KIND_ICON = { merge: 'merge', 'next-phase': 'skip', build: 'build', publish: 'lock' }
  /** Which column: a merge or a next phase can run by itself once approved;
   *  a build or a release never can (automation.cjs); the rest is a question for a person. */
  function decCol(g) {
    const t = g.action && g.action.type
    if (t === 'merge' || t === 'next-phase') return 'go'
    if (t === 'build' || t === 'publish') return 'lock'
    return 'ask'
  }
  function decKind(g) {
    const t = g.action && g.action.type
    if (KIND_NAME[t]) return { cls: t, label: T(KIND_NAME[t]), icon: KIND_ICON[t] }
    if (g.approvalType === 'hire') return { cls: 'hire', label: T('Hire'), icon: 'plus' }
    if (g.approvalType === 'action' && g.action) return { cls: 'act', label: T(catOf(g)[2] || 'Approval'), icon: 'out' }
    if (g.kind === 'approval') return { cls: 'appr', label: T('Approval'), icon: 'check' }
    return { cls: 'q', label: T('Question'), icon: 'comment' }
  }
  const decTitle = (g) => (decCol(g) === 'ask' ? plainQ(g) : g.question || (g.action && g.action.summary) || '')
  const decAge = (g) => {
    const ms = Date.now() - Date.parse(g.askedAt)
    return { ms, text: isNaN(ms) ? '' : dur(ms), tone: ms >= 2 * 3600000 ? 'bad' : ms >= 3600000 ? 'warn' : '' }
  }
  /** Whether approving this one would let it run by itself (the server decides again when the answer is written). */
  function wouldAuto(g) {
    const a = st.data.automation
    const t = g.action && g.action.type
    return !!(a && a.autoRun && !a.readOnly && a.kinds && a.kinds[t] && g.action.gatesPassed === true)
  }
  /** Approve and Reject for a merge, a phase, a build or a release (stored answers stay approve and decline). */
  function typedButtons(g, big, short) {
    const k2 = (v) => 'ap|' + g.id + '|' + v
    const lg = big ? ' big' : ''
    // a queue row says just Approve; the card and the letter name what is approved
    const yes = short ? 'Approve' : g.action.type === 'publish' ? 'Approve release' : g.action.type === 'build' ? 'Approve build' : 'Approve'
    return '<button type="button" class="b pri' + lg + armedCls(k2('approve')) + '" data-ev="ans" data-arg="' + esc(g.id) + '" data-val="approve">' + ic('check', 15, 2.6) + esc(armedLabel(k2('approve'), T(yes))) + '</button>' +
      '<button type="button" class="b bad' + lg + armedCls(k2('decline')) + '" data-ev="ans" data-arg="' + esc(g.id) + '" data-val="decline">' + ic('x', 14, 2.4) + esc(armedLabel(k2('decline'), T('Reject'))) + '</button>'
  }
  /** A compact row of the queue: the kind and project, how long it waits, the title, and its buttons. */
  function decRow(g, col) {
    const k = decKind(g), age = decAge(g)
    const btns = !canWrite() ? '' : col === 'ask' ? '<button type="button" class="b sm" data-ev="dec-open" data-arg="' + esc(g.id) + '">' + T('Answer') + '</button>' : typedButtons(g, false, true)
    return '<div class="dc dq' + (col === 'lock' ? ' lk' : '') + '"><div class="rw dqa">' + ic(k.icon, 17) + '<span class="dqk">' + esc(k.label) + (g.versionRun || g.project ? ' · ' + esc(g.project || g.versionRun) : '') + '</span><span class="sp"></span>' + (age.text ? '<span class="age ' + age.tone + '">' + esc(age.text) + '</span>' : '') + '</div>' +
      '<div class="rw dqb"><button type="button" class="dqt" data-ev="dec-open" data-arg="' + esc(g.id) + '" dir="auto" title="' + T('Details') + '">' + esc(decTitle(g)) + '</button>' + btns + '</div>' +
      (st.err['ap|' + g.id] ? '<p class="msg err">' + esc(errTxt(st.err['ap|' + g.id])) + '</p>' : '') + '</div>'
  }
  function decCard(g, col, focus) {
    const k = decKind(g), age = decAge(g)
    const who = nameOf(askerOf(g))
    const meta = [g.versionRun || g.project, who].filter(Boolean).join(' · ')
    const aged = col === 'ask' && age.tone === 'bad' ? ' old' : ''
    let body = ''
    const extra = g.action && g.action.summary && g.action.summary !== decTitle(g) ? '<p class="soft sm" dir="auto">' + esc(g.action.summary) + '</p>' : ''
    if (col === 'lock') body = extra + '<p class="lockn">' + ic('lock', 14) + ' ' + T('Never runs by itself. Only you can approve this.') + '</p>'
    else if (col === 'go') body = extra + '<div class="rw" style="gap:6px;flex-wrap:wrap;margin-top:8px"><span class="chip sm ' + (g.action.gatesPassed === true ? 'ok' : 'warn') + '">' + ic(g.action.gatesPassed === true ? 'check' : 'info', 11, 2.6) + ' ' + T(g.action.gatesPassed === true ? 'checks passed' : 'checks not reported') + '</span>' + (wouldAuto(g) ? '<span class="chip sm ok">' + ic('play', 11, 2.4) + ' ' + T('would run by itself') + '</span>' : '') + '</div>'
    else if (g.approvalType === 'action' && g.action && g.action.target) body = '<p class="soft sm" dir="auto">' + T('Where: ') + esc(g.action.target) + '</p>'
    let btns = ''
    if (canWrite()) {
      if (col === 'ask') btns = answerButtons(g, focus ? 'lg' : '')
      else btns = typedButtons(g, !!focus)
    }
    return '<div class="card dc' + (focus ? ' dfocus' : '') + aged + (col === 'lock' ? ' lk' : '') + '"><div class="rw" style="gap:8px"><span class="kind ' + k.cls + '">' + ic(k.icon, focus ? 16 : 12) + ' ' + esc(k.label) + '</span>' + '<span class="sp"></span>' + (age.text ? '<span class="age ' + age.tone + '">' + (age.tone === 'bad' ? ic('clock', focus ? 16 : 12) + ' ' : '') + (focus ? T('waiting ') : '') + esc(age.text) + '</span>' : '') + '</div>' +
      '<h3 class="dt" dir="auto">' + esc(decTitle(g)) + '</h3><div class="mut sm ell" dir="auto">' + esc(meta) + '</div>' + body +
      '<div class="rw dbt" style="gap:8px;flex-wrap:wrap">' + btns + '<span class="sp"></span><button type="button" class="b ghost" data-ev="dec-open" data-arg="' + esc(g.id) + '">' + T('Details') + '</button></div>' +
      (st.err['ap|' + g.id] ? '<p class="msg err">' + esc(errTxt(st.err['ap|' + g.id])) + '</p>' : '') + '</div>'
  }
  /** Time and text of what went ahead in the last hour: by itself (with Undo while it lasts) or by the owner. */
  function doneLog() {
    const hourAgo = Date.now() - 3600000
    const auto = ((st.data.autolog && st.data.autolog.items) || []).map((x) => ({ gate: x.gate, at: x.at, text: x.question, by: x.undoneAt ? 'undone' : 'auto', canUndo: x.canUndo }))
    const have = new Set(auto.map((x) => x.gate))
    const mine = gates().filter((g) => g.status === 'answered' && !have.has(g.id) && Date.parse(g.answeredAt) >= hourAgo && g.kind === 'approval' && /^(approve|approved|yes)$/i.test(String(g.answer || '').trim())).map((g) => ({ gate: g.id, at: g.answeredAt, text: decTitle(g), by: 'you' }))
    const all = auto.concat(mine).sort((a, b) => String(b.at).localeCompare(String(a.at)))
    let html = '<div class="lbl" style="margin:26px 0 8px">' + T('Done without you in the last hour') + '</div>'
    if (!all.length) return html + '<p class="mut sm">' + T('Nothing yet.') + '</p>'
    html += '<div class="card dlog">' + all.map((x) => '<div class="rw dl" style="gap:10px"><time class="mut sm">' + hm(x.at) + '</time><span class="soft ell" style="flex:1" dir="auto" title="' + esc(x.text) + '">' + esc(x.text) + '</span>' +
      (x.by === 'auto' ? '<span class="chip ok sm">' + T('by itself') + '</span>' + (x.canUndo && canWrite() ? '<button type="button" class="b sm' + armedCls('undo|' + x.gate) + '" data-ev="undo" data-arg="' + esc(x.gate) + '">' + esc(armedLabel('undo|' + x.gate, T('Undo'))) + '</button>' : '') : x.by === 'undone' ? '<span class="chip warn sm">' + T('undone') + '</span>' : '<span class="chip sm">' + T('you approved') + '</span>') + '</div>').join('') + '</div>' +
      '<p class="mut sm" style="margin-top:6px">' + T('Undo is offered for 10 minutes. It tells your assistant to take the action back; Arsenale itself changes nothing.') + '</p>'
    if (st.err.undo) html += '<p class="msg err">' + esc(errTxt(st.err.undo)) + '</p>'
    return html
  }
  function decisionsMain() {
    if (!LIVE) return liveOnly()
    load('automation', 'api/automation', false, 5000)
    load('autolog', 'api/auto-log', false, 4000)
    const wait = waiting()
    // a link from elsewhere (a notification, a profile) opens that item's details once
    if (st.apprSel && st.apprOpened !== st.apprSel && wait.some((g) => g.id === st.apprSel)) { st.apprOpened = st.apprSel; st.drawer = { type: 'decision', id: st.apprSel } }
    // the oldest waiting first: a long wait is the thing to see
    const cols = { ask: [], go: [], lock: [] }
    for (const g of wait.slice().reverse()) cols[decCol(g)].push(g)
    const a = st.data.automation
    const on = !!(a && a.autoRun)
    const sub = wait.length ? digits(wait.length) + ' ' + T('waiting') + ' · ' + T('nothing happens until you answer') + ' · ' + T('oldest first') : T('Nothing is waiting for you.')
    const state = '<button type="button" class="chip' + (on ? ' ok' : '') + '" data-ev="goto-auto" style="height:30px">' + ic(on ? 'play' : 'pause', 12, 2.4) + ' ' + T('Approved merges and phases run by themselves: ') + '<b>' + T(on ? 'on' : 'off') + '</b></button>'
    let html = head(T('Decisions'), sub, state)
    const okAll = cols.go.filter((g) => g.action.gatesPassed === true)
    const none = (s) => '<p class="mut sm" style="padding:8px 2px">' + s + '</p>'
    // the oldest item is the focus card; the rest wait in a compact queue, in the three groups of 1.1
    const oldest = wait.length ? wait[wait.length - 1] : null // waiting() is newest first
    const rest = (list) => list.filter((g) => g !== oldest)
    const colHead = (title, n, note, extra) => '<div class="dch rw"><b class="hi dcn">' + title + '</b><span class="mut">' + digits(n) + '</span><span class="sp"></span>' + (extra || '') + '</div>' + (note ? '<div class="mut sm dcnote">' + note + '</div>' : '')
    const qAsk = rest(cols.ask), qGo = rest(cols.go), qLock = rest(cols.lock)
    html += '<div class="dlay"><div class="dmain">' + (oldest ? decCard(oldest, decCol(oldest), true) : '<div class="card dfocus dnone"><h2>' + T('Nothing is waiting for you.') + '</h2><p class="soft">' + T('Questions, merges, phases, builds and releases arrive here, oldest first.') + '</p></div>') + doneLog() + '</div>'
    // the narrow layout shows one group of the queue at a time, behind three tabs
    const tab = ['ask', 'go', 'lock'].includes(st.decTab) ? st.decTab : 'ask'
    html += '<div class="dtabs seg" role="group" aria-label="' + T('Which decisions') + '">' + [['ask', T('Answer'), cols.ask.length], ['go', T('Approve'), cols.go.length], ['lock', T('Always you'), cols.lock.length]].map(([k, l, c]) => '<button type="button" data-ev="dec-tab" data-arg="' + k + '" aria-pressed="' + (tab === k) + '">' + l + ' ' + digits(c) + '</button>').join('') + '</div>'
    html += '<div class="dqueue" data-tab="' + tab + '">' + (wait.length > 1 ? '<div class="dqh hi">' + T('Then ') + digits(wait.length - 1) + ' ' + T('more') + '</div>' : '')
    html += '<div class="dcol" data-col="ask">' + colHead(T('Needs your answer'), qAsk.length, '') + (qAsk.map((g) => decRow(g, 'ask')).join('') || none(T('Nothing else to answer.'))) + '</div>'
    html += '<div class="dcol" data-col="go">' + colHead(T('Approve to continue'), qGo.length, digits(okAll.length) + ' ' + T('passed their checks') + ' · ' + T(on ? 'these run by themselves once approved' : 'turn the switch on in Settings to let them run by themselves'),
      okAll.length > 1 && canWrite() ? '<button type="button" class="b sm pri' + armedCls('ap|all|approve') + '" data-ev="appr-all">' + ic('check', 13, 2.6) + ' ' + esc(armedLabel('ap|all|approve', T('Approve all ') + digits(okAll.length))) + '</button>' : '') +
      (qGo.map((g) => decRow(g, 'go')).join('') || none(T('Nothing else to approve.'))) + '</div>'
    html += '<div class="dcol" data-col="lock">' + colHead(T('Always waits for you'), qLock.length, T('builds and releases leave this computer or cannot be taken back')) + (qLock.map((g) => decRow(g, 'lock')).join('') || none(T('Nothing else to approve.'))) + '</div></div></div>'
    const done = gates().filter((g) => g.status !== 'waiting').sort((x, y) => String(y.answeredAt || y.expiredAt || '').localeCompare(String(x.answeredAt || x.expiredAt || ''))).slice(0, 10)
    if (done.length) html += '<details class="alately"><summary>' + T('Answered lately') + ' · ' + digits(done.length) + '</summary><div class="card" style="overflow:hidden;margin-top:10px">' + done.map((g) => '<div class="rw" style="padding:12px 16px;border-top:1px solid var(--line);align-items:flex-start">' + face(askerOf(g), 26) + '<div style="flex:1;min-width:0"><div class="soft" dir="auto" style="font-size:13.5px">' + esc(plainQ(g)) + '</div><div class="mut" style="font-size:12.5px;margin-top:2px">' + (g.status === 'answered' ? T('Answer: ') + '<span dir="auto">' + esc(g.answer) + '</span>' : T('Closed without an answer')) + ' · ' + esc(day(g.answeredAt || g.expiredAt)) + (g.history && g.history.some((x) => /^phone:/.test(x.via || '')) ? ' · ' + T('from your phone') : '') + '</div></div></div>').join('') + '</div></details>'
    return html + msgHtml()
  }

  /** The side panel: what the asker reported and what happens next. Only what
   *  the gate and its run hold is shown; nothing is invented. */
  function decisionDetail() {
    const g = gates().find((x) => x.id === st.drawer.id)
    if (!g) return '<div class="ph"><h2>' + T('Decision') + '</h2><button type="button" class="x" data-ev="drawer-close" aria-label="' + T('Close') + '">' + ic('x', 18) + '</button></div><div class="pb"><p class="empty">' + T('This one is no longer waiting.') + '</p></div>'
    const col = decCol(g), k = decKind(g), age = decAge(g)
    const head2 = '<div class="ph"><div style="min-width:0"><div class="rw" style="gap:8px"><span class="kind ' + k.cls + '">' + ic(k.icon, 12) + ' ' + esc(k.label) + '</span><span class="mut sm">' + esc(nameOf(askerOf(g))) + (age.text ? ' · ' + T('asked ') + esc(age.text) + T(' ago') : '') + '</span></div></div><button type="button" class="x" data-ev="drawer-close" aria-label="' + T('Close') + '">' + ic('x', 18) + '</button></div>'
    if (col === 'ask') return head2 + '<div class="pb">' + letter(g) + '</div>'
    const run = g.run && (DATA.active || []).concat(DATA.runs || []).find((r) => r.id === g.run)
    const steps = run && Array.isArray(run.steps) ? run.steps.slice(-4) : []
    const act = g.action || {}
    const then = {
      merge: [T('Merge ') + (act.ref ? '<b>' + esc(act.ref) + '</b> ' : '') + T('on this computer. Nothing is pushed or published.')],
      'next-phase': [T('Your assistant starts the next phase') + (act.ref ? ': <b>' + esc(act.ref) + '</b>' : '') + '.', T('If it would pass the budget warning, it asks you again.')],
      build: [T('The build runs on this computer.'), T('The installer stays here; nothing is shared.')],
      publish: [T('The tag, the notes and the package leave this computer.'), T('This cannot be taken back.')],
    }[act.type] || []
    let html = head2 + '<div class="pb"><h2 dir="auto" style="font-size:20px">' + esc(decTitle(g)) + '</h2>' + (act.summary && act.summary !== decTitle(g) ? '<p class="soft" dir="auto">' + esc(act.summary) + '</p>' : '')
    html += '<div class="rw" style="gap:12px;align-items:stretch"><div class="stat"><div class="lbl">' + T('Checks') + '</div><div class="hi" style="font-size:20px;font-weight:700;margin-top:4px">' + T(act.gatesPassed === true ? 'passed' : 'not reported') + '</div></div>' +
      '<div class="stat"><div class="lbl">' + T('Where') + '</div><div class="soft sm" style="margin-top:4px;line-height:1.5" dir="auto">' + esc([act.ref, g.versionRun || act.versionRun, g.project, act.target].filter(Boolean).join(' · ') || '—') + '</div></div></div>'
    if (steps.length) html += '<div><div class="lbl" style="margin-bottom:6px">' + T('What the run reported last') + '</div>' + steps.map((s) => '<div class="jr"><span style="color:var(--accent)">' + ic('check', 14, 2.2) + '</span><span class="soft sp" dir="auto">' + esc(s.text) + '</span><span class="mut sm">' + hm(s.at) + '</span></div>').join('') + '</div>'
    if (then.length) html += '<div><div class="lbl" style="margin-bottom:6px">' + T('If you approve') + '</div>' + then.map((s, i) => '<div class="rw" style="gap:10px;align-items:flex-start;margin-bottom:6px"><span class="num ok" style="width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:700 11px var(--font-ui);border:1px solid var(--accent-line);color:var(--accent);flex:none">' + digits(i + 1) + '</span><span class="soft">' + s + '</span></div>').join('') + (wouldAuto(g) ? '<p class="chip ok sm" style="margin-top:6px">' + ic('play', 11, 2.4) + ' ' + T('The switch is on: this runs by itself once approved.') + '</p>' : col === 'lock' ? '<p class="mut sm">' + ic('lock', 13) + ' ' + T('Always waits for you, whatever the switch says.') + '</p>' : '') + '</div>'
    if (canWrite()) html += '<div class="rw" style="gap:10px;flex-wrap:wrap;margin-top:6px">' + typedButtons(g, true) + '</div><div>' + replyForm(g, T('Reason, sent back to the agent (optional)')) + '</div>'
    if (st.err['ap|' + g.id]) html += '<p class="msg err">' + esc(errTxt(st.err['ap|' + g.id])) + '</p>'
    return html + '</div>'
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-ev]')
    if (!t) return
    const a = t.dataset.ev, arg = t.dataset.arg || ''
    if (a === 'dec-open') { st.drawer = { type: 'decision', id: arg }; st.dmsg = null; bump(); return }
    if (a === 'dec-tab') { st.decTab = arg; bump(); return }
    if (a === 'goto-auto') { st.setTab = 'decisions'; location.hash = '#/settings'; return }
    if (a === 'undo') {
      if (!arm('undo|' + arg)) return
      st.err.undo = ''
      send('api/undo', { gate: arg }).then(() => load('autolog', 'api/auto-log', true), (err) => { st.err.undo = err.message; bump() })
      return
    }
    if (a === 'appr-all') {
      if (!arm('ap|all|approve')) return
      const ids = waiting().filter((g) => decCol(g) === 'go' && g.action.gatesPassed === true).map((g) => g.id)
      // one after another: each answer is written (and judged for autoRun) on its own
      ids.reduce((p, id) => p.then(() => send('api/answer', answerBody(id, 'approve')).then((b) => answerSent(id, b), (err) => { st.err['ap|' + id] = err.message; bump() })), Promise.resolve()).then(() => load('autolog', 'api/auto-log', true))
    }
  })
