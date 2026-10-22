/* The "Stage" look of 1.2 (direction A, chosen by the owner 2026-10-21): one
 * light theme on a tinted ground, real shadows, bolder office colours and a
 * larger type scale. It comes last in the page's <style>, so it restyles the
 * screens without touching their own CSS; the screens keep their markup and
 * every class a test or a script reads.
 *
 * Tokens: accent #087553 (hover #06603F, soft #DCEFE6); page #EDF1EC; campus
 * ground #DCE6DD, lot #EEF3EC, path #F7F5EE; ink #0F1B24 / #34424F / #56636F;
 * line #D3DCD5; two shadows; radius 10 for cards, 8 for buttons. Arial only,
 * 400 and 700. Nothing a person must read is below 13 px.
 *
 * Layout: the top bar is one 60 px strip (five screens and More, one status
 * group, ?). The waiting rail is no longer a column: the dock floats over the
 * campus and the office, and the full rail opens over the page from it. The
 * narrow layout (360 to 480 px, for 9:16 recordings) and the demo's showcase
 * look are at the end. */
const STAGE_STYLE = `
:root{
  --ink:#0F1B24;--ink-soft:#34424F;--ink-dim:#56636F;--ink-hi:#0F1B24;
  --ground:#EDF1EC;--page:#EDF1EC;--panel:#FFFFFF;--panel-raised:#F5F8F4;--line:#D3DCD5;--line-strong:#BFCAC3;
  --accent:#087553;--accent-h:#06603F;--accent-soft:#DCEFE6;--accent-line:rgba(8,117,83,.35);--ok:#087553;--ok-bg:#DCEFE6;
  --warn-bg:#FCF1DD;--bad-ink:#A92B22;--bad-bg:#FBE7E4;--idle-bg:#EEF1F3;
  --sh1:0 1px 2px rgba(15,27,36,.10),0 2px 6px rgba(15,27,36,.06);
  --sh2:0 2px 4px rgba(15,27,36,.08),0 14px 34px rgba(15,27,36,.14);
  --top:60px;
}
body{background:var(--page);font-size:14px;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
.board,.board.rail-mini{--rw:0px}
.board{background:var(--page)}

/* ---------- the top bar: one slim strip */
.top{height:var(--top);gap:6px;padding:0 20px;border-bottom:0;box-shadow:var(--sh1);z-index:20}
@media (max-width:1440px){.top{gap:6px;padding:0 16px}}
h1.brand{display:flex;align-items:center;gap:10px;font:700 19px/1 var(--font-ui);color:var(--ink);margin:0 18px 0 0;white-space:nowrap}
h1.brand .mark{display:block;flex:none}
.top .date{display:none}
.views{border:0;border-radius:0;overflow:visible;height:100%;align-items:stretch;gap:2px}
.views button{font:15px var(--font-ui);background:none;border:0!important;padding:0 13px;color:var(--ink-soft);position:relative;display:flex;align-items:center;gap:7px}
.views button:hover{color:var(--ink)}
.views button[aria-pressed=true]{background:none;color:var(--ink);font-weight:700;box-shadow:none}
.views button[aria-pressed=true]::after{content:"";position:absolute;left:9px;right:9px;bottom:0;height:3px;background:var(--accent);border-radius:2px 2px 0 0}
.views #omenu-office{padding:0 6px 0 0;margin-left:-8px;color:var(--ink-dim);font-size:12px}
.views #omenu-office::after{display:none}
#vtab-office{max-width:none}
@media (max-width:1440px){.views button{padding:0 10px}}
.tc{font:700 12.5px/1 var(--font-ui);background:var(--warn-bg);color:var(--warn-ink);border-radius:9px;padding:3px 7px;min-width:20px;text-align:center}
.tc:empty{display:none}
.sgrp{margin-left:auto;display:flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:20px;height:38px;padding:0 6px 0 2px;white-space:nowrap}
.counts,.board.co .counts{margin:0;gap:0;font-size:14px;color:var(--ink-soft)}
.counts li{display:flex;align-items:center;gap:6px;padding:0 11px;white-space:nowrap}
.counts li+li{border-left:1px solid var(--line)}
.counts b{font:700 16px var(--font-ui);color:var(--ink);margin:0}
.counts b.acc{color:var(--ink)!important}.counts b.warn{color:var(--ink)!important}
.sdot{width:9px;height:9px;border-radius:50%;flex:none;display:inline-block}
.sdot.ok{background:var(--accent)}.sdot.warn{background:var(--warn)}
.top .live{font-size:13px;color:var(--ink-dim);padding:0 8px 0 10px;border-left:1px solid var(--line);height:20px}
.top .live i{border-radius:50%}
@media (max-width:1320px){.top .live{display:flex}}
.helpb{width:38px;height:38px;flex:none;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--ink-soft);font:700 16px var(--font-ui);cursor:pointer;margin-left:8px}
.helpb:hover,.helpb[aria-expanded=true]{color:var(--accent);border-color:var(--accent-line)}
.helpop{position:fixed;right:16px;top:calc(var(--top) + 8px);z-index:45;width:320px;background:var(--panel);border-radius:10px;box-shadow:var(--sh2);padding:14px 16px;display:flex;flex-direction:column;gap:8px;font-size:14px;color:var(--ink-soft)}
.helpop[hidden]{display:none}
.helpop>b{font-size:17px;color:var(--ink)}
.helpop .hlink{color:var(--accent);font-weight:700;text-decoration:none}
.helpop button{font:14px var(--font-ui);text-align:start;background:var(--panel-raised);border:1px solid var(--line);border-radius:8px;padding:8px 10px;color:var(--ink);cursor:pointer}
.helpop button[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent-line);font-weight:700}
.helpop p{margin:0;font-size:13px;color:var(--ink-dim)}
.omenu{border:0;border-radius:10px;box-shadow:var(--sh2);padding:6px}
.omenu button{font-size:14px;padding:8px 10px;border-radius:6px;color:var(--ink-soft)}
.brand-b{display:none}
.btabs{display:none}

/* every screen starts under the strip */
.insp,.stage,.rail,.mini-rail,.vm,.cv,.ev{top:var(--top)}
.mini-rail,.board.rail-mini .mini-rail{display:none!important}

/* legends and help notes wait behind the ? (the 1.1 meanings are unchanged) */
.board:not(.legends) .cleg,.board:not(.legends) .ctip,.board:not(.legends) #legend,.board:not(.legends) .ev .lgbar,.board:not(.legends) .zoombar .zh{display:none!important}

/* ---------- the full waiting list: over the page, opened from the dock or the Decisions count */
.rail,.board.rail-mini .rail{display:none;top:calc(var(--top) + 12px);right:12px;bottom:12px;width:400px;border:0;border-radius:10px;box-shadow:var(--sh2);padding:16px 18px;z-index:30}
.board.rail-open .rail,.board.rail-mini.rail-open .rail{display:block}
.rail h2,.board.rail-mini .rail h2{font-size:17px;color:var(--ink)}
.rail h2 .x{display:inline-block}
.rail .hint{font-size:13px}
.gsteps{flex-wrap:wrap}.gsteps li{flex:1 1 30%}.gsteps li,.gsteps li b{font-size:13px}
.wait{border-radius:8px;background:var(--warn-bg);border-color:rgba(184,114,15,.3)}
.wh{font-size:14px}.wq{font-size:15px}.wf{font-size:13px}
.wh .wk{font-size:13px;color:var(--ink-dim)}
.ansbox button{font-size:13px;padding:5px 11px;border-radius:8px}

/* ---------- the dock: the oldest three, in plain words */
.dock{position:absolute;z-index:12;left:24px;bottom:24px;width:480px;background:var(--panel);border-radius:10px;box-shadow:var(--sh2);padding:14px 18px 8px}
.dock[hidden]{display:none}
.dock .dh{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.dock .dtl{font:700 17px var(--font-ui);color:var(--ink);background:none;border:0;padding:0;cursor:pointer;display:flex;align-items:center;gap:10px}
.dock .cnt{font:700 14px var(--font-ui);background:var(--warn-bg);color:var(--warn-ink);border-radius:11px;padding:3px 9px}
.dock .sp{flex:1}
.dock .dlink{font:700 15px var(--font-ui);color:var(--accent);background:none;border:0;padding:0;cursor:pointer}
.dock .dlink:hover{color:var(--accent-h)}
.drow{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:3px 12px;align-items:center;width:100%;text-align:start;background:none;border:0;border-top:1px solid var(--line);padding:10px 0;cursor:pointer;font:inherit;color:inherit}
.drow:first-of-type{border-top:0}
.drow:hover .dq{color:var(--accent-h)}
.drow .ic{grid-row:1 / 3;color:var(--ink-soft)}
.drow .dk{font:700 13px var(--font-ui);color:var(--ink-dim)}
.drow .dq{grid-column:2;font-size:15px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.drow .da{grid-row:1 / 3;grid-column:3;font:700 14px var(--font-ui);color:var(--warn-ink);white-space:nowrap}
.drow.late .da{color:var(--bad-ink)}
.dock .dmore{display:block;width:100%;text-align:start;font:13px var(--font-ui);color:var(--ink-dim);background:none;border:0;border-top:1px solid var(--line);padding:8px 0 4px;cursor:pointer}

/* ---------- campus: the scene is the page */
.cmap{background:#DCE6DD;--cz-top:150px}
/* an open card may rise over the zoom bar; the top bar stays above it */
.cmap-in:has(.sign:hover,.sign.hot,.sign:focus-within){z-index:4}
/* a column on the left for the title and the dock: "fit" keeps the buildings clear of both */
@media (min-width:1100px){.cmap:not(.building){--cz-left:400px}}
.cmap .bld:hover .pl,.cmap .bld:focus-visible .pl{stroke-width:4}
.ctitle{position:absolute;left:32px;top:24px;z-index:3;pointer-events:none}
.ctitle h2{margin:0;font:700 34px/1.15 var(--font-ui);color:var(--ink)}
.ctitle p{margin:6px 0 0;font-size:16px;color:var(--ink-soft)}
.ctitle p b{color:var(--accent)}
.cmap .today{position:absolute;left:32px;top:100px;max-width:360px;z-index:3;display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--ink-soft);background:none;border:0;box-shadow:none;padding:0}
.cmap .today b{color:var(--ink)}
.cmap .today button{font:13px var(--font-ui);color:var(--accent);background:none;border:0;padding:0;cursor:pointer;text-decoration:none}
.czoom{inset-inline-end:24px;top:24px;gap:6px;background:none;border:0;padding:0}
.czoom button{height:40px;min-width:40px;border-radius:8px;border:1px solid var(--line-strong);background:var(--panel);color:var(--ink);font:15px var(--font-ui);box-shadow:var(--sh1)}
.czoom .fitb{font:700 14px var(--font-ui);padding:0 14px}
.czoom output{font:14px var(--font-ui);min-width:54px;height:40px;line-height:40px;background:var(--panel);border-radius:8px;box-shadow:var(--sh1);color:var(--ink)}
.czoom .cbuild{font:700 15px var(--font-ui);color:var(--ink);background:var(--panel);border-color:var(--line-strong);padding:0 16px;margin-inline-start:4px}
.czoom .cbuild:hover{background:var(--panel-raised);color:var(--ink);border-color:var(--line-strong)}
.czoom .cbuild.on{background:var(--ink);border-color:var(--ink);color:#fff}
.czoom .zh{font-size:13px;color:var(--ink-dim)}
/* the office card: name, working and waiting; the rest on hover or focus. It takes the Stage
   shadow (spec 1.2 rule 42 asks for depth; the 1.1 "no shadows on campus" rule is gone), but
   only the --sh tokens: no SVG blur filter, which would cost a repaint on every pan */
.sign{width:auto;min-width:184px;max-width:280px;border:1px solid #C9D6C6;border-radius:8px;padding:10px 14px 11px;color:var(--ink-soft);box-shadow:var(--sh2)}
.sign:after{border-color:#C9D6C6;bottom:-7px;width:12px;height:12px}
.sign h3{display:flex;align-items:center;gap:8px;font-size:17px;margin:0;color:var(--ink)}
.sign h3 .sw{width:12px;height:12px;border-radius:3px;flex:none;background:var(--c)}
.sign .n,[dir=ltr] .sign .n{display:flex;gap:14px;margin:6px 0 0;font-size:14px;color:var(--ink-soft);justify-content:flex-start}
.sign .n span{display:inline-flex;align-items:center;gap:6px}
.sign .n b{color:var(--ink)}
.sign .n .a,.sign .n .b{color:var(--ink-soft)}
.sign .n .z{color:var(--ink-dim)}
.sign .more{display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:14px;color:var(--ink-soft);line-height:1.5}
.sign .more .cbar{margin:6px 0 4px}
.sign .more .cbtn.go{margin-top:8px;height:36px;padding:0 14px;border-radius:8px;font-size:14px;background:var(--accent);border-color:var(--accent);color:#fff}
.sign .more .cbtn.go:hover{background:var(--accent-h)}
.sign:hover,.sign:focus-within,.sign.hot{z-index:4;border-color:var(--accent);outline:2px solid var(--accent)}
.sign:hover .more,.sign:focus-within .more,.sign.hot .more{display:block}
.cmap-in.far .sign .more,.cmap.building .sign .more{display:none}
/* build mode: the board is for building. The today line and the waiting dock step aside (they sat under the
   tool column and over the hotbar), and each office is a one-line name so neighbours never cover each other */
.board:has(.cmap.building) .today,.board:has(.cmap.building) .dock{display:none!important}
.cmap.building .sign{min-width:0;max-width:none;padding:4px 8px 5px;box-shadow:var(--sh1)}
.cmap.building .sign h3{font-size:13px;gap:6px;white-space:nowrap}
.cmap.building .sign h3 .sw{width:10px;height:10px}
.cmap.building .sign .n{display:none}
.sign.small{padding:8px 12px}.sign.small h3{font-size:15px}
/* the month in one chip; it opens the company panel (budgets, offices, the supervisor, today's decisions) */
.cmonth{position:absolute;right:24px;bottom:24px;z-index:3;font:14px var(--font-ui);color:var(--ink-soft);background:var(--panel);border:0;border-radius:10px;box-shadow:var(--sh2);padding:12px 16px;cursor:pointer;display:flex;gap:6px;align-items:center}
.cmonth b{color:var(--ink)}
.cmonth .cm-act{margin-left:10px;color:var(--accent);font-weight:700}
.cwrap{position:relative}
.cside{display:none;position:absolute;right:24px;bottom:84px;top:80px;width:400px;z-index:5;border:0;border-radius:10px;box-shadow:var(--sh2);font-size:14px}
.cwrap.side-open .cside{display:block}
.cside .ckpi{border-radius:8px}
.cside .ckpi span,.cside .cnote,.cside .orow .bw,.cside .orow .ct{font-size:13px}
.cside .orow .on{font-size:15px}
.cleg,.ctip{border:0;border-radius:10px;box-shadow:var(--sh1);font-size:13px}
.ctip{bottom:84px}
.cleg{bottom:84px}

/* ---------- office: the room fills the left; the person's card and the dock float on the right */
.board[data-screen=office]{background:#DCE6DD}
.board[data-screen=office] .dock{left:auto;right:24px;width:var(--iw)}
.v-office .stage{left:0;right:calc(var(--iw) + 40px);bottom:calc(var(--dh) + 36px);background:#DCE6DD}
.stage.w3on{background:#DCE6DD}
.v-office .insp{left:auto;right:24px;top:calc(var(--top) + 24px);bottom:auto;max-height:calc(100% - var(--top) - 48px - 300px);min-height:220px;width:var(--iw);border:0;border-radius:10px;box-shadow:var(--sh2);padding:20px 22px;font-size:14px}
.board:has(.dock[hidden]) .v-office .insp{max-height:calc(100% - var(--top) - 48px)}
.v-office .split-v{top:calc(var(--top) + 24px);bottom:auto;height:160px;left:auto;right:calc(var(--iw) + 24px - 4px)}
.v-office .drawer{left:24px;right:calc(var(--iw) + 48px);bottom:24px;height:var(--dh);max-height:calc(100% - var(--top) - 48px);border:0;border-radius:10px;box-shadow:var(--sh2);padding:10px 16px}
.v-office .split-h{left:24px;right:calc(var(--iw) + 48px);bottom:calc(var(--dh) + 24px - 4px)}
.ih{font-size:22px}
.insp .chips .chip{font-size:13px;border-radius:14px;padding:6px 10px}
.insp .kv div{border-radius:8px;border:0;background:var(--panel-raised);padding:7px 10px}
.insp .kv dt{font-size:13px}.insp .kv dd{font-size:17px}
.insp .sect{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-dim);margin-top:16px}
.insp .task{font-size:15px}
.insp .term{font-size:13px;border-radius:8px;background:var(--panel-raised);border:0}
.insp .term li{grid-template-columns:46px 1fr}
.dr-top h2{font-size:16px}
.f,.more-btn{font-size:13px;border-radius:14px;padding:4px 10px}
.slip{border-radius:8px;width:196px;font-size:13px;border-top-width:3px}
.slip .st,.sl1,.sl2{font-size:13px}
/* the office's name and counts over the floor */
.ohead{left:32px;top:20px;max-width:calc(100% - 300px)}
.ohead .crumb{font-size:14px;gap:8px}
.ohead .crumb button{font-size:14px;color:var(--ink-soft)}
.ohead .crumb .sq{width:16px;height:16px;border-radius:4px}
.ohead .crumb b{font-size:34px;line-height:1.1;color:var(--ink)}
.ostats{gap:0;align-items:baseline}
.ostats div{background:none;border:0;padding:0;min-width:0;font-size:16px;color:var(--ink-soft);display:flex;gap:5px;align-items:baseline;white-space:nowrap}
.ostats div+div::before{content:"·";margin:0 8px;color:var(--ink-dim)}
.ostats b{display:inline;font-size:16px;color:var(--ink)}
.ostats .a,.ostats .a b{color:var(--accent);font-weight:700}
.ostats .b,.ostats .b b{color:var(--warn-ink);font-weight:700}
.ostats div:has(.cbtn)::before{content:none}
.ostats .cbtn{margin-left:12px;font-size:13px;border-radius:8px}
.board.co .zoombar,.zoombar{left:auto;right:16px;top:16px;border:0;border-radius:8px;box-shadow:var(--sh1);padding:4px}
.zoombar button{font-size:15px;border-radius:6px;height:32px;min-width:32px;border:0;background:none}
.zoombar output{font-size:14px}
.zoombar .fitb{font:700 14px var(--font-ui)}
.needs{border-radius:10px;box-shadow:var(--sh1)}
.legend{font-size:13px;border:0;border-radius:8px;box-shadow:var(--sh1)}
/* the pills: working and flagged people only; a free or finished person's name shows on hover or focus */
/* one line, light (owner, 1.2): a dot and the name in 13 px bold, the state in the dot, the tone
   and the tooltip; a group of close pills is one counter chip; the tray shows only a count */
.w3card,.w3chip{height:24px;padding:0 10px 0 8px;gap:6px;border:0;border-radius:12px;box-shadow:var(--sh1);font:700 13px/1 var(--font-ui);color:var(--ink);transition:opacity .2s}
.w3card .dot,.w3chip .dot{width:8px;height:8px}
.w3card b{max-width:150px}
.w3card.w3in{visibility:hidden;pointer-events:none}
.w3chip{position:absolute;transform:translate(-50%,-100%) scale(var(--bs,1));transform-origin:50% 100%;display:flex;align-items:center;background:#FFFFFF;white-space:nowrap;cursor:pointer;z-index:2}
.w3chip .dot{flex:none;border-radius:50%;background:#98A2AD}
.w3chip.tone-work .dot{background:var(--accent)}.w3chip.tone-wait .dot,.w3chip.tone-quiet .dot{background:#D98C1E}
.w3chip:focus-visible{outline:3px solid var(--accent);outline-offset:1px}
.w3card.tray,.tray-label.badge{height:22px;min-width:22px;padding:0 7px 0 5px;gap:4px;border-radius:11px;background:#EEF3FF;color:#1D4ED8;box-shadow:var(--sh1);font:700 12px/1 var(--font-ui)}
.tray-label.badge{display:flex;align-items:center;border:0}
.tray-label.badge svg,.w3card.tray .ic svg{width:13px;height:13px}
.board.showcase .w3card,.board.showcase .w3chip{height:20px;padding:0 8px 0 6px;font-size:12px}
.board.showcase .w3card .dot{width:7px;height:7px}
.w3card.tone-wait,.w3card.tone-quiet{background:#FFFFFF}
.w3card.tone-stalled{background:var(--bad-bg);color:var(--bad-ink)}
.w3card.tone-dead{border:1px dashed #8C97A3;box-shadow:none;background:#F4F6F8}
.w3card.tone-idle{background:rgba(255,255,255,.94);box-shadow:var(--sh1)}
.w3card.tone-idle:not(.sel):not(.hov):not(:hover):not(:focus-visible){opacity:0}
.stage.w3on .w3card.tone-idle:not(.sel):not(.hov){pointer-events:none}
.w3card.sel{box-shadow:0 0 0 3px var(--accent),var(--sh1)}

/* ---------- Live, Decisions, Team and the other list screens: one type scale, cards on the page tint */
.ev{--line-strong:#BFCAC3;--ink-hi:#0F1B24;--rc:10px}
.ev-main{padding:28px 40px 48px;font-size:15px;background:var(--page)}
.ev h1{font-size:32px;letter-spacing:0}
.ev h2{font-size:24px}
.ev h3{font-size:17px}
.ev .eh{margin-bottom:22px;align-items:center}
.ev .eh>div:first-child{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.ev .eh .sub{font-size:15px;margin:0}
.ev .card{border:0;box-shadow:var(--sh1)}
/* a pack not added yet: 1.1 drew it dashed and see-through; with no card borders that reads as a
   grey hole, so it is a card like the rest and its Add button tells it apart */
.ev .pk.off{background:var(--panel)}
.ev .lbl{font-size:13px;letter-spacing:.06em}
.ev .sm{font-size:13px}
.ev .b{height:40px;border-radius:8px;font-size:15px;background:var(--panel)}
.ev .b.sm{height:34px;font-size:14px}
.ev .b.pri{background:var(--accent);border-color:var(--accent)}
.ev .b.pri:hover{background:var(--accent-h);border-color:var(--accent-h)}
.ev .b.bad{color:var(--bad-ink);border-color:#E3B1AB}
.ev .chip{height:28px;border-radius:14px;font-size:13px}
.ev .chip.sm{height:24px;font-size:13px}
.ev .lnk{font-size:14px;color:var(--accent);text-decoration:none}
.ev a.lnk{text-decoration:none}
.ev .lp{height:28px;border-radius:14px;font-size:13px;border:0;padding:0 10px}
.ev .lp.warn{background:var(--warn-bg)}.ev .lp.bad{background:var(--bad-bg);color:var(--bad-ink)}
.seg{border-color:var(--line-strong);border-radius:8px}
.seg button{font-size:14px;padding:7px 14px}
.seg button[aria-pressed=true]{background:var(--accent-soft);color:var(--accent-h)}

/* the profile's numbers: three boxes a row in the 500 px drawer, and a number never breaks from its unit */
.ev .rw.tiles{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:stretch;margin:0 0 18px}
.ev .tiles .stat{padding:12px 14px}
.ev .tiles .stat .hi{white-space:nowrap;font-size:22px}
.ev .tiles .stat .lbl{font-size:12px;letter-spacing:.04em;line-height:1.3}
/* ---------- Activity, Version run, Gate history and Tools & usage: the same page margins, heading and
   cards as the other screens (they kept the 1.1 look until the 1.2 polish round) */
.vm{padding:28px 40px 40px;gap:14px;font-size:15px;background:var(--page)}
.vm .fbar{gap:10px;margin-bottom:8px}
.vm .fbar h2{font:700 32px/1.25 var(--font-ui);letter-spacing:0;margin:0 18px 0 0;color:var(--ink)}
.vm .fchip{font:14px var(--font-ui);height:34px;padding:0 13px;border-radius:17px;background:var(--panel);border:0;box-shadow:var(--sh1);color:var(--ink-soft)}
.vm .fchip[aria-pressed=true]{background:var(--accent-soft);color:var(--accent-h);font-weight:700;box-shadow:none}
.vm .muted{font-size:14px;color:var(--ink-dim);margin:0 0 6px}
.vm .box,.vm .v-card,.vm .kpi{border:0;border-radius:10px;box-shadow:var(--sh1)}
.vm .kpi{padding:12px 16px}
.vm .kpi dt,.vm .box h3 span,.vm .v-card>h3{font-size:13px}
.vm .kpi dd{font-size:24px}
.vm .box h3,.vm .v-card>h3{font-size:13px;letter-spacing:.06em}
.vm .v-card>h3{padding:12px 20px;border-bottom:1px solid var(--line)}
.vm .v-card .v-hd,.vm .v-pad,.vm .v-gate{padding:16px 20px}
.vm .v-card td,.vm .v-card th{padding:9px 14px;font-size:14px}
.vm .v-card th{font-size:13px}
.vm .v-card .v-kv span:first-child{font-size:13px}
.vm .v-card h1{font-size:22px}
.vm .vchip{font-size:13px;border-radius:12px;padding:2px 10px}
.vm .v-legend,.vm .v-gl{font-size:13px}
.vm .v-sel{font-size:14px}
.vm .v-sel select{font-size:14px;border-radius:8px;padding:6px 10px}
.vm .vr .empty,.vm .act .empty{font-size:15px}
.act h3{background:var(--page);font-size:13px;margin:18px 0 6px}
.act li{grid-template-columns:60px 150px 1fr auto;padding:9px 12px;font-size:14px;background:var(--panel)}
.act li:first-of-type{border-radius:10px 10px 0 0}.act li:last-of-type{border-radius:0 0 10px 10px}
.act li time{font-size:14px}.act li .who{font-size:14px}.act li .k{font-size:12.5px;padding:1px 8px;border-radius:10px}
.act ol{box-shadow:var(--sh1);border-radius:10px}
.act li{border-top:1px solid var(--line)}.act li:first-child{border-top:0}
/* Live: one big version-run block, then the runs as cards (the table is one click away) */
.ev .lhead .eh{margin-bottom:18px}
.ev .lsum{display:flex;gap:6px 16px;flex-wrap:wrap;font-size:15px;color:var(--ink-soft)}
.ev .lsum b{font-size:16px;color:var(--ink)}
.ev .lsum b.warn{color:var(--warn-ink)}.ev .lsum b.bad{color:var(--bad-ink)}
.ev .lgbar{flex-basis:100%;justify-content:flex-end}
.ev .banner.stb{background:var(--bad-bg);border:0;border-radius:10px;padding:14px 20px;margin:0 0 20px}
.ev .lvr{margin:0 0 28px;box-shadow:var(--sh2)}
.ev .lvh{padding:18px 26px 0;border:0;gap:14px;align-items:baseline}
.ev .lvh .vtt{font-size:20px}
.ev .lvh .vgo{font-size:16px}
.ev .lvb{flex-direction:row;align-items:flex-start;gap:36px;padding:16px 26px 24px}
.ev .lvbig{flex:none;display:flex;flex-direction:column;gap:6px}
.ev .lvbig .pc{font-size:64px;line-height:.95;letter-spacing:-.02em}
.ev .lvbig .pc small{font-size:30px}
.ev .vph{display:flex;gap:18px;flex:1;min-width:0;padding-top:10px}
.ev .vp{min-width:0;display:flex;flex-direction:column;gap:6px}
/* a phase keeps room for its name (two lines, full text on hover) and its percentage never breaks */
.ev .vp{min-width:150px}
.ev .vph2{align-items:flex-start}
.ev .vpn{min-width:0;overflow-wrap:anywhere;line-height:1.25}
.ev .vpc{flex:none;white-space:nowrap}
.ev .rch{flex-wrap:wrap}
.ev .rnm{overflow-wrap:anywhere;line-height:1.25}
.ev .rch>:not(:nth-child(2)){flex:none}
.ev .trk{display:block;height:14px;border-radius:7px;background:#E1E7E3;overflow:hidden;margin-bottom:4px}
.ev .trk i{display:block;height:100%;background:var(--accent);border-radius:7px}
.ev .trk.warn i{background:var(--warn)}.ev .trk.bad i{background:var(--bad)}
.ev .vst{font-size:13px;color:var(--ink-dim)}
.ev .vst.warn{color:var(--warn-ink);font-weight:700}.ev .vst.bad{color:var(--bad-ink);font-weight:700}
.ev .lrun .lth2{gap:12px;margin:0 0 14px;flex-wrap:wrap}
.ev .lrun .lth2>b{font-size:18px}
.ev .rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}
.ev .rcard{padding:16px 18px;display:flex;flex-direction:column;gap:8px;min-width:0}
.ev .rcard.bad{box-shadow:0 0 0 2px #E3B1AB,var(--sh1)}
.ev .rch{gap:12px;margin-bottom:6px}
.ev .rch b.hi{font-size:17px}
.ev .rch .mut{font-size:14px}
.ev .rct{font-size:15px}
.ev .rcb{gap:12px;margin-top:6px}
.ev .bar.thick{flex:1;height:12px;border-radius:6px;background:#E1E7E3}
.ev .bar.thick i{border-radius:6px}
.ev .bar.thick.warn i{background:var(--warn)}.ev .bar.thick.bad i{background:var(--bad)}
.ev .bar.thick .tick{top:-3px;height:18px;width:3px}
.ev .rcp{font-size:17px;white-space:nowrap}
.ev .rcf{font-size:14px;gap:6px}
.ev .rca{gap:8px;margin-top:4px}
.ev .dtile{background:var(--panel-raised);box-shadow:none;border:1.5px dashed #BFCAC3;justify-content:center}
.ev .lbelow{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:18px;margin-top:22px}
.ev .lbelow:empty{display:none}

/* Decisions: the oldest item as the focus card, the rest in a compact queue */
.ev .dlay{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(360px,1fr);gap:28px;align-items:start}
.ev .dmain{min-width:0}
.ev .dc.dfocus{padding:28px 32px 30px;box-shadow:var(--sh2)}
.ev .dfocus .kind{height:30px;font-size:14px;padding:0 11px}
.ev .dfocus .age{font-size:17px}
.ev .dfocus .dt{font-size:40px;line-height:1.12;margin:18px 0 10px;letter-spacing:-.01em}
.ev .dfocus .mut.sm.ell{font-size:15px}
.ev .dfocus .dbt{margin-top:26px;gap:12px}
.ev .dfocus .soft.sm{font-size:16px}
.ev .dfocus .lockn{font-size:15px}
.ev .dnone h2{margin-bottom:8px}
.ev .dc.old{box-shadow:0 0 0 2px #E3B1AB,var(--sh2)}
.ev .dc.lk{background:var(--panel)}
.ev .dqueue{display:flex;flex-direction:column;gap:22px;min-width:0}
.ev .dqh{font-size:18px;font-weight:700}
.ev .dqueue .dcol{gap:0}
.ev .dqueue .dch{gap:8px;padding:0 0 8px;border-bottom:1px solid var(--line);margin:0}
.ev .dqueue .dcn{font-size:17px}
.ev .dcnote{margin:6px 0 2px}
.ev .dc.dq{padding:12px 2px;border-bottom:1px solid var(--line);background:none;box-shadow:none;border-radius:0}
.ev .dqa{gap:8px;color:var(--ink-soft)}
.ev .dqk{font:700 13px var(--font-ui);color:var(--ink-dim)}
.ev .dq .age{font-size:14px;color:var(--warn-ink)}.ev .dq .age.bad{color:var(--bad-ink)}
.ev .dqb{gap:8px;margin-top:6px}
.ev .dqt{flex:1;min-width:0;text-align:start;background:none;border:0;padding:0;font:15px var(--font-ui);color:var(--ink);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ev .dqt:hover{color:var(--accent-h)}
.ev .dq .b,.ev .dq .b.sm{height:34px;font-size:14px;padding:0 12px}
.ev .dlog{padding:6px 18px}
@media (max-width:1180px){.ev .dlay{grid-template-columns:1fr}}

/* Team: portrait tiles grouped by office (the table is one click away) */
.ev .tfil{gap:10px;margin-bottom:22px}
.ev .tfil .chip{height:34px;padding:0 13px;font-size:14px;background:var(--panel);border-color:transparent;box-shadow:var(--sh1)}
.ev .tfil .chip[aria-pressed=true]{background:var(--accent-soft);color:var(--accent-h);box-shadow:none}
.ev .tfil .chip .sw{width:11px;height:11px;border-radius:3px}
.ev .tfil .tnsu{font:700 15px var(--font-ui)}
.ev .tfil input[type=search]{height:40px;background:var(--panel)}
.ev .tgrp{margin:0 0 26px}
.ev .tgh{font-size:19px;gap:10px;margin:0 0 12px}
.ev .tgh .sw{width:14px;height:14px;border-radius:3px;display:inline-block}
.ev .tgh .mut{font-size:15px;font-weight:400}
.ev .tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.ev .ttile{display:flex;flex-direction:column;text-align:start;background:var(--panel);border:0;border-radius:10px;box-shadow:var(--sh1);padding:0;overflow:hidden;cursor:pointer;font:inherit;color:inherit;transition:transform .15s,box-shadow .15s}
.ev .ttile:hover{transform:translateY(-2px);box-shadow:var(--sh2)}
.ev .ttile[aria-current=true]{box-shadow:0 0 0 2px var(--accent),var(--sh2)}
.ev .ttile:focus-visible{outline:3px solid #1D4ED8;outline-offset:2px}
.ev .tpic{position:relative;height:128px;background:color-mix(in srgb,var(--oc) 16%,#FFFFFF);display:flex;align-items:flex-end;justify-content:flex-end;padding:0 18px 0 0}
.ev .tpic .pill{position:absolute;left:12px;top:12px;font-size:13px;background:#FFFFFF}
.ev .tface{line-height:0}
.ev .tbody{display:flex;flex-direction:column;gap:3px;padding:12px 14px 14px;min-width:0}
.ev .tbody b{font-size:17px}
.ev .tbody .soft{font-size:14px}
.ev .tbody .ttask{font-size:14px;color:var(--ink);margin-top:4px}
.ev .tbody .mut{font-size:13px}
@media (prefers-reduced-motion:reduce){.ev .ttile{transition:none}.ev .ttile:hover{transform:none}}
.ev .dtabs,.ev .vnow,.scrn{display:none}

/* nothing a person must read under 13 px on the five screens (the older parts they keep) */
.needs{font-size:14px;border:0;width:320px}
.needs .nt,.needs .nb,.needs .nx button{font-size:13px}
.needs .nb{border-radius:8px;padding:5px 11px}
.w3proj div{font-size:13px;border:0;box-shadow:var(--sh1);border-radius:8px}
.ev .kind{font-size:13px}.ev .age{font-size:13px}.ev .pill{font-size:13px}
.ansbox button.dis,.rail .sect .src,.rail .hint,.given,.given .rd{font-size:13px}
.ev table.dir th,.ev table.lt2 th{font-size:12.5px}
.ev table.dir td,.ev table.lt2 td{font-size:14px}
.slip .st{font-size:13px}.sb-hd,.sb-nm b,.sb-nm>span{font-size:13px}

/* ---------- the narrow layout (360 to 480 px, captured at 360 x 640 x 3 for 9:16):
   one column, the five screens in a tab bar at the foot, nothing a person reads under 13 px,
   touch targets of 40 px or more */
@media (max-width:480px){
  :root{--top:56px;--foot:64px}
  .board{min-width:0;min-height:0}
  .top{padding:0 14px;gap:8px}
  h1.brand{margin:0;font-size:22px;gap:10px;min-width:0}
  h1.brand>span:not(.scrn){display:none}
  .scrn{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .views,.top .live,.helpb,.helpop{display:none!important}
  .sgrp{height:40px;padding:0 4px}
  .counts li:nth-child(n+2){display:none}
  .counts li{font-size:15px}
  .btabs{display:flex;position:absolute;left:0;right:0;bottom:0;height:var(--foot);z-index:25;background:var(--panel);box-shadow:0 -1px 0 var(--line),0 -4px 14px rgba(15,27,36,.06)}
  .btabs button{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:none;border:0;font:13px var(--font-ui);color:var(--ink-soft);position:relative;cursor:pointer}
  .btabs button[aria-pressed=true]{color:var(--accent);font-weight:700}
  .btabs button[aria-pressed=true]::before{content:"";position:absolute;top:0;left:22%;right:22%;height:3px;background:var(--accent);border-radius:0 0 2px 2px}
  .btabs .tc{position:absolute;top:6px;left:calc(50% + 6px);background:var(--warn);color:#FFFFFF;border-radius:10px;font-size:12px;padding:3px 6px}
  .insp,.stage,.vm,.cv,.ev,.rail{bottom:var(--foot)}
  .dock,.mini-rail,.split,.board .drawer{display:none!important}
  .rail,.board.rail-mini .rail{left:8px;right:8px;width:auto;top:calc(var(--top) + 8px);bottom:calc(var(--foot) + 8px)}
  /* campus: two buildings a row (campus.cjs draws them so), compact cards, the month chip and the title stay */
  .cmap{--cz-left:0px;--cz-top:150px}
  .ctitle{left:16px;top:12px}.ctitle h2{font-size:24px}.ctitle p{font-size:14px;margin-top:2px}
  .cmap .today,.czoom,.cmonth,.cside,.cleg,.ctip{display:none!important}
  .sign,.cmap-in.far .sign{min-width:0;max-width:112px;padding:6px 8px 7px}
  .sign h3{font-size:13px;gap:5px;white-space:normal;line-height:1.2;overflow:visible}
  .sign h3 .sw{width:10px;height:10px}
  .sign .n,[dir=ltr] .sign .n{gap:2px 8px;font-size:13px;flex-wrap:wrap;white-space:normal;margin-top:4px}
  .sign .n span{white-space:nowrap}
  .sign .more{display:none!important}
  /* office: the room full width, pills for the flagged only, the person's card as a sheet from the foot */
  .v-office .stage{right:0;bottom:calc(var(--foot) + 36vh)}
  .v-office .insp{left:0;right:0;top:auto;bottom:var(--foot);width:auto;height:36vh;max-height:none;min-height:0;border-radius:14px 14px 0 0;box-shadow:0 -6px 20px rgba(15,27,36,.12);padding:14px 16px}
  .insp .kv,.insp .toolline,.insp details,.insp .twins{display:none}
  .ohead{left:16px;top:10px;max-width:calc(100% - 32px)}
  .ohead .crumb{font-size:13px}.ohead .crumb b{font-size:24px}
  .ostats div{font-size:14px}.ostats b{font-size:14px}
  .ostats div:nth-child(n+3){display:none}
  .board.co .zoombar,.zoombar,.needs,.legend,.w3proj{display:none!important}
  .w3card.tone-work:not(.sel),.w3chip.tone-work{opacity:0;pointer-events:none}
  .w3card{height:26px;font-size:13px}
  /* the list screens: one column */
  .ev-main{padding:16px 14px 24px}
  .vm{padding:16px 16px 24px}
  .vm .fbar h2{font-size:26px}
  .ev h1{font-size:26px}
  .ev .eh{margin-bottom:14px;flex-wrap:wrap}
  .ev .eh .sub{font-size:14px}
  .ev .eh .ea{margin:0}
  .ev .ev-drawer{position:absolute;inset:0;width:auto;z-index:20}
  .ev .lsum,.ev .lgbar,.ev .lrun .lth2 .seg,.ev .lrun .lth2 .b,.ev .lrun>p,.ev .lbelow,.ev .lvh .mut,.ev .lvh .chip,.ev .lvh .lnk,.ev .lvh .vgo{display:none}
  .ev .banner.stb{padding:12px 14px;margin-bottom:14px}
  .ev .banner.stb .mut,.ev .banner.stb .b.bad,.ev .banner.stb .b.ghost{display:none}
  .ev .lvh{padding:14px 16px 0}
  .ev .lvb{flex-direction:column;gap:12px;padding:10px 16px 16px}
  .ev .lvbig .pc{font-size:48px}
  .ev .vph{gap:6px;width:100%;padding:0}
  .ev .vp{min-width:0}
  .ev .vp .rw,.ev .vp .vst{display:none}
  .ev .vnow{display:block;font-size:15px}
  .ev .rgrid{grid-template-columns:1fr;gap:12px}
  .ev .rcard{padding:14px 16px}
  .ev .rcard .rct,.ev .rcard .rcf .mut,.ev .rcard .rca{display:none}
  .ev .dlay{grid-template-columns:1fr;gap:16px}
  .ev .eh .ea .chip{display:none}
  .ev .dtabs{display:flex;width:100%;margin:0 0 14px}
  .ev .dtabs button{flex:1;height:40px}
  .ev .dc.dfocus{padding:18px 18px 20px}
  .ev .dfocus .dt{font-size:26px;margin:12px 0 6px}
  .ev .dfocus .dbt{flex-direction:column;align-items:stretch}
  .ev .dfocus .dbt .sp{display:none}
  .ev .dmain>.lbl,.ev .dmain>.card.dlog,.ev .dmain>p,.ev .alately{display:none}
  .ev .dqueue .dcol{display:none}
  .ev .dqueue[data-tab=ask] .dcol[data-col=ask],.ev .dqueue[data-tab=go] .dcol[data-col=go],.ev .dqueue[data-tab=lock] .dcol[data-col=lock]{display:flex}
  .ev .dqueue .dcnote{display:none}
  .ev .dqt{white-space:normal}
  .ev .tfil{flex-wrap:nowrap;overflow-x:auto;gap:8px;margin-bottom:14px}
  .ev .tfil>span{flex-wrap:nowrap!important}
  .ev .tfil .tf,.ev .tfil label,.ev .tfil .seg,.ev .tfil .tnsu,.ev .note{display:none}
  .ev .eh .ea .b:not(.pri){display:none}
  .ev .tgrid{grid-template-columns:1fr 1fr;gap:10px}
  .ev .tpic{height:96px;padding-right:10px}
  .ev .tface svg{width:72px;height:72px}
  .ev .tpic .pill{left:8px;top:8px;font-size:13px;padding:2px 8px}
  .ev .tbody{padding:10px 10px 12px}
  .ev .tbody b{font-size:15px}
  .ev .tbody .ttask{display:none}
}

/* ---------- the demo's showcase look, for recordings only (arsenale demo --showcase or the ? switch there):
   no dock, no rail, no legends, help notes or Details links */
.board.showcase .dock,.board.showcase .rail,.board.showcase .cleg,.board.showcase .ctip,.board.showcase #legend,.board.showcase .ev .lgbar,
.board.showcase .zoombar .zh,.board.showcase .czoom .zh,.board.showcase [data-ev=dec-open].b.ghost,.board.showcase .lvh .lnk,.board.showcase .ev .note,
.board.showcase .lrun>p,.board.showcase .dmain>p{display:none!important}
`

module.exports = { STAGE_STYLE }
