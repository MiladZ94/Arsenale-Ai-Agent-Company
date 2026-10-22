// The Marketplace (spec 1.2): only what the shared .ev rules do not already give
const MARKET_STYLE = `
.ev .mkt{display:flex;flex-direction:column;gap:22px}
.ev .mkt-pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto}
.ev .mkt-flags{margin-top:10px;padding:10px 12px;border:1px solid rgba(217,140,30,.4);background:var(--warn-bg);border-radius:8px;font-size:13px}
.ev .mkt-flags ul{margin:6px 0 0 18px}
.ev .mkt-review code,.ev .mkt-flags code{font-size:12.5px;overflow-wrap:anywhere}
`

module.exports = { MARKET_STYLE }
