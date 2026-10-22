  // ---------- the office
  function scene(S, desks, current) {
    const items = []
    const overlays = []
    const add = (depth, s) => items.push([depth, s])

    let base = ''
    base += poly([P(0, 14, 0), P(22, 14, 0), P(22, 14, -12), P(0, 14, -12)], '#D5DBE1')
    base += poly([P(22, 0, 0), P(22, 14, 0), P(22, 14, -12), P(22, 0, -12)], '#C9D0D7')
    base += poly([P(0, 0), P(22, 0), P(22, 14), P(0, 14)], '#C9C0AE')
    for (let i = 1; i < 22; i++) base += '<line x1="' + P(i, 0)[0] + '" y1="' + P(i, 0)[1] + '" x2="' + P(i, 14)[0] + '" y2="' + P(i, 14)[1] + '" stroke="#BFB5A1" stroke-width="1"/>'
    for (let j = 1; j < 14; j++) base += '<line x1="' + P(0, j)[0] + '" y1="' + P(0, j)[1] + '" x2="' + P(22, j)[0] + '" y2="' + P(22, j)[1] + '" stroke="#C3BAA7" stroke-width="0.6"/>'
    const carpet = (a, b, c, d, fill) => poly([P(a, c), P(b, c), P(b, d), P(a, d)], fill)
    base += carpet(7.6, 14.6, 7.6, 13.8, '#B7AE9C')
    base += carpet(15.4, 21.8, 9.6, 13.6, '#A9B3AE')
    base += poly([P(0, 0, 0), P(22, 0, 0), P(22, 0, 70), P(0, 0, 70)], '#ECEFF2')
    base += poly([P(0, 0, 0), P(0, 14, 0), P(0, 14, 70), P(0, 0, 70)], '#E2E6EA')
    base += '<polyline points="' + pts([P(0, 14, 70), P(0, 0, 70), P(22, 0, 70)]) + '" fill="none" stroke="#C9D0D7" stroke-width="3"/>'
    for (const wx of [2, 5, 8.5, 13.5, 16, 19]) {
      base += poly([P(wx, 0, 26), P(wx + 1.8, 0, 26), P(wx + 1.8, 0, 58), P(wx, 0, 58)], '#CFE0EE')
      base += poly([P(wx + 0.1, 0, 28), P(wx + 0.6, 0, 28), P(wx + 1.1, 0, 56), P(wx + 0.6, 0, 56)], '#E1ECF5')
    }

    // project boards on the left wall: the projects that had work today
    const proj = new Map()
    const bump = (k, f) => { if (!k) return; const e = proj.get(k) || { run: 0, done: 0, findings: 0, failed: 0 }; f(e); proj.set(k, e) }
    S.active.forEach((a) => bump(a.projectKey, (e) => e.run++))
    S.today.forEach((r) => bump(r.projectKey, (e) => { e.done++; if (r.status === 'findings') e.findings++; if (r.status === 'failed') e.failed++ }))
    const boards = [...proj.entries()].sort((a, b) => (b[1].run - a[1].run) || (b[1].done - a[1].done)).slice(0, 3)
    boards.forEach(([name, e], i) => {
      const gy0 = 0.6 + i * 4.5
      const flag = e.failed ? 'x ' + digits(e.failed) + T(' failed') : e.findings ? '! ' + digits(e.findings) + T(' with findings') : ''
      base += poly([P(0, gy0, 18), P(0, gy0 + 4.0, 18), P(0, gy0 + 4.0, 60), P(0, gy0, 60)], '#E9E4D8')
      base += poly([P(0, gy0, 18), P(0, gy0 + 4.0, 18), P(0, gy0 + 4.0, 21), P(0, gy0, 21)], '#9C9484')
      const [tx, ty] = P(0, gy0 + 3.8, 52)
      const title = name.length > 15 ? name.slice(0, 14) + '…' : name
      base += '<g transform="matrix(0.894,-0.447,0,1,' + tx + ',' + ty + ')" font-family="Arial, Helvetica, sans-serif">' +
        '<text x="0" y="0" font-size="10.5" font-weight="700" fill="#1D2530" direction="ltr">' + esc(title) + '</text>' +
        '<text x="0" y="14" font-size="9.5" fill="#39414C" direction="ltr">' + digits(e.run) + T(' running · ') + digits(e.done) + T(' in') + '</text>' +
        '<text x="0" y="27" font-size="9.5" fill="' + (flag ? '#8A2F2A' : '#39414C') + '" direction="ltr">' + (flag || T('no open issue')) + '</text></g>'
    })
    // the wall clock tells the real time
    const [cx, cy] = P(11.5, 0, 50)
    const t = new Date(S.now)
    const ha = ((t.getHours() % 12) + t.getMinutes() / 60) / 12 * 2 * Math.PI
    const ma = t.getMinutes() / 60 * 2 * Math.PI
    base += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="9" ry="11" fill="#E9E4D8" stroke="#9C9484" stroke-width="2"/>' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.sin(ma) * 7).toFixed(1) + '" y2="' + (cy - Math.cos(ma) * 8).toFixed(1) + '" stroke="#1D2530" stroke-width="1.4"/>' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.sin(ha) * 4.5).toFixed(1) + '" y2="' + (cy - Math.cos(ha) * 5.5).toFixed(1) + '" stroke="#1D2530" stroke-width="1.8"/>'
    const floorText = (gx, gy, text) => {
      const [x, y] = P(gx, gy)
      return '<text transform="matrix(0.894,0.447,-0.894,0.447,' + x + ',' + y + ')" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="#453E32" direction="rtl" text-anchor="middle">' + text + '</text>'
    }
    base += floorText(3.6, 6.6, DEPTS.build.label) + floorText(11.4, 6.6, DEPTS.review.label) + floorText(18.6, 6.6, DEPTS.docs.label)
    // a company office: its head sits at the round table; HQ's head is the supervisor
    const lead = desks.lead === undefined ? 'supervisor' : desks.lead
    base += floorText(3.6, 13.8, DEPTS.design.label) + floorText(11.1, 13.6, lead && lead !== 'supervisor' ? T('Lead desk') : T('Supervisor desk')) + floorText(18.6, 13.9, T('Break room'))

    const part = (gx, gy, w, d) => add(gx + w / 2 + gy + d / 2 - 0.4, box(gx, gy, w, d, 18, 0, '#6F7B88', '#4E5966', '#44505C'))
    part(0, 7.0, 6.2, 0.18); part(8.4, 7.0, 5.4, 0.18); part(16.2, 7.0, 5.8, 0.18)
    part(7.3, 0.6, 0.18, 5.6); part(14.9, 0.6, 0.18, 5.6)

    // desks, and whoever is working at them
    const guestSet = new Set(GUEST.map((g) => g.join(',')))
    for (const [agent, [gx, gy]] of desks) {
      const isGuest = guestSet.has(gx + ',' + gy)
      const runs = S.busy.get(agent)
      const run = runs && runs[0]
      const def = AGENT.get(agent)
      const role = isGuest || !def || !Object.prototype.hasOwnProperty.call(ROLE, def.color) ? '#6F7B88' : ROLE[def.color]
      add(gx + gy - 0.6, box(gx + 0.1, gy - 0.85, 0.6, 0.5, 10, 0, '#3C4652', '#2C343E', '#262D36') +
        box(gx + 0.1, gy - 0.95, 0.6, 0.1, 26, 0, '#3C4652', '#2C343E', '#262D36'))
      let desk = box(gx, gy, 2, 0.9, 14, 0, '#B98A5A', '#8E6640', '#7A5636')
      desk += poly([P(gx, gy + 0.9, 0), P(gx + 2, gy + 0.9, 0), P(gx + 2, gy + 0.9, 3), P(gx, gy + 0.9, 3)], role)
      desk += box(gx + 1.3, gy + 0.05, 0.62, 0.12, 15, 16, '#27303B', '#1F2730', '#1A2029')
      desk += box(gx + 1.53, gy + 0.15, 0.16, 0.16, 2, 14, '#27303B', '#1F2730', '#1A2029')
      const [lx, ly] = P(gx + 1.61, gy + 0.17, 26)
      desk += '<rect x="' + (lx - 1.5) + '" y="' + (ly - 1.5) + '" width="3" height="3" fill="' + (run ? (run.stale ? '#E5A33D' : '#3BE8B0') : '#44505C') + '"/>'
      if ((gx * 7 + gy) % 3 === 0) desk += box(gx + 0.2, gy + 0.2, 0.45, 0.35, 3, 14, '#F2EEE4', '#D8D2C4', '#CBC4B4')
      desk += box(gx + 0.15, gy + 0.08, 0.6, 0.22, 1.5, 14, '#39424D', '#2A313A', '#242A32')
      if (run) {
        // the screen's light spills round the monitor; it pulses while typing
        const [gx2, gy2] = P(gx + 1.61, gy + 0.1, 24)
        desk = '<ellipse cx="' + gx2 + '" cy="' + gy2 + '" rx="24" ry="15" fill="url(#' + (run.stale ? 'mgw' : 'mg') + ')"' + (run.stale ? '' : ' class="glow" style="animation-delay:-' + (hash(agent) % 26) / 10 + 's"') + '/>' + desk
        const [sx, sy] = P(gx + 0.4, gy - 0.4, 16)
        const arr = arrive.get(agent)
        let wait = null
        if (arr) {
          const rt = arrivalRoute(arr.from, [gx, gy])
          const el = (S.now - arr.t0) / 1000
          if (el < rt.dur) { overlays.push({ kind: 'walker', agent, path: rt.d, dur: rt.dur, el }); wait = rt.dur - el }
        }
        const seat = sprite('seat', agent, sx, sy, 3, { typing: !run.stale })
        add(gx + gy + 0.2, wait === null ? seat : '<g class="appear" style="animation-delay:' + wait.toFixed(2) + 's">' + seat + '</g>')
        overlays.push({ kind: 'bubble', run, count: runs.length, x: sx, y: sy - 29, wait })
      }
      add(gx + gy + 1.4, desk)
    }

    // the supervisor's round table and its in-tray
    const [tx, ty] = P(11, 10.7, 16)
    const table = '<ellipse cx="' + tx + '" cy="' + (ty + 7) + '" rx="60" ry="30" fill="#6B4D31"/>' +
      '<ellipse cx="' + tx + '" cy="' + ty + '" rx="60" ry="30" fill="#B98A5A"/>' +
      '<ellipse cx="' + tx + '" cy="' + ty + '" rx="52" ry="25" fill="none" stroke="#A67B4F" stroke-width="1"/>'
    let tray = box(10.5, 10.9, 0.9, 0.7, 3, 16, '#3B4552', '#2C343E', '#262D36')
    S.today.slice(-6).forEach((d, i) => {
      const edge = { ok: '#9FD9C3', findings: '#E5A33D', failed: '#E0625C', stopped: '#A0A9B4' }[stOf(d.status)]
      tray += box(10.56 + (i % 2) * 0.03, 10.95, 0.78, 0.6, 1.6, 19 + i * 1.8, '#F4F1EA', edge, '#D8D2C4')
    })
    const [spx, spy] = P(10.6, 9.35, 16)
    const leadRuns = lead ? S.busy.get(lead) : null
    if (lead) add(19.8, sprite('seat', lead, spx, spy, 3, { typing: !!(leadRuns && !leadRuns[0].stale) }))
    add(21.0, table + tray)
    if (leadRuns) overlays.push({ kind: 'bubble', run: leadRuns[0], count: leadRuns.length, x: spx, y: spy - 29 })
    else if (lead) overlays.push({ kind: 'boss', x: spx, y: spy - 29, name: lead })
    // home staff working in another office: an empty chair that says where (spec R16)
    for (const w of desks.away || []) {
      const [ax, ay] = P(w.desk[0] + 1, w.desk[1] + 0.2, 30)
      overlays.push({ kind: 'away', x: ax, y: ay, agent: w.agent, officeId: w.officeId })
    }
    if (desks.overflow && desks.overflow.length) {
      const [ox, oy] = P(0.6, 13.6)
      overlays.push({ kind: 'ovf', x: ox, y: oy, list: desks.overflow.map((a) => ({ agent: a, run: (S.busy.get(a) || [])[0] })) })
    }
    const trayO = S.today.length ? overlays[overlays.push({ kind: 'tray', n: S.today.length }) - 1] : null
    if (trayO) [trayO.x, trayO.y] = P(10.95, 11.2, 34)
    const handIn = handInOf(S)
    if (handIn) {
      const [hx, hy] = P(HANDIN_AT[0], HANDIN_AT[1])
      let wait = null
      if (handWalk && handWalk.key === handIn.key && handWalk.desk) {
        const rt = handInRoute(handWalk.desk)
        const el = (S.now - handWalk.t0) / 1000
        if (el < rt.dur + 1.6) {
          if (el < rt.dur) overlays.push({ kind: 'walker', agent: handIn.agent, path: rt.d, dur: rt.dur, el, paper: true })
          wait = rt.dur - el
          // the slip leaves the hand, arcs over the table and drops in the tray
          const [ex, ey] = P(10.95, 11.25, 36)
          overlays.push({ kind: 'fly', path: 'M' + hx + ',' + (hy - 20) + ' Q' + ((hx + ex) / 2).toFixed(1) + ',' + (Math.min(hy, ey) - 46).toFixed(1) + ' ' + ex.toFixed(1) + ',' + ey.toFixed(1), wait })
          if (trayO) trayO.wait = wait + 0.8
        }
      }
      const man = sprite('stand', handIn.agent, hx, hy, 3, { paper: !(handWalk && handWalk.key === handIn.key) })
      add(25.4, wait === null ? man : '<g class="appear" style="animation-delay:' + wait.toFixed(2) + 's">' + man + '</g>')
      overlays.push({ kind: 'handin', x: hx, y: hy - 44, run: handIn, wait })
    }

    // lounge furniture
    add(24.6, box(16.1, 8.1, 3.4, 0.35, 26, 0, '#58707D', '#465A66', '#3C4E59'))
    add(25.0, box(16.1, 8.45, 3.4, 0.8, 10, 0, '#6A8491', '#526A77', '#475D69'))
    add(29.4, box(17.2, 10.3, 1.7, 0.9, 8, 0, '#8E6640', '#6E4E31', '#5E4229') + box(17.5, 10.5, 0.2, 0.2, 4, 8, '#F4F1EA', '#D8D2C4', '#CBC4B4'))
    add(30.8, box(20.2, 10.6, 0.95, 0.95, 9, 0, '#6A8491', '#526A77', '#475D69') + box(20.2, 10.5, 0.95, 0.15, 22, 0, '#58707D', '#465A66', '#3C4E59'))
    add(27.9, box(20.1, 7.4, 1.8, 0.7, 20, 0, '#5E6A76', '#48525D', '#3E4751') + box(21.0, 7.5, 0.55, 0.45, 18, 20, '#2A3139', '#20262D', '#1B2026'))
    const [pgx, pgy] = P(15.8, 13.2)
    add(29.2, box(15.5, 12.95, 0.6, 0.6, 12, 0, '#9C6B48', '#7E5337', '#6E472E') +
      '<circle cx="' + pgx + '" cy="' + (pgy - 28) + '" r="13" fill="#4F7A4F"/><circle cx="' + (pgx - 8) + '" cy="' + (pgy - 36) + '" r="9" fill="#5E8C59"/><circle cx="' + (pgx + 7) + '" cy="' + (pgy - 39) + '" r="8" fill="#6A9A63"/>')

    // the lounge: worked today, not working now; latest first
    const seen = new Set()
    const idle = []
    for (const r of S.today.slice().reverse()) {
      if (seen.has(r.agent) || S.busy.has(r.agent) || (handIn && r.agent === handIn.agent)) continue
      seen.add(r.agent); idle.push(r)
    }
    const loungeAt = new Map()
    idle.slice(0, LOUNGE.length).forEach((last, i) => {
      const s = LOUNGE[i]
      const [x, y] = P(s.at[0], s.at[1], s.z)
      loungeAt.set(last.agent, s.at)
      // idle people breathe (on the sofa) or sway (standing), out of step with each other
      const sway = '<g class="' + (s.kind === 'sofa' ? 'breathe' : 'bob') + '" style="animation-delay:-' + (i * 0.7).toFixed(1) + 's">' +
        sprite(s.kind === 'sofa' ? 'sofa' : 'stand', last.agent, x, y, 3, { dim: true }) + '</g>'
      add(s.at[0] + s.at[1] + 0.5, prev && !prev.lounge.has(last.agent) ? '<g class="appear">' + sway + '</g>' : sway)
      overlays.push({ kind: 'idle', agent: last.agent, x, y: y - (s.kind === 'sofa' ? 33 : 42) - 4, last })
    })
    if (idle.length > LOUNGE.length) {
      const [x, y] = P(21.3, 13.6)
      overlays.push({ kind: 'more', x, y, n: idle.length - LOUNGE.length })
    }

    // delegation: a slip travelling from the parent's desk to the child's
    let deleg = ''
    for (const child of S.active) {
      const parent = parentOf(S, child)
      if (!parent || !parent.live || parent.agent === child.agent) continue
      const a = desks.get(parent.agent), b = desks.get(child.agent)
      if (!a || !b) continue
      const [ax, ay] = P(a[0] + 1, a[1] + 1.35)
      const [bx, by] = P(b[0] + 1, b[1] + 1.35)
      const mx = (ax + bx) / 2, my = Math.max(ay, by) + 18
      const d = 'M' + ax + ',' + ay + ' Q' + mx + ',' + my + ' ' + bx + ',' + by
      deleg += '<path class="flow" d="' + d + '" fill="none" stroke="#2B6CB0" stroke-width="2" stroke-dasharray="5 5" opacity="0.9"/>' +
        '<circle cx="' + ax + '" cy="' + ay + '" r="3" fill="#2B6CB0"/><path d="M' + (bx - 6) + ',' + (by - 1) + ' l6,1 l-4,5" fill="none" stroke="#2B6CB0" stroke-width="2"/>'
      overlays.push({ kind: 'deleg', x: mx, y: my + 2, path: d, parent, child })
    }

    items.sort((a, b) => a[0] - b[0])
    const glow = (id, c) => '<radialGradient id="' + id + '"><stop offset="0" stop-color="' + c + '" stop-opacity=".75"/><stop offset=".55" stop-color="' + c + '" stop-opacity=".25"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>'
    const svg = '<svg class="iso" width="1060" height="716" viewBox="0 0 1060 716" shape-rendering="crispEdges" aria-hidden="true">' +
      '<defs>' + glow('mg', '#7DF5CF') + glow('mgw', '#F2B75A') + '</defs>' +
      base + '<g shape-rendering="geometricPrecision">' + deleg + '</g>' + items.map((i) => i[1]).join('') + '</svg>'
    return { svg, overlays: layout(overlays, current), loungeAt }
  }

  // ---------- the office in 3D (office3d, office-world.cjs): one desk per person
  // The same people and states as the flat office: whoever has a desk here,
  // whoever worked here today, the lead at the supervisor's station in the
  // middle and the reports in its tray. Each person's state is all the 3D
  // floor needs: it walks them from the lounge to the supervisor and their
  // desk and back as the state changes. The labels are the flat office's own
  // bubbles, pinned to a desk; the 3D floor places them over its points.
  // One figure per run: the first run of an agent sits at the agent's own desk,
  // every further run at the same time takes a desk of its own (the agent's id
  // and #n) and keeps it while it runs.
  const runNums = new Map() // office key -> Map(run key -> n)
  function scene3d(S, desks, current) {
    const lead = desks.lead === undefined ? 'supervisor' : desks.lead
    const lastBy = new Map()
    for (const r of S.today) lastBy.set(r.agent, r)
    const waiting = new Set((DATA.gates || []).filter((g) => g.status === 'waiting' && g.run).map((g) => g.run))
    const away = new Map((desks.away || []).map((w) => [w.agent, w]))
    const order = []
    const add = (a) => { if (a && a !== lead && !order.includes(a)) order.push(a) }
    // a desk on the plan is a podium only for someone who exists here: an
    // agent defined in this install, a company employee, or whoever worked today
    const known = (a) => AGENT.has(a) || S.busy.has(a) || lastBy.has(a) || !!(CO && CO.emp(a))
    for (const [a] of desks) if (known(a)) add(a)
    for (const a of desks.overflow || []) add(a)
    for (const a of S.busy.keys()) add(a)
    for (const r of S.today) add(r.agent) // worked here today with no desk: a podium all the same
    const GLYPH = { working: '▶', quiet: '◷', waiting: '!', done: '✓', findings: '!', failed: '✕', stopped: '■', away: '→' }
    const WORD = { working: STATUS.running.label, quiet: T('Quiet'), waiting: T('Waiting for you'), done: STATUS.ok.label, findings: STATUS.findings.label, failed: STATUS.failed.label, stopped: STATUS.stopped.label }
    const key = (CO ? officeId : '') || 'office'
    const nums = runNums.get(key) || new Map()
    runNums.set(key, nums)
    const liveKeys = new Set()
    for (const runs of S.busy.values()) for (const r of runs) liveKeys.add(r.key)
    for (const k of [...nums.keys()]) if (!liveKeys.has(k)) nums.delete(k)
    for (const [agent, runs] of S.busy) {
      const taken = new Set(runs.map((r) => nums.get(r.key)).filter(Boolean))
      for (const r of runs.slice().sort((a, b) => a.start - b.start)) {
        if (nums.has(r.key)) continue
        let n = 1
        while (taken.has(n)) n++
        taken.add(n); nums.set(r.key, n)
      }
    }
    const podId = (run) => (nums.get(run.key) || 1) > 1 ? run.agent + '#' + nums.get(run.key) : run.agent
    // the runs at the agent's own desk: none when that run is over and only a later one still works
    const deskRuns = (agent) => (S.busy.get(agent) || []).filter((r) => (nums.get(r.key) || 1) === 1)
    const stateOf = (agent) => {
      const runs = deskRuns(agent)
      if (away.has(agent) && !runs.length) return 'away'
      if (runs.length) return runs.every((r) => r.stale) ? 'quiet' : 'working'
      const last = lastBy.get(agent)
      if (!last) return 'idle'
      if (last.id && waiting.has(last.id)) return 'waiting'
      return { ok: 'done', findings: 'findings', failed: 'failed', stopped: 'stopped' }[stOf(last.status)]
    }
    const animOf = (agent, st) => st === 'working' ? (agent === lead ? 'thinking' : 'typing')
      : st === 'quiet' || st === 'failed' ? 'thinking'
        : st === 'done' && S.now - lastBy.get(agent).end < 12000 ? 'celebrate' : 'idle'
    // The one small label over a head: a tone (its colours) and a status word. Quiet, stalled
    // and dead are three steps of the same silence (runHealth); the figure itself still sits
    // thinking at its desk in all three, so the 3D floor keeps its two states.
    const pillOf = (st, run) => {
      const silent = run && run.live ? quietSpan(S.now - run.lastAt) : ''
      if (st === 'working') return { tone: 'work', word: STATUS.running.label }
      if (st === 'quiet') {
        const hl = (run && run.health) || 'quiet'
        return hl === 'dead' ? { tone: 'dead', word: T('Dead') + ' · ' + silent } : hl === 'stalled' ? { tone: 'stalled', word: T('Stalled') + ' ' + silent } : { tone: 'quiet', word: T('Quiet') + ' ' + silent }
      }
      if (st === 'waiting') return { tone: 'wait', word: WORD.waiting }
      if (st === 'done') return { tone: 'idle', word: T('Done') + (run && !run.live && !isNaN(run.end) ? ' ' + hhmm(run.end) : '') }
      if (st === 'findings') return { tone: 'wait', word: WORD.findings }
      if (st === 'failed') return { tone: 'stalled', word: WORD.failed }
      if (st === 'stopped') return { tone: 'idle', word: WORD.stopped }
      if (st === 'away') return { tone: 'dead', word: T('Away') }
      return { tone: 'idle', word: T('Free') }
    }
    const podium = (agent, kind, extra) => {
      const st = extra ? (extra.stale ? 'quiet' : 'working') : stateOf(agent)
      const pal = palette(agent)
      const run = extra || deskRuns(agent)[0] || lastBy.get(agent) || null
      const name = agent === 'supervisor' ? T('Supervisor') : extra ? personName(agent) + T(' · run ') + digits(nums.get(extra.key)) : personName(agent)
      const pill = pillOf(st, run)
      return {
        id: extra ? podId(extra) : agent, kind, agent, state: st, anim: animOf(agent, st), shirt: pal.c, hair: pal.h, skin: pal.s, seed: seedOf(agent), tone: toneOf(agent),
        name, sub: WORD[st] || '', glyph: GLYPH[st] || '', pill, present: st !== 'away',
        attrs: run ? 'data-key="' + esc(run.key) + '"' : '', selKey: run ? run.key : '',
        aria: name + T(', ') + pill.word,
      }
    }
    const pods = []
    if (lead) pods.push(podium(lead, 'lead'))
    for (const a of order) {
      pods.push(podium(a, 'desk'))
      for (const r of (S.busy.get(a) || []).slice().sort((x, y) => (nums.get(x.key) || 1) - (nums.get(y.key) || 1))) if ((nums.get(r.key) || 1) > 1 && a !== lead) pods.push(podium(a, 'desk', r))
    }
    pods.push({ id: '~tray', kind: 'tray', state: 'none', present: true, count: S.today.length, attrs: 'data-open="1"', name: digits(S.today.length) + T(' reports handed in'), aria: digits(S.today.length) + T(' reports handed in') })
    const has = new Set(pods.map((p) => p.id))
    // the hand-in, the empty chairs, the delegations; the people's own labels are the pills (syncCards)
    const pin = (html, id, at, extra) => html.replace(/^<(\w+) /, '<$1 data-anchor="' + esc(id) + '" data-at="' + at + '"' + (extra || '') + ' ')
    let overlay = ''
    const keys = new Set()
    const hand = handInOf(S)
    if (hand) overlay += pin(overlayHtml({ kind: 'handin', x: 0, y: 0, run: hand, wait: null }, current), '~tray', 'tray')
    for (const w of desks.away || []) if (has.has(w.agent) && !S.busy.has(w.agent)) overlay += pin(overlayHtml({ kind: 'away', x: 0, y: 0, agent: w.agent, officeId: w.officeId }, current), w.agent, 'head')
    const links = []
    for (const child of S.active) {
      const parent = parentOf(S, child)
      if (!parent || !parent.live || parent.agent === child.agent || !has.has(podId(parent)) || !has.has(podId(child))) continue
      links.push([podId(parent), podId(child)])
      overlay += '<span class="deleg" data-anchor="' + esc(podId(parent)) + '" data-anchor2="' + esc(podId(child)) + '" data-at="mid">' + esc(parent.agent) + ' ← ' + esc(child.agent) + T(' · delegated ') + '<span dir="ltr">' + hhmm(child.start) + '</span></span>'
    }
    // the projects that had work today, as on the flat office's wall boards
    const proj = new Map()
    const bump = (k, f) => { if (!k) return; const e = proj.get(k) || { run: 0, done: 0, findings: 0, failed: 0 }; f(e); proj.set(k, e) }
    S.active.forEach((a) => bump(a.projectKey, (e) => e.run++))
    S.today.forEach((r) => bump(r.projectKey, (e) => { e.done++; if (r.status === 'findings') e.findings++; if (r.status === 'failed') e.failed++ }))
    const top = [...proj.entries()].sort((a, b) => (b[1].run - a[1].run) || (b[1].done - a[1].done)).slice(0, 3).map(([name, e]) => {
      const flag = e.failed ? 'x ' + digits(e.failed) + T(' failed') : e.findings ? '! ' + digits(e.findings) + T(' with findings') : ''
      return { name, e, counts: digits(e.run) + T(' running · ') + digits(e.done) + T(' in'), flag: flag || T('no open issue') }
    })
    const projects = top.map((p) => '<div><b dir="ltr">' + esc(p.name) + '</b>' + p.counts + '<br><span' + (p.e.failed ? ' class="bad"' : '') + '>' + p.flag + '</span></div>').join('')
    // the same projects on the screens of the office's wall
    const boards = top.map((p) => ({ title: p.name, lines: [p.counts, p.flag], bad: !!p.e.failed }))
    const title = CO ? CO.oname(CO.officeById(officeId)) : ''
    // the office's colour: the floor's border and the sign on the back wall
    const color = CO ? ((CO.officeById(officeId) || {}).color || '') : ''
    // the head's station is the supervisor's, as the flat office labels it
    const supLabel = lead && lead !== 'supervisor' ? T('Lead desk') : T('Supervisor desk')
    return { key, view: view3[key] || null, selected: current ? (current.live && has.has(podId(current)) ? podId(current) : has.has(current.agent) ? current.agent : null) : null, podiums: pods, links, overlay, projects, boards, title, color, supLabel, keys }
  }

  // a report handed in within the last minute and a half is still being delivered
  const handInOf = (S) => S.today.slice().reverse().find((r) => S.now - r.end < 90000 && !S.busy.has(r.agent)) || null

  // What changed since the last drawing starts a walk, a pulse or a fade.
  // On the first drawing nothing has "changed", so only a run that began
  // (or ended) in the last few seconds is animated.
  function noteMotion(S, desks) {
    const now = S.now
    for (const [agent, a] of arrive) if (now - a.t0 > 8000) arrive.delete(agent)
    for (const [k, t] of newsAt) if (now - t > 1000) newsAt.delete(k)
    if (calm()) { arrive.clear(); handWalk = null; newsAt.clear(); return }
    for (const [agent, runs] of S.busy) {
      const first = runs.reduce((a, b) => (a.start < b.start ? a : b))
      const fresh = prev ? !prev.busy.has(agent) : now - first.start < 6000
      if (fresh && !arrive.has(agent) && desks.has(agent)) arrive.set(agent, { t0: prev ? now : first.start, from: prev && prev.lounge.get(agent) })
      for (const r of runs) if (prev && prev.steps.has(r.key) && prev.steps.get(r.key) !== r.steps.length) newsAt.set(r.key, now)
    }
    const h = handInOf(S)
    if (h && (!handWalk || handWalk.key !== h.key)) {
      const fresh = prev ? !prev.today.has(h.key) : now - h.end < 6000
      const desk = (prev && prev.desks.get(h.agent)) || desks.get(h.agent)
      if (fresh && desk) handWalk = { key: h.key, t0: prev ? now : h.end, desk }
    }
  }

  // Bubbles are placed one at a time, most important first (the selected run,
  // then quiet ones, then the freshest news). Each tries a few sideways
  // offsets; if every one of them would cover a bubble already placed, it
  // shrinks to its name tag, which opens again on hover, focus or selection.
  // Lounge tags are then lifted until they clear everything placed so far.
  // Sizes are in office pixels; at a high zoom the labels are counter-scaled
  // (bubK < 1), take less floor, and fewer of them need to shrink.
  function layout(list, current) {
    const k = bubK
    const placed = []
    const bubbles = list.filter((o) => o.kind === 'bubble')
    const score = (o) => (current && o.run.key === current.key ? 1e15 : 0) + (o.run.stale ? 1e14 : 0) + (o.run.lastAt || 0)
    bubbles.sort((a, b) => score(b) - score(a))
    for (const o of list.filter((o) => o.kind === 'handin' || o.kind === 'boss')) {
      const w = (o.kind === 'boss' ? 60 : 234) * k
      const h = (o.kind === 'boss' ? 22 : 64) * k
      placed.push([o.x - w / 2, o.y - h, o.x + w / 2, o.y])
    }
    // every person has one pill over the head; a pill that would touch one already placed
    // steps up until it clears (the renderer's own rule, as liftPills in the 3D office)
    const pillW = (o) => (30 + (o.kind === 'idle' ? o.agent : o.run.agent).length * 7.2) * k
    for (const o of bubbles.concat(list.filter((o) => o.kind === 'idle'))) {
      const w = pillW(o), h = 22 * k
      o.lift = 0
      if (pillOf(o).tone === 'idle') continue
      for (let i = 0; i < 16; i++) {
        const r = [o.x - w / 2, o.y - o.lift - h, o.x + w / 2, o.y - o.lift]
        const hitP = placed.find((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])
        if (!hitP) break
        o.lift = o.y - hitP[1] + 2 * k
      }
      placed.push([o.x - w / 2, o.y - o.lift - h, o.x + w / 2, o.y - o.lift])
    }
    return list
  }

  // One animation per label: arriving (held back until its walker sits
  // down), fresh news (a single pulse), or simply new on the floor (fade in).
  function motion(o, id) {
    if (o.wait != null && o.wait > -0.45) return [' appear', 'animation-delay:' + o.wait.toFixed(2) + 's;']
    const t = newsAt.get(id.slice(id.indexOf(':') + 1))
    if (o.kind === 'bubble' && t) return [' news', 'animation-delay:' + ((t - Date.now()) / 1000).toFixed(2) + 's;']
    if (prev && !prev.keys.has(id)) return [' enter', '']
    return ['', '']
  }
  const overlayId = (o) => (o.kind === 'bubble' ? 'b:' + o.run.key : o.kind === 'idle' ? 'i:' + o.last.key : o.kind === 'handin' ? 'h:' + o.run.key : '')

  // ---------- crowded pills (owner, 1.2): pills that sit close together collapse into one
  // counter chip ("3 working") that opens on hover, focus or a click; in the demo's showcase at
  // most four pills show, the most urgent first, and nothing else. Both floors use it: the flat
  // one after each draw, the 3D one through its declutter (h.crowd). `redo` draws the pills again.
  const CROWD_WORD = { work: 'working', wait: 'waiting', quiet: 'quiet' }
  const URGENT = { stalled: 0, dead: 0, wait: 1, quiet: 1, work: 2 }
  const crowdOpen = new Set()
  let crowdArea = null, crowdRedo = null
  const toneOfPill = (e) => (/(?:^| )tone-(\w+)/.exec(e.className) || [])[1] || ''
  const pillKey = (e) => e.dataset.anchor || e.dataset.key || ''
  document.addEventListener('pointermove', (e) => {
    // an opened group closes again once the pointer has left it
    if (!crowdArea) return
    const a = crowdArea
    if (e.clientX < a.left - 40 || e.clientX > a.right + 40 || e.clientY < a.top - 90 || e.clientY > a.bottom + 30) { crowdOpen.clear(); crowdArea = null; if (crowdRedo) crowdRedo() }
  })
  function crowdPills(box, pills, redo) {
    crowdRedo = redo
    for (const c of box.querySelectorAll('.w3chip')) c.remove()
    for (const e of pills) e.classList.remove('w3in')
    const keep = (e) => e.classList.contains('sel') || e.classList.contains('hov') || e === document.activeElement
    const board = document.getElementById('board')
    if (board && board.classList.contains('showcase')) {
      const rank = (e) => (keep(e) ? -1 : Object.hasOwn(URGENT, toneOfPill(e)) ? URGENT[toneOfPill(e)] : 9)
      const order = pills.slice().sort((a, b) => rank(a) - rank(b))
      order.forEach((e, i) => { if (i >= 4 || rank(e) === 9) e.classList.add('w3in') })
      return
    }
    const cand = pills.filter((e) => Object.hasOwn(CROWD_WORD, toneOfPill(e)) && !keep(e))
    const R = new Map(cand.map((e) => [e, e.getBoundingClientRect()]))
    const near = (a, b) => a.left < b.right + 6 && a.right > b.left - 6 && a.top < b.bottom + 4 && a.bottom > b.top - 4
    const seen = new Set()
    for (const e of cand) {
      if (seen.has(e)) continue
      const tone = toneOfPill(e), g = [e]
      seen.add(e)
      for (let i = 0; i < g.length; i++) for (const f of cand) if (!seen.has(f) && toneOfPill(f) === tone && near(R.get(g[i]), R.get(f))) { g.push(f); seen.add(f) }
      if (g.length < 2) continue
      const key = tone + ':' + g.map(pillKey).sort()[0]
      if (crowdOpen.has(key)) continue
      for (const x of g) x.classList.add('w3in')
      const names = g.map((x) => (x.querySelector('b') || x).textContent).join(', ')
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'w3chip tone-' + tone
      chip.dataset.crowd = key
      chip.title = names
      chip.setAttribute('aria-label', digits(g.length) + ' ' + T(CROWD_WORD[tone]) + T(': ') + names)
      chip.innerHTML = '<i class="dot" aria-hidden="true"></i><b>' + digits(g.length) + ' ' + T(CROWD_WORD[tone]) + '</b>'
      // over the middle of the group, at its highest pill
      const xs = g.map((x) => parseFloat(x.style.left) || 0), ys = g.map((x) => parseFloat(x.style.top) || 0)
      chip.style.left = (xs.reduce((s, v) => s + v, 0) / xs.length).toFixed(1) + 'px'
      chip.style.top = Math.min(...ys).toFixed(1) + 'px'
      const rs = g.map((x) => R.get(x))
      const area = { left: Math.min(...rs.map((r) => r.left)), right: Math.max(...rs.map((r) => r.right)), top: Math.min(...rs.map((r) => r.top)), bottom: Math.max(...rs.map((r) => r.bottom)) }
      const open = (ev) => { if (ev && ev.type === 'click') ev.stopPropagation(); crowdOpen.add(key); crowdArea = area; if (redo) redo() }
      chip.addEventListener('mouseenter', open)
      chip.addEventListener('focus', open)
      chip.addEventListener('click', open)
      box.appendChild(chip)
    }
  }

  // the same tones and words as the 3D floor's pills (scene3d pillOf)
  function pillOf(o) {
    if (o.kind === 'idle') {
      const st = stOf(o.last.status)
      return st === 'findings' ? { tone: 'wait', word: STATUS.findings.label } : st === 'failed' ? { tone: 'stalled', word: STATUS.failed.label } : st === 'stopped' ? { tone: 'idle', word: STATUS.stopped.label } : { tone: 'idle', word: T('Done') + ' ' + hhmm(o.last.end) }
    }
    const r = o.run, q = quietSpan(Date.now() - r.lastAt)
    if (r.health === 'dead') return { tone: 'dead', word: T('Dead') + ' · ' + q }
    if (r.health === 'stalled') return { tone: 'stalled', word: T('Stalled') + ' ' + q }
    if (r.health === 'quiet') return { tone: 'quiet', word: T('Quiet') + ' ' + q }
    return { tone: 'work', word: STATUS.running.label }
  }

  function overlayHtml(o, current) {
    if (o.kind === 'walker') return walker(o.agent, o.path, o.dur, o.el, o.paper)
    if (o.kind === 'fly') return '<span class="fly" style="offset-path:path(\'' + o.path + '\');animation-delay:' + o.wait.toFixed(2) + 's" aria-hidden="true"></span>'
    if (o.kind === 'bubble' || o.kind === 'idle') {
      const run = o.kind === 'bubble' ? o.run : o.last
      const pl = pillOf(o)
      const isSel = current && (o.kind === 'bubble' ? current.key === run.key : current.agent === o.agent && !current.live)
      const [mc, ms_] = motion(o, overlayId(o))
      return '<button type="button" class="w3card tone-' + pl.tone + (isSel ? ' sel' : '') + mc + '" data-key="' + esc(run.key) + '" style="' + ms_ + 'left:' + o.x + 'px;top:' + (o.y - (o.lift || 0)) + 'px"' +
        ' aria-label="' + esc(run.agent + T(', ') + pl.word) + '" title="' + esc(pl.word) + '"><i class="dot" aria-hidden="true"></i><b dir="auto">' + esc(run.agent) + (o.kind === 'bubble' && o.count > 1 ? ' ×' + o.count : '') + '</b></button>'
    }
    if (o.kind === 'boss') return '<span class="tag boss" style="left:' + o.x + 'px;top:' + o.y + 'px"><b' + (o.name && o.name !== 'supervisor' ? ' dir="ltr" class="mono"' : '') + '>' + (o.name && o.name !== 'supervisor' ? esc(o.name) : T('Supervisor')) + '</b></span>'
    if (o.kind === 'away') return '<button type="button" class="tag away" data-goto="office:' + esc(o.officeId) + '" style="left:' + o.x + 'px;top:' + o.y + 'px"><b dir="ltr">' + esc(o.agent) + '</b> ' + T('In ') + esc(CO ? CO.oname(CO.officeById(o.officeId)) : o.officeId) + ' →</button>'
    if (o.kind === 'ovf') return '<div class="ovf" style="left:' + o.x + 'px;top:' + o.y + 'px"><b>' + T('Overflow') + '</b> · ' + T('no free desk: ') + o.list.map((w) => '<button type="button" dir="ltr"' + (w.run ? ' data-key="' + esc(w.run.key) + '"' : '') + '>' + esc(w.agent) + '</button>').join(' ') + '</div>'
    if (o.kind === 'tray') return '<button type="button" class="tray-label badge' + (o.wait != null && o.wait > -0.7 ? ' land' : '') + '" data-open="1" style="' + (o.wait != null && o.wait > -0.7 ? 'animation-delay:' + o.wait.toFixed(2) + 's;' : '') + 'left:' + (o.x + 30) + 'px;top:' + (o.y + 62) + 'px" aria-label="' + esc(digits(o.n) + T(' reports handed in')) + '" title="' + esc(digits(o.n) + T(' reports handed in')) + '">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M3 13h5l1.5 3h5L16 13h5v6H3zM6 13l2-8h8l2 8"/></svg>' + '<b>' + digits(o.n) + '</b></button>'
    if (o.kind === 'more') return '<span class="tag more" style="left:' + o.x + 'px;top:' + o.y + 'px">+' + digits(o.n) + T(' more') + '</span>'
    if (o.kind === 'handin') {
      const r = o.run
      const st = stOf(r.status)
      const [mc, ms_] = motion(o, overlayId(o))
      return '<button type="button" class="bub hand g-' + st + mc + '" data-key="' + esc(r.key) + '" style="' + ms_ + 'left:' + o.x + 'px;top:' + o.y + 'px;--dx:-60px"' +
        ' aria-label="' + esc(r.agent + T(' handed in a report: ') + STATUS[st].label) + '">' +
        '<span class="bh"><b>' + esc(r.agent) + '</b><span class="el"><span class="g g-' + st + '">' + STATUS[st].g + '</span> ' + STATUS[st].label + ' · ' + hhmm(r.end) + '</span></span>' +
        '<span class="bt">' + esc(r.summary || cleanTask(r.task)) + '</span></button>'
    }
    if (o.kind === 'deleg') {
      return '<span class="deleg" style="left:' + o.x + 'px;top:' + o.y + 'px">' + esc(o.parent.agent) + ' ← ' + esc(o.child.agent) + T(' · delegated ') + '<span dir="ltr">' + hhmm(o.child.start) + '</span></span>' +
        '<span class="runner" style="offset-path:path(\'' + o.path + '\')" aria-hidden="true"></span>'
    }
    return ''
  }

