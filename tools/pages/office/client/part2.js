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
      const flag = e.failed ? 'x ' + fa(e.failed) + T(' failed') : e.findings ? '! ' + fa(e.findings) + T(' with findings') : ''
      base += poly([P(0, gy0, 18), P(0, gy0 + 4.0, 18), P(0, gy0 + 4.0, 60), P(0, gy0, 60)], '#E9E4D8')
      base += poly([P(0, gy0, 18), P(0, gy0 + 4.0, 18), P(0, gy0 + 4.0, 21), P(0, gy0, 21)], '#9C9484')
      const [tx, ty] = P(0, gy0 + 3.8, 52)
      const title = name.length > 15 ? name.slice(0, 14) + '…' : name
      base += '<g transform="matrix(0.894,-0.447,0,1,' + tx + ',' + ty + ')" font-family="Arial, Helvetica, sans-serif">' +
        '<text x="0" y="0" font-size="10.5" font-weight="700" fill="#1D2530" direction="ltr">' + esc(title) + '</text>' +
        '<text x="0" y="14" font-size="9.5" fill="#39414C" direction="ltr">' + fa(e.run) + T(' running · ') + fa(e.done) + T(' in') + '</text>' +
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
    base += floorText(3.6, 6.6, DEPTS.build.fa) + floorText(11.4, 6.6, DEPTS.review.fa) + floorText(18.6, 6.6, DEPTS.docs.fa)
    // a company office: its head sits at the round table; HQ's head is the supervisor
    const lead = desks.lead === undefined ? 'supervisor' : desks.lead
    base += floorText(3.6, 13.8, DEPTS.design.fa) + floorText(11.1, 13.6, lead && lead !== 'supervisor' ? T('Lead desk') : T('Supervisor desk')) + floorText(18.6, 13.9, T('Break room'))

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
    const WORD = { working: STATUS.running.fa, quiet: T('Quiet'), waiting: T('Waiting for you'), done: STATUS.ok.fa, findings: STATUS.findings.fa, failed: STATUS.failed.fa, stopped: STATUS.stopped.fa }
    const stateOf = (agent) => {
      if (away.has(agent) && !S.busy.has(agent)) return 'away'
      const runs = S.busy.get(agent)
      if (runs) return runs.every((r) => r.stale) ? 'quiet' : 'working'
      const last = lastBy.get(agent)
      if (!last) return 'idle'
      if (last.id && waiting.has(last.id)) return 'waiting'
      return { ok: 'done', findings: 'findings', failed: 'failed', stopped: 'stopped' }[stOf(last.status)]
    }
    const animOf = (agent, st) => st === 'working' ? (agent === lead ? 'thinking' : 'typing')
      : st === 'quiet' || st === 'failed' ? 'thinking'
        : st === 'done' && S.now - lastBy.get(agent).end < 12000 ? 'celebrate' : 'idle'
    const podium = (agent, kind) => {
      const st = stateOf(agent)
      const pal = palette(agent)
      const run = (S.busy.get(agent) || [])[0] || lastBy.get(agent) || null
      const name = agent === 'supervisor' ? T('Supervisor') : agent
      return {
        id: agent, kind, agent, state: st, anim: animOf(agent, st), shirt: pal.c, hair: pal.h, skin: pal.s,
        name, sub: WORD[st] || '', glyph: GLYPH[st] || '', present: st !== 'away',
        attrs: run ? 'data-key="' + esc(run.key) + '"' : '', selKey: run ? run.key : '',
        aria: name + (WORD[st] ? T(', ') + WORD[st] : ''),
      }
    }
    const pods = []
    if (lead) pods.push(podium(lead, 'lead'))
    for (const a of order) pods.push(podium(a, 'desk'))
    pods.push({ id: '~tray', kind: 'tray', state: 'none', present: true, count: S.today.length, attrs: 'data-open="1"', name: fa(S.today.length) + T(' reports handed in'), aria: fa(S.today.length) + T(' reports handed in') })
    const has = new Set(pods.map((p) => p.id))
    // the labels: one bubble per working person, the hand-in, the empty chairs, the delegations
    const pin = (html, id, at, extra) => html.replace(/^<(\w+) /, '<$1 data-anchor="' + esc(id) + '" data-at="' + at + '"' + (extra || '') + ' ')
    let overlay = ''
    const keys = new Set()
    for (const [agent, runs] of S.busy) {
      if (!has.has(agent)) continue
      const run = runs[0]
      const prio = (current && run.key === current.key ? 1e15 : 0) + (run.stale ? 1e14 : 0) + (run.lastAt || 0)
      const o = { kind: 'bubble', run, count: runs.length, x: 0, y: 0, dx: 0 }
      keys.add(overlayId(o))
      overlay += pin(overlayHtml(o, current), agent, 'card', ' data-prio="' + prio + '"')
    }
    const hand = handInOf(S)
    if (hand) overlay += pin(overlayHtml({ kind: 'handin', x: 0, y: 0, run: hand, wait: null }, current), '~tray', 'tray')
    for (const w of desks.away || []) if (has.has(w.agent) && !S.busy.has(w.agent)) overlay += pin(overlayHtml({ kind: 'away', x: 0, y: 0, agent: w.agent, officeId: w.officeId }, current), w.agent, 'head')
    const links = []
    for (const child of S.active) {
      const parent = parentOf(S, child)
      if (!parent || !parent.live || parent.agent === child.agent || !has.has(parent.agent) || !has.has(child.agent)) continue
      links.push([parent.agent, child.agent])
      overlay += '<span class="deleg" data-anchor="' + esc(parent.agent) + '" data-anchor2="' + esc(child.agent) + '" data-at="mid">' + esc(parent.agent) + ' ← ' + esc(child.agent) + T(' · delegated ') + '<span dir="ltr">' + hhmm(child.start) + '</span></span>'
    }
    // the projects that had work today, as on the flat office's wall boards
    const proj = new Map()
    const bump = (k, f) => { if (!k) return; const e = proj.get(k) || { run: 0, done: 0, findings: 0, failed: 0 }; f(e); proj.set(k, e) }
    S.active.forEach((a) => bump(a.projectKey, (e) => e.run++))
    S.today.forEach((r) => bump(r.projectKey, (e) => { e.done++; if (r.status === 'findings') e.findings++; if (r.status === 'failed') e.failed++ }))
    const top = [...proj.entries()].sort((a, b) => (b[1].run - a[1].run) || (b[1].done - a[1].done)).slice(0, 3).map(([name, e]) => {
      const flag = e.failed ? 'x ' + fa(e.failed) + T(' failed') : e.findings ? '! ' + fa(e.findings) + T(' with findings') : ''
      return { name, e, counts: fa(e.run) + T(' running · ') + fa(e.done) + T(' in'), flag: flag || T('no open issue') }
    })
    const projects = top.map((p) => '<div><b dir="ltr">' + esc(p.name) + '</b>' + p.counts + '<br><span' + (p.e.failed ? ' class="bad"' : '') + '>' + p.flag + '</span></div>').join('')
    // the same projects on the screens of the office's wall
    const boards = top.map((p) => ({ title: p.name, lines: [p.counts, p.flag], bad: !!p.e.failed }))
    const key = (CO ? officeId : '') || 'office'
    const title = CO ? CO.oname(CO.officeById(officeId)) : ''
    // the head's station is the supervisor's, as the flat office labels it
    const supLabel = lead && lead !== 'supervisor' ? T('Lead desk') : T('Supervisor desk')
    return { key, view: view3[key] || null, selected: current && has.has(current.agent) ? current.agent : null, podiums: pods, links, overlay, projects, boards, title, supLabel, keys }
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
    const hit = (r) => placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])
    const bubbles = list.filter((o) => o.kind === 'bubble')
    const score = (o) => (current && o.run.key === current.key ? 1e15 : 0) + (o.run.stale ? 1e14 : 0) + (o.run.lastAt || 0)
    bubbles.sort((a, b) => score(b) - score(a))
    for (const o of list.filter((o) => o.kind === 'handin' || o.kind === 'boss')) {
      const w = (o.kind === 'boss' ? 60 : 234) * k
      const h = (o.kind === 'boss' ? 22 : 64) * k
      placed.push([o.x - w / 2, o.y - h, o.x + w / 2, o.y])
    }
    for (const o of bubbles) {
      const h = (o.run.stale ? 86 : 68) * k
      o.dx = null
      if (current && o.run.key === current.key) o.forced = true
      for (const dx of [0, -64, 64, -100, 100]) {
        let x = o.x + dx * k
        x = Math.min(Math.max(x, 120 * k), 1060 - 120 * k)
        const r = [x - 118 * k, o.y - h - 2, x + 118 * k, o.y + 8]
        if (r[1] < 0) continue
        if (!hit(r) || o.forced) { o.dx = x - o.x; placed.push(r); break }
      }
      if (o.dx === null) {
        o.mini = true
        o.dx = 0
        const w = (26 + o.run.agent.length * 6.6 + 50) * k
        placed.push([o.x - w / 2, o.y - 22 * k, o.x + w / 2, o.y])
      }
    }
    for (const o of list.filter((o) => o.kind === 'idle')) {
      const w = (22 + o.agent.length * 6.6) * k
      o.lead = null
      for (let lead = 0; lead <= 64; lead += 4) {
        const r = [o.x - w / 2, o.y - lead - 20 * k, o.x + w / 2, o.y - lead]
        if (!hit(r)) { o.lead = lead; placed.push(r); break }
      }
      // no room: only the result glyph shows, the name on hover or focus
      if (o.lead === null) { o.mini = true; o.lead = 0; placed.push([o.x - 10 * k, o.y - 20 * k, o.x + 10 * k, o.y]) }
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

  function overlayHtml(o, current) {
    if (o.kind === 'walker') return walker(o.agent, o.path, o.dur, o.el, o.paper)
    if (o.kind === 'fly') return '<span class="fly" style="offset-path:path(\'' + o.path + '\');animation-delay:' + o.wait.toFixed(2) + 's" aria-hidden="true"></span>'
    if (o.kind === 'bubble') {
      const r = o.run
      const last = r.steps.length ? r.steps[r.steps.length - 1].text : T('Waiting for the first report…')
      const isSel = current && current.key === r.key
      const [mc, ms_] = motion(o, overlayId(o))
      return '<button type="button" class="bub' + (r.stale ? ' stale' : '') + (o.mini && !isSel ? ' mini' : '') + (isSel ? ' sel' : '') + mc +
        '" data-key="' + esc(r.key) + '" style="' + ms_ + 'left:' + o.x + 'px;top:' + o.y + 'px;--dx:' + o.dx + 'px"' +
        ' aria-label="' + esc(r.agent + T(', ') + STATUS.running.fa + (r.stale ? T(', quiet') : '') + T(', ') + last) + '">' +
        '<span class="bh"><b>' + esc(r.agent) + '</b><i class="mdl ' + (isHeavy(r.modelKey) ? 'opus' : 'son') + '">' + esc(r.modelKey || '—') + '</i>' +
        (o.count > 1 ? '<span class="n2">×' + o.count + '</span>' : '') +
        '<span class="el"><span class="qg">◷ </span>▶ <span data-since="' + r.start + '">' + span(Date.now() - r.start) + '</span></span></span>' +
        '<span class="bt">' + esc(last) + '</span>' +
        (r.stale ? '<span class="quiet">' + T('◷ quiet for ') + '<span data-quiet="' + r.lastAt + '">' + minsFa(Date.now() - r.lastAt) + '</span>' + T(' min') + '</span>' : '') +
        '</button>'
    }
    if (o.kind === 'idle') {
      const l = o.last
      const st = stOf(l.status)
      const isSel = current && current.agent === o.agent && !current.live
      const [mc, ms_] = motion(o, overlayId(o))
      return '<button type="button" class="tag' + (o.mini ? ' mini' : '') + (isSel ? ' sel' : '') + mc + '" data-key="' + esc(l.key) + '" style="' + ms_ + 'left:' + o.x + 'px;top:' + (o.y - o.lead) + 'px;--lead:' + o.lead + 'px"' +
        ' aria-label="' + esc(o.agent + T(', ready. Last task: ') + STATUS[st].fa) + '"><b>' + esc(o.agent) + '</b>' +
        '<span class="g g-' + st + '" title="' + STATUS[st].fa + '">' + STATUS[st].g + '</span></button>'
    }
    if (o.kind === 'boss') return '<span class="tag boss" style="left:' + o.x + 'px;top:' + o.y + 'px"><b' + (o.name && o.name !== 'supervisor' ? ' dir="ltr" class="mono"' : '') + '>' + (o.name && o.name !== 'supervisor' ? esc(o.name) : T('Supervisor')) + '</b></span>'
    if (o.kind === 'away') return '<button type="button" class="tag away" data-goto="office:' + esc(o.officeId) + '" style="left:' + o.x + 'px;top:' + o.y + 'px"><b dir="ltr">' + esc(o.agent) + '</b> ' + T('In ') + esc(CO ? CO.oname(CO.officeById(o.officeId)) : o.officeId) + ' →</button>'
    if (o.kind === 'ovf') return '<div class="ovf" style="left:' + o.x + 'px;top:' + o.y + 'px"><b>' + T('Overflow') + '</b> · ' + T('no free desk: ') + o.list.map((w) => '<button type="button" dir="ltr"' + (w.run ? ' data-key="' + esc(w.run.key) + '"' : '') + '>' + esc(w.agent) + '</button>').join(' ') + '</div>'
    if (o.kind === 'tray') return '<button type="button" class="tray-label' + (o.wait != null && o.wait > -0.7 ? ' land' : '') + '" data-open="1" style="' + (o.wait != null && o.wait > -0.7 ? 'animation-delay:' + o.wait.toFixed(2) + 's;' : '') + 'left:' + (o.x + 30) + 'px;top:' + (o.y + 62) + 'px">' + fa(o.n) + T(' reports handed in') + '</button>'
    if (o.kind === 'more') return '<span class="tag more" style="left:' + o.x + 'px;top:' + o.y + 'px">+' + fa(o.n) + T(' more') + '</span>'
    if (o.kind === 'handin') {
      const r = o.run
      const st = stOf(r.status)
      const [mc, ms_] = motion(o, overlayId(o))
      return '<button type="button" class="bub hand g-' + st + mc + '" data-key="' + esc(r.key) + '" style="' + ms_ + 'left:' + o.x + 'px;top:' + o.y + 'px;--dx:-60px"' +
        ' aria-label="' + esc(r.agent + T(' handed in a report: ') + STATUS[st].fa) + '">' +
        '<span class="bh"><b>' + esc(r.agent) + '</b><span class="el"><span class="g g-' + st + '">' + STATUS[st].g + '</span> ' + STATUS[st].fa + ' · ' + hhmm(r.end) + '</span></span>' +
        '<span class="bt">' + esc(r.summary || cleanTask(r.task)) + '</span></button>'
    }
    if (o.kind === 'deleg') {
      return '<span class="deleg" style="left:' + o.x + 'px;top:' + o.y + 'px">' + esc(o.parent.agent) + ' ← ' + esc(o.child.agent) + T(' · delegated ') + '<span dir="ltr">' + hhmm(o.child.start) + '</span></span>' +
        '<span class="runner" style="offset-path:path(\'' + o.path + '\')" aria-hidden="true"></span>'
    }
    return ''
  }

