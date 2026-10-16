const STYLE = `
  :root {
    --font-ui: Arial, "Helvetica Neue", Helvetica, sans-serif;
    --ink: #1F2A36; --ink-soft: #4A5663; --ink-dim: #66727F;
    --ground: #F3F5F7; --panel: #FFFFFF; --panel-raised: #F6F8FA; --line: #D9DFE5;
    --accent: #0C8A62; --accent-soft: rgba(12,138,98,0.1); --accent-line: rgba(12,138,98,0.3);
    --cyan: #1F7A8C; --cyan-soft: rgba(31,122,140,0.1);
    --ok: #0C8A62; --ok-bg: rgba(12,138,98,0.1); --warn: #B8720F; --warn-bg: rgba(217,140,30,0.12);
    --bad: #C8372D; --bad-bg: rgba(200,55,45,0.12); --idle: #66727F; --idle-bg: rgba(106,118,131,0.12);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--ground); color: var(--ink);
    font: 14.5px/1.85 var(--font-ui);
    padding: 28px 20px 60px;
    position: relative;
  }
  /* one restrained ambient touch: a faint scanline field, gone when motion is reduced */
  body::before {
    content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background: repeating-linear-gradient(to bottom, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 1px, transparent 1px, transparent 3px),
      radial-gradient(ellipse at 50% 0%, rgba(12,138,98,0.05), transparent 60%);
  }
  @media (prefers-reduced-motion: reduce) { body::before { display: none; } }
  .wrap { max-width: 1060px; margin: 0 auto; position: relative; z-index: 1; }

  /* header, styled as a shell prompt */
  .shell-prompt {
    direction: ltr; text-align: left; color: var(--ink-dim); font-size: 0.82rem;
    margin-bottom: 6px; white-space: nowrap; overflow-x: auto;
  }
  .shell-prompt .u { color: var(--accent); }
  .shell-prompt .p { color: var(--cyan); }
  .shell-prompt .d { color: var(--ink-dim); }
  .shell-prompt .cmd { color: var(--ink); }
  header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 2px; }
  h1 { font-size: 1.4rem; margin: 0; font-weight: 700; letter-spacing: -0.01em; }
  h1 .cursor { color: var(--accent); animation: blink 1.1s step-end infinite; margin-right: 2px; }
  @media (prefers-reduced-motion: reduce) { h1 .cursor { animation: none; } }
  h2 {
    font-size: 0.78rem; font-weight: 700; color: var(--accent); text-transform: uppercase;
    margin: 30px 0 10px; letter-spacing: 0.06em;
  }
  h2::before { content: "# "; color: var(--ink-dim); }
  .built { color: var(--ink-dim); font-size: 0.78rem; margin-inline-start: auto; direction: ltr; }
  .lede { color: var(--ink-dim); margin: 0; font-size: 0.86rem; }

  /* status strip */
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 18px; }
  .tile {
    background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px 16px;
  }
  .tile-key {
    display: block; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em;
    color: var(--accent); direction: ltr; text-align: left; margin-bottom: 6px;
  }
  .tile b { display: block; font-size: 1.65rem; font-weight: 700; line-height: 1.4; direction: ltr; text-align: left; }
  .tile-label { color: var(--ink-dim); font-size: 0.78rem; }
  .tile.alert b { color: var(--bad); }
  .tile.alert .tile-key { color: var(--bad); }
  .tile.live b { color: var(--accent); }

  /* usage/statistics — bar lists and a small sparkline, same terminal look */
  .stat-block { margin-bottom: 16px; }
  .stat-block h3 {
    font-size: 0.78rem; font-weight: 700; color: var(--ink-soft); margin: 0 0 8px;
    letter-spacing: 0.02em;
  }
  .bar-list { display: flex; flex-direction: column; gap: 7px; }
  .bar-row { display: flex; align-items: center; gap: 10px; }
  .bar-label { width: 150px; flex: none; font-size: 0.82rem; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: ltr; text-align: left; }
  .bar-track { flex: 1; height: 8px; border-radius: 4px; background: var(--panel-raised); border: 1px solid var(--line); overflow: hidden; min-width: 40px; }
  .bar-fill { display: block; height: 100%; background: var(--accent); opacity: 0.75; border-radius: 4px; }
  .bar-value { flex: none; font-size: 0.8rem; color: var(--ink); direction: ltr; text-align: left; white-space: nowrap; }
  .bar-sub { color: var(--ink-dim); font-size: 0.76rem; }

  .spark { display: flex; align-items: flex-end; gap: 10px; height: 130px; padding-top: 6px; }
  .spark-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; height: 100%; justify-content: flex-end; }
  .spark-val { font-size: 0.7rem; color: var(--ink-dim); direction: ltr; }
  .spark-bar { width: 100%; max-width: 34px; background: var(--accent); opacity: 0.75; border-radius: 3px 3px 0 0; min-height: 2px; }
  .spark-day { font-size: 0.72rem; color: var(--ink-dim); direction: ltr; }

  /* pager for the completed-runs list */
  .pager { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .pager button {
    font: inherit; font-size: 0.82rem; padding: 5px 10px; border-radius: 5px;
    border: 1px solid var(--line); background: var(--panel); color: var(--ink-soft); cursor: pointer;
  }
  .pager button:hover:not(:disabled) { background: var(--panel-raised); color: var(--ink); }
  .pager button.current { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-line); font-weight: 700; }
  .pager button:disabled { opacity: 0.4; cursor: default; }
  .pager-total { color: var(--ink-dim); font-size: 0.78rem; margin-right: 4px; }

  /* running now — one terminal window per agent, side by side when several are working */
  .live-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 12px; }
  .live-card {
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    overflow: hidden; display: flex; flex-direction: column;
  }
  .win-bar {
    display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
    background: var(--panel-raised); border-bottom: 1px solid var(--line); padding: 8px 12px;
  }
  .win-dots { display: inline-flex; gap: 5px; flex: none; }
  .win-dots i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: var(--line); }
  .win-dots i:nth-child(1) { background: #C8372D; opacity: 0.7; }
  .win-dots i:nth-child(2) { background: #B8720F; opacity: 0.7; }
  .win-dots i:nth-child(3) { background: #0C8A62; opacity: 0.7; }

  /* the log, read like a terminal */
  .term {
    background: var(--ground); padding: 9px 11px;
    max-height: 210px; overflow-y: auto;
    font-family: var(--font-ui);
    font-size: 0.76rem; line-height: 1.8;
  }
  .term-line { display: flex; gap: 8px; align-items: baseline; }
  .term-prompt { color: var(--accent); opacity: 0.6; direction: ltr; flex: none; }
  .term-at { color: var(--ink-dim); direction: ltr; flex: none; font-size: 0.72rem; }
  .term-text { color: var(--ink-soft); min-width: 0; }
  .term-line.now .term-text { color: var(--ink); }
  .term-line.now .term-text::after {
    content: "▌"; margin-right: 2px; color: var(--accent); animation: blink 1.1s step-end infinite;
  }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .term-line.now .term-text::after { animation: none; } }
  .term-empty { color: var(--ink-dim); }
  .dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex: none;
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
  .live-task { font-weight: 700; flex: 1; min-width: 0; }
  .live-doing { color: var(--ink-dim); font-size: 0.85rem; margin-top: 4px; }
  .elapsed { color: var(--accent); font-size: 0.8rem; font-weight: 700; direction: ltr; }
  .live-card .kv { padding: 9px 12px 11px; margin: 0 !important; border-top: 1px solid var(--line); }

  .chip {
    font-size: 0.74rem; font-weight: 700; padding: 3px 9px; border-radius: 4px;
    border: 1px solid transparent; white-space: nowrap; font-family: var(--font-ui);
  }
  .agent-chip { background: var(--cyan-soft); color: var(--cyan); border-color: rgba(31,122,140,0.3); direction: ltr; }
  .live-chip { background: transparent; color: var(--cyan); border: 0; padding: 0; direction: ltr; }
  .status-ok { background: var(--ok-bg); color: var(--ok); border-color: rgba(12,138,98,0.3); }
  .status-findings { background: var(--warn-bg); color: var(--warn); border-color: rgba(217,140,30,0.35); }
  .status-failed { background: var(--bad-bg); color: var(--bad); border-color: rgba(200,55,45,0.35); }
  .status-stopped { background: var(--idle-bg); color: var(--idle); border-color: var(--line); }

  .controls { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
  .controls input, .controls select {
    font: inherit; font-size: 0.88rem; padding: 7px 12px; border: 1px solid var(--line);
    border-radius: 5px; background: var(--panel); color: var(--ink); min-width: 0;
  }
  .controls input { flex: 1; min-width: 170px; }
  .controls input::placeholder { color: var(--ink-dim); }
  .controls input:focus, .controls select:focus { outline: 1px solid var(--accent); outline-offset: 1px; }

  .runs { display: flex; flex-direction: column; gap: 6px; }
  .run { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .run-head {
    display: flex; align-items: center; gap: 10px; padding: 9px 14px; width: 100%;
    border: 0; background: none; font: inherit; color: inherit; text-align:start; cursor: pointer;
  }
  .run-head:hover { background: var(--panel-raised); }
  .run-head:focus-visible { outline: 1px solid var(--accent); outline-offset: -2px; }
  .run-agent { color: var(--cyan); font-size: 0.84rem; direction: ltr; flex: none; }
  .run-task { flex: 1; min-width: 0; font-weight: 400; }
  .run-meta { color: var(--ink-dim); font-size: 0.76rem; white-space: nowrap; direction: ltr; }
  .caret { color: var(--ink-dim); transition: transform 0.15s; }
  .run.open .caret { transform: rotate(-90deg); }
  .run-body { padding: 12px 14px 14px; border-top: 1px solid var(--line); }
  .run-body p { margin: 0 0 10px; color: var(--ink-soft); white-space: pre-wrap; }
  .kv { display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.79rem; color: var(--ink-dim); margin-bottom: 10px; }
  .kv b { color: var(--ink-soft); font-weight: 700; }
  ul.findings { margin: 0 0 10px; padding-inline-start: 0; list-style: none; }
  ul.findings li { margin-bottom: 5px; color: var(--ink-soft); }
  ul.findings .mark { color: var(--warn); opacity: 0.8; margin-left: 7px; direction: ltr; display: inline-block; }
  .files { display: flex; flex-wrap: wrap; gap: 5px; }
  .file {
    font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; direction: ltr;
    background: var(--panel-raised); border: 1px solid var(--line); color: var(--cyan);
    font-family: var(--font-ui);
  }

  /* the agents themselves — a small roster, man-page style */
  .agents { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 10px; }
  .agent { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 13px 15px; }
  .agent-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .agent-name { font-weight: 700; direction: ltr; font-family: var(--font-ui); font-size: 0.88rem; color: var(--accent); }
  .agent-flags {
    font-size: 0.74rem; color: var(--ink-dim); direction: ltr; text-align: left;
    font-family: var(--font-ui); margin-bottom: 8px;
  }
  .agent-title { font-weight: 700; font-size: 0.88rem; margin-bottom: 4px; color: var(--ink); }
  .agent-desc { color: var(--ink-soft); font-size: 0.82rem; direction: ltr; text-align: left; }

  .empty { background: var(--panel); border: 1px dashed var(--line); border-radius: 8px; padding: 30px; text-align: center; color: var(--ink-dim); }
  .empty code { background: var(--panel-raised); padding: 2px 6px; border-radius: 4px; direction: ltr; display: inline-block; color: var(--cyan); }
  .note { color: var(--ink-dim); font-size: 0.79rem; margin: 8px 2px 0; }

  /* live-mode badge next to the title */
  .mode { display: inline-flex; align-items: center; gap: 6px; font-size: 0.76rem; color: var(--accent); direction: ltr; animation: pulse 1.6s ease-in-out infinite; }
  .mode.stale { color: var(--bad); animation: none; }
  @media (prefers-reduced-motion: reduce) { .mode { animation: none; } }
  @media (max-width: 560px) { .run-meta { display: none; } }
`

module.exports = { STYLE }
