// The New office / Edit office panel (spec 1.2). Kept apart from style.cjs,
// which the visual upgrade rewrites: only the parts the shared tokens and
// classes (.fl, .pick, .chip, .sw) do not already give.
const OFFICE_FORM_STYLE = `
.ofm fieldset{border:0;margin:0;padding:0;min-width:0;display:flex;flex-direction:column;gap:2px}
.ev .ofm div.fl{display:flex;flex-direction:column;gap:6px;font-weight:700;color:var(--ink-hi);font-size:13px;margin:0 0 14px}
.ev .ofm div.fl .op{font-weight:400;color:var(--ink-dim)}
.ofm-sw{display:flex;flex-wrap:wrap;gap:8px}
.ofm-sw label{position:relative;line-height:0;cursor:pointer}
.ofm-sw input{position:absolute;opacity:0;width:1px;height:1px}
.ev .ofm-sw .sw{width:26px;height:26px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
.ofm-sw input:checked+.sw{outline:2px solid var(--ink-hi);outline-offset:2px}
.ofm-sw input:focus-visible+.sw{outline:2px solid var(--accent);outline-offset:2px}
.ofm-pick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
.ev .ofm-pick .pick{margin:0}
.ofm-kinds{display:flex;flex-wrap:wrap;gap:6px}
.ev .ofm-kinds .chip{height:28px;font-weight:400;cursor:pointer}
.ev .ofm-kinds .chip:has(input:checked){color:var(--accent);background:var(--accent-soft);border-color:var(--accent-line)}
.ev .ofm-kinds .chip.held{cursor:not-allowed;opacity:.6}
.ev .ofm-kinds input[type=checkbox]{width:14px;height:14px}
`
module.exports = { OFFICE_FORM_STYLE }
