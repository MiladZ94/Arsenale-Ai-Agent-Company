  // ========== the Marketplace (spec 1.2, 4.3): the bundled packs, a pack from a folder or a .zip, the local packs installed
  // A local pack is uploaded as its bytes and checked on the server (api/pack-local); this page only reads the files the
  // owner picked and shows the review. Every word of the pack is shown as text, never as HTML.
  // a first check before uploading; the server decides (1 MB of pack, a 2 MB body once it is base64)
  const MK_MAX_FILES = 200, MK_MAX_BYTES = 1280 * 1024
  st.mk = { busy: false, err: '', review: null, keep: {}, conflict: '', ask: '', msg: null }
  function marketMain() {
    if (!LIVE) return liveOnly()
    return head(T('Marketplace'), T('Ready-made teams for an office')) + '<div class="mkt">' + packsTab(true) + localPart() + '<p class="note">' + T('Online packs: later.') + '</p></div>'
  }
  const kb = (n) => (n < 1024 ? digits(n) + ' B' : digits(Math.round(n / 102.4) / 10) + ' KB')
  function localPart() {
    const m = st.mk
    let html = '<div class="mkt-local"><div class="sec">' + T('From a folder or a .zip') + ' <small>' + T('A pack someone gave you') + '</small></div>'
    html += '<div class="card pad"><p class="soft">' + T('A pack is instructions your assistant will follow. Arsenale checks that it holds only text, shows you all of it, and gives its members read-only tools unless you keep theirs.') + '</p>'
    if (canWrite() && co() && !m.review) html += '<div class="rw" style="gap:8px;margin-top:12px;flex-wrap:wrap"><b class="hi">' + T('Install from a folder or .zip…') + '</b><button type="button" class="b sm" data-ev="mk-pick" data-arg="folder"' + (m.busy ? ' disabled' : '') + '>' + T('Choose a folder') + '</button><button type="button" class="b sm" data-ev="mk-pick" data-arg="zip"' + (m.busy ? ' disabled' : '') + '>' + T('Choose a .zip') + '</button>' + (m.busy ? '<span class="mut sm">' + T('Checking…') + '</span>' : '') + '</div>' +
      '<input type="file" id="mk-folder" webkitdirectory multiple hidden data-ev-change="mk-files"><input type="file" id="mk-zip" accept=".zip,application/zip" hidden data-ev-change="mk-files">'
    else if (!co()) html += '<p class="note" style="margin-top:10px">' + T('Set up your company first: a pack adds an office to it.') + '</p>'
    if (m.err) html += '<p class="msg err mkt-pre" role="alert">' + esc(errTxt(m.err)) + '</p>'
    if (m.msg) html += '<p class="msg ' + (m.msg.ok ? 'ok' : 'err') + '" role="status">' + esc(m.msg.text) + '</p>'
    html += '</div>'
    if (m.review) html += reviewHtml(m.review)
    const d = st.data.packs
    const local = (d && d.local) || []
    if (local.length) {
      html += '<div class="card rows" style="margin-top:14px">' + local.map((p) => {
        const askHere = m.ask && m.ask.id === p.id
        return '<div class="r" style="flex-wrap:wrap"><div class="sp" style="min-width:0"><b class="hi" dir="auto">' + esc(p.name) + '</b> <span class="mut sm">' + T('version ') + ltr(p.version) + '</span><div class="rw" style="gap:6px;margin-top:4px;flex-wrap:wrap"><span class="chip warn sm">' + T('From a folder: not checked by Arsenale') + '</span>' +
          p.members.map((x) => '<span class="chip sm">' + esc(x.id) + ' · ' + T(x.toolsKept ? 'own tools' : 'read-only') + '</span>').join('') + (p.edited.length ? '<span class="mut sm">' + T('you changed: ') + esc(p.edited.join(', ')) + '</span>' : '') + '</div></div>' +
          (canWrite() ? '<button type="button" class="b sm bad' + armedCls('mk|rm|' + p.id) + '" data-ev="mk-remove" data-arg="' + esc(p.id) + '">' + esc(armedLabel('mk|rm|' + p.id, T('Remove'))) + '</button>' : '') +
          (askHere ? '<div style="flex-basis:100%"><p class="msg err">' + esc(m.ask.text) + '</p><div class="rw" style="gap:8px;margin-top:6px"><button type="button" class="b sm bad" data-ev="mk-remove-rest" data-arg="' + esc(p.id) + '">' + T('Remove the rest, keep my changes') + '</button><button type="button" class="b sm ghost" data-ev="mk-ask-cancel">' + T('Cancel') + '</button></div></div>' : '') + '</div>'
      }).join('') + '</div>'
    }
    return html + '</div>'
  }
  /** The review screen (rule 28.3): nothing is installed until Install. */
  function reviewHtml(r) {
    const m = st.mk
    let html = '<div class="card pad mkt-review" style="margin-top:14px"><div class="rw" style="gap:8px;flex-wrap:wrap"><b class="hi" style="font-size:15px" dir="auto">' + esc(r.name) + '</b><span class="mut sm">' + ltr(r.id) + ' · ' + T('version ') + ltr(r.version) + '</span><span class="chip warn sm">' + T(r.notChecked) + '</span></div>'
    html += '<p class="soft" dir="auto" style="margin:8px 0">' + esc(r.description) + '</p>'
    html += '<p class="soft">' + (r.update ? T('Updates the installed version ') + ltr(r.update) + '. ' + T('Files you changed are kept; their new text goes to pack-updates.') : T('Adds the office ') + '<b dir="auto">' + esc(r.office.name) + '</b>.') + '</p>'
    if (r.flags.length) {
      html += '<div class="mkt-flags"><b class="hi">' + T('Worth a look') + '</b> <span class="mut sm">' + T('Hints, not a guarantee: read the text yourself.') + '</span><ul>' + r.flags.map((f) => '<li><span class="mut">' + esc(f.file) + '</span> · ' + esc(T(f.what)) + (f.line ? ': <code dir="auto">' + esc(f.line) + '</code>' : '') + '</li>').join('') + '</ul></div>'
    }
    html += '<div class="sec" style="margin-top:14px">' + T('Members') + ' <small>' + T('Each gets read-only tools (Read, Grep, Glob) unless you keep the pack\'s own') + '</small></div><div class="card rows">'
    for (const x of r.members) {
      const kept = m.keep[x.id] === true
      const drop = x.dropped === 'all' ? T('No tools line: in Claude Code it would get every tool.') : x.dropped.length ? T('Read-only drops: ') + x.dropped.join(', ') : T('Already read-only.')
      html += '<div class="r" style="flex-wrap:wrap;align-items:flex-start"><div class="sp" style="min-width:0"><b class="hi" dir="auto">' + esc(x.title || x.id) + (x.lead ? ' ★' : '') + '</b> <span class="mut sm">' + ltr(x.id) + (x.zone ? ' · ' + esc(x.zone) : '') + (x.model ? ' · ' + T('model ') + esc(x.model) : '') + ' · ' + kb(x.size) + '</span>' +
        '<div class="sm" style="margin-top:4px"><span class="mut">' + T('The pack says: ') + '</span><code>' + esc(x.tools === null ? T('(no tools line)') : 'tools: ' + x.tools) + '</code></div><div class="mut sm">' + esc(drop) + '</div>' +
        '<details style="margin-top:6px"><summary>' + T('Full instructions') + '</summary><pre class="mkt-pre" dir="auto">' + esc(x.text) + '</pre></details></div>' +
        '<label class="rw sm" style="gap:6px"><input type="checkbox" data-ev-change="mk-keep" data-arg="' + esc(x.id) + '"' + (kept ? ' checked' : '') + '>' + T('Keep the pack\'s tools') + '</label></div>'
    }
    html += '</div>'
    const pol = Object.entries(r.policy || {})
    if (pol.length) html += '<div class="sec" style="margin-top:14px">' + T('Safety rules it makes stricter') + '</div><ul class="soft sm">' + pol.map(([who, rows]) => '<li>' + esc(who) + ': ' + esc(Object.entries(rows).map(([c, v]) => c + ' ' + v).join(', ')) + '</li>').join('') + '</ul>'
    if (r.sampleTasks.length) html += '<div class="sec" style="margin-top:14px">' + T('Sample tasks') + '</div><ul class="soft sm">' + r.sampleTasks.map((s) => '<li dir="auto">' + esc(s.title) + '</li>').join('') + '</ul>'
    if (r.readme) html += '<details style="margin-top:12px"><summary>README.md</summary><pre class="mkt-pre" dir="auto">' + esc(r.readme) + '</pre></details>'
    html += '<div class="sec" style="margin-top:14px">' + T('Files') + ' <small>' + digits(r.files.length) + ' · ' + kb(r.total) + '</small></div><table class="pol"><tbody>' + r.files.map((f) => '<tr><td><code>' + esc(f.path) + '</code></td><td class="mut">' + kb(f.size) + '</td></tr>').join('') + '</tbody></table>'
    if (m.conflict) html += '<p class="msg err">' + esc(errTxt(m.conflict)) + '</p><div class="rw" style="gap:8px;margin-top:6px"><button type="button" class="b sm" data-ev="mk-install" data-arg="keep">' + T('Keep yours') + '</button><button type="button" class="b sm" data-ev="mk-install" data-arg="rename">' + T('Install as a copy') + '</button></div>'
    else if (r.conflicts.length) html += '<p class="note" style="margin-top:10px">' + T('You have members with these names already: ') + esc(r.conflicts.join(', ')) + '</p>'
    html += '<div class="rw" style="gap:8px;margin-top:14px"><button type="button" class="b pri" data-ev="mk-install" data-arg=""' + (m.busy ? ' disabled' : '') + '>' + T(r.update ? 'Install the update' : 'Install') + '</button><button type="button" class="b ghost" data-ev="mk-cancel">' + T('Cancel') + '</button></div>'
    return html + '</div>'
  }
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s) }
  /** The picked files as the upload body: a .zip as its bytes, a folder as its files. */
  async function uploadBody(input) {
    const files = [...(input.files || [])]
    if (!files.length) return null
    if (files.length > MK_MAX_FILES) throw new Error(T('This folder has more than 200 files: a pack has at most 27.'))
    const total = files.reduce((n, f) => n + f.size, 0)
    if (total > MK_MAX_BYTES) throw new Error(T('This is larger than a pack may be (1 MB).'))
    if (input.id === 'mk-zip') return { op: 'stage', zip: b64(await files[0].arrayBuffer()) }
    const out = []
    for (const f of files) out.push({ path: f.webkitRelativePath || f.name, data: b64(await f.arrayBuffer()) })
    return { op: 'stage', files: out }
  }
  const mkBump = () => { st.dv++; h.redraw() }
  function mkInstall(onConflict) {
    const m = st.mk, r = m.review
    m.busy = true; m.err = ''; m.msg = null; mkBump()
    send('api/pack-local', { op: 'install', stage: r.stage, hash: r.hash, keep: m.keep, onConflict: onConflict || undefined }).then((b) => {
      const x = b.result
      st.mk = { busy: false, err: '', review: null, keep: {}, conflict: '', ask: '', msg: { ok: true, text: (x.replaced ? T('Updated: ') + x.replaced.join(', ') : T('Installed: ') + x.files.join(', ')) + (x.kept && x.kept.length ? ' · ' + T('kept yours: ') + x.kept.join(', ') : '') } }
      load('packs', 'api/packs', true); load('team', 'api/team', true); h.refresh(); mkBump()
    }, (e) => { m.busy = false; if (/already exist/.test(e.message)) m.conflict = e.message; else { m.err = e.message; if (/expired|changed after the review|refused/.test(e.message)) m.review = null } mkBump() })
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-ev]')
    if (!t) return
    const a = t.dataset.ev, arg = t.dataset.arg || ''
    const m = st.mk
    if (a === 'goto-market') { location.hash = '#/marketplace'; return }
    if (a === 'mk-pick') { const i = document.getElementById(arg === 'zip' ? 'mk-zip' : 'mk-folder'); if (i) { i.value = ''; i.click() } return }
    if (a === 'mk-cancel') { const r = m.review; st.mk = { busy: false, err: '', review: null, keep: {}, conflict: '', ask: '', msg: null }; if (r) send('api/pack-local', { op: 'cancel', stage: r.stage }).catch(() => { /* removed within the hour anyway */ }); mkBump(); return }
    if (a === 'mk-install') { mkInstall(arg); return }
    if (a === 'mk-ask-cancel') { m.ask = ''; mkBump(); return }
    if (a === 'mk-remove' || a === 'mk-remove-rest') {
      if (a === 'mk-remove' && !arm('mk|rm|' + arg)) return
      m.msg = null; m.ask = ''
      send('api/pack', { op: 'remove', id: arg, keepEdited: a === 'mk-remove-rest' }).then((b) => {
        const r = b.result
        m.msg = { ok: true, text: T('Removed.') + (r.kept.length ? ' ' + T('Kept because you changed them: ') + r.kept.join(', ') : '') }
        load('packs', 'api/packs', true); load('team', 'api/team', true); h.refresh(); mkBump()
      }, (err) => { if (/^You changed/.test(err.message)) m.ask = { id: arg, text: err.message }; else m.msg = { ok: false, text: errTxt(err.message) }; mkBump() })
    }
  })
  document.addEventListener('change', (e) => {
    const t = e.target.closest('[data-ev-change]')
    if (!t) return
    const a = t.dataset.evChange
    if (a === 'mk-keep') { st.mk.keep[t.dataset.arg] = t.checked; return }
    if (a !== 'mk-files') return
    const m = st.mk
    m.err = ''; m.msg = null; m.busy = true; mkBump()
    uploadBody(t).then((body) => (body ? send('api/pack-local', body) : null)).then((b) => {
      m.busy = false
      if (b) { m.review = b.result; m.keep = {}; m.conflict = '' }
      mkBump()
    }, (err) => { m.busy = false; m.err = err.message; mkBump() })
  })
