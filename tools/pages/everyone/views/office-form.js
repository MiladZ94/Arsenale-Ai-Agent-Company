  // ---------- New office and Edit office (spec 1.2 rules 15 to 18)
  // A side panel on Team, opened from Team's "Add an office", the Team
  // office filter's "Edit office" and the campus's "New office". The form
  // only asks: POST api/office checks every field again, and refuses anyone
  // but the owner. Nothing is written before Create office or Save; Cancel
  // and Escape write nothing.
  const kindList = () => (co() && co().kinds) || []
  /** The building type of an office: its building's, else its profile when that is a type. */
  function typeOfOffice(o) {
    const c = co()
    const b = c && c.campus && (c.campus.buildings || []).find((x) => x.officeId === o.id)
    if (b) return b.type
    return ((c && c.campus && c.campus.types) || []).some((t) => t.id === o.profile) ? o.profile : ''
  }
  function officeOpen(id) {
    const o = id ? officeById(id) : null
    st.ofc = o && !o.builtIn ? { id: o.id, name: o.name, theme: o.theme, type: typeOfOffice(o), kinds: (o.kinds || []).slice() } : { id: '', name: '', theme: '', type: '', kinds: [] }
    st.drawer = { type: 'office', id: st.ofc.id }
    st.dmsg = null
  }
  /** What is ticked now, kept while the panel redraws. */
  function readOffice(f) {
    const el = f.elements
    const pick = (n) => { const x = [...el].find((i) => i.name === n && i.checked); return x ? x.value : '' }
    st.ofc.name = el.name.value
    st.ofc.theme = pick('theme')
    st.ofc.type = pick('type')
    st.ofc.kinds = [...el].filter((i) => i.name === 'kind' && i.checked).map((i) => i.value)
  }
  function officeForm() {
    const f = st.ofc, c = co()
    if (!f || !c) return ''
    const edit = !!f.id
    const ro = !!c.readOnly || !canWrite()
    const types = (c.campus && c.campus.types) || []
    const pal = themes()
    // a kind another open office holds cannot be ticked here (rule 20)
    const holder = (k) => c.offices.find((o) => !o.builtIn && !o.archived && o.id !== f.id && (o.kinds || []).includes(k))
    let html = '<div class="ph"><div style="min-width:0"><h2 dir="auto">' + (edit ? esc(T('Edit ') + officeName(f.id)) : T('New office')) + '</h2></div><button type="button" class="x" data-ev="drawer-close" aria-label="' + T('Close') + '">' + ic('x', 18) + '</button></div>'
    html += '<form data-evform="office" id="oform" class="pb ofm">'
    if (c.readOnly) html += '<p class="note">' + ic('lock', 14) + T('Company data was written by a newer Arsenale. Editing is disabled.') + '</p>'
    // a refusal shows at the top, where it is seen without scrolling
    html += msgHtml() + '<fieldset' + (ro ? ' disabled' : '') + '>'
    html += '<label class="fl">' + T('Name') + '<input type="text" name="name" maxlength="40" required dir="auto" value="' + esc(f.name) + '"></label>'
    html += '<div class="fl" role="radiogroup" aria-label="' + T('Colour') + '">' + T('Colour') + '<div class="ofm-sw">' + Object.keys(pal).map((k) => '<label title="' + esc(k) + '"><input type="radio" name="theme" value="' + esc(k) + '"' + (f.theme === k ? ' checked' : '') + ' aria-label="' + esc(k) + '"><span class="sw" style="background:' + esc(pal[k]) + '"></span></label>').join('') + '</div>' + (edit ? '' : '<span class="hint">' + T('None picked: the building\'s own colour.') + '</span>') + '</div>'
    html += '<div class="fl" role="radiogroup" aria-label="' + T('Building') + '">' + T('Building') + '<div class="ofm-pick">' + types.map((t) => '<label class="pick"><input type="radio" name="type" value="' + esc(t.id) + '"' + (f.type === t.id ? ' checked' : '') + '><span>' + esc(T(t.name)) + '</span></label>').join('') + '</div></div>'
    html += '<div class="fl">' + '<span>' + T('Kinds of work') + ' <span class="op">' + T('Optional') + '</span></span><div class="ofm-kinds">' + kindList().map((k) => {
      const by = holder(k.id)
      return '<label class="chip' + (by ? ' held' : '') + '"' + (by ? ' title="' + esc(T('Held by ') + by.name) + '"' : '') + '><input type="checkbox" name="kind" value="' + esc(k.id) + '"' + (f.kinds.includes(k.id) ? ' checked' : '') + (by ? ' disabled' : '') + '>' + esc(T(k.label)) + (by ? ' · <span dir="auto">' + esc(by.name) + '</span>' : '') + '</label>'
    }).join('') + '</div><span class="hint">' + T('Work of a kind goes to the office that holds it. A kind has one office.') + '</span></div>'
    html += '</fieldset>'
    if (!edit) html += '<button type="button" class="b sm ghost" data-ev="goto-packs">' + T('Or install an office pack') + '</button>'
    html += '</form><div class="pf"><button type="submit" form="oform" class="b pri"' + (ro ? ' disabled' : '') + '>' + (edit ? T('Save') : T('Create office')) + '</button><button type="button" class="b ghost" data-ev="drawer-close">' + T('Cancel') + '</button><span class="sp"></span>'
    if (edit && !ro) html += '<button type="button" class="b bad sm' + armedCls('ofc-archive|' + f.id) + '" data-ev="office-archive" data-arg="' + esc(f.id) + '">' + esc(armedLabel('ofc-archive|' + f.id, T('Archive'))) + '</button>'
    return html + '</div>'
  }
  const officeDone = () => { st.drawer = null; st.ofc = null; load('team', 'api/team', true); h.refresh() }
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-ev]')
    if (!t) return
    const a = t.dataset.ev, arg = t.dataset.arg || ''
    if (a === 'office-new' || a === 'office-edit') { officeOpen(a === 'office-edit' ? arg : ''); if (location.hash !== '#/team') location.hash = '#/team'; bump(); return }
    if (a === 'office-archive') {
      if (!arm('ofc-archive|' + arg)) return
      act(() => send('api/office', { op: 'archive', id: arg }), officeDone)
    }
  })
  document.addEventListener('change', (e) => { const f = e.target.closest && e.target.closest('#oform'); if (f && st.ofc) readOffice(f) })
  document.addEventListener('submit', (e) => {
    const f = e.target.closest && e.target.closest('[data-evform="office"]')
    if (!f || !st.ofc) return
    readOffice(f)
    const o = st.ofc
    if (!o.type) { st.dmsg = { ok: false, text: T('Pick a building.') }; bump(); return }
    const body = Object.assign(o.id ? { op: 'edit', id: o.id } : { op: 'create' }, { name: o.name, type: o.type, kinds: o.kinds }, o.theme ? { theme: o.theme } : {})
    act(() => send('api/office', body), officeDone)
  })
