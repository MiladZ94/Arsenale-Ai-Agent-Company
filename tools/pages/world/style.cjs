/* The look of the world: the font and the campus and 3D office CSS. */
const FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif'

const WORLD_STYLE = `
/* ---------- campus: a light site plan on the light board */
.cwrap{display:flex;height:100%}
.cmap{flex:1;position:relative;overflow:hidden;background:#ECEFF2;min-width:0;touch-action:none;user-select:none;cursor:grab;outline:none}
.cmap.panning{cursor:grabbing}
.cmap:focus-visible{box-shadow:inset 0 0 0 2px #4E8BD4}
.cmap-in{position:absolute;left:0;top:0;transform-origin:0 0}
.cmap-in.ease{transition:transform .22s ease-out}
.cmap-in>svg{position:absolute;left:0;top:0;overflow:visible}
.cmap svg text{font-family:var(--font-ui);font-weight:700}
.cmap .bld{cursor:pointer;outline:none}
.cmap .bld:hover .pl,.cmap .bld:focus-visible .pl{stroke:var(--c);stroke-width:3}
.sign{position:absolute;width:224px;transform:translate(-50%,-100%) scale(var(--bs,1));transform-origin:50% 100%;background:#fff;border:1px solid #D3D9DF;border-top:3px solid var(--c);border-radius:6px;padding:8px 10px 9px;text-align:start;color:#3A4654;cursor:default}
.sign:after{content:"";position:absolute;left:50%;bottom:-6px;width:10px;height:10px;background:#fff;border-right:1px solid #D3D9DF;border-bottom:1px solid #D3D9DF;transform:translateX(-50%) rotate(45deg)}
.sign h3{margin:0 0 5px;font-size:14px;color:#17212B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sign .n{display:flex;gap:11px;font-size:12px;font-variant-numeric:tabular-nums;margin-bottom:6px;white-space:nowrap;direction:ltr;justify-content:flex-end}
[dir=ltr] .sign .n{justify-content:flex-start}
.sign .n .a{color:#0C9468}.sign .n .b{color:#B26E12}.sign .n .c{color:#3A4654}
.sign .cbar{margin:0 0 7px;background:#E3E8ED}
.sign .cbar b{background:#8A97A6}
.sign .cbtn.go{color:#0B7A57;border-color:rgba(12,148,104,.4);background:rgba(12,148,104,.07)}
.sign .cbtn.go:hover{background:rgba(12,148,104,.14)}
.cmap-in.far .sign{width:auto;max-width:210px;padding:5px 9px}
.cmap-in.far .sign .c,.cmap-in.far .sign .cbar,.cmap-in.far .sign .cbtn{display:none}
.cmap-in.far .sign .n{margin:0}
.sign.small{width:auto;padding:4px 8px}
.sign.small h3{font-size:12px}
.ctip{position:absolute;inset-inline-start:16px;bottom:56px;font-size:12px;color:#5A6673;background:rgba(255,255,255,.92);border:1px solid #D3D9DF;padding:6px 10px;border-radius:5px}
.ctip b{color:#17212B}
.cleg{position:absolute;inset-inline-end:16px;bottom:16px;display:flex;gap:14px;font-size:12px;color:#4A5663;background:rgba(255,255,255,.92);border:1px solid #D3D9DF;padding:6px 10px;border-radius:5px;flex-wrap:wrap}
.cleg i{display:inline-block;width:9px;height:9px;margin-inline-end:6px;vertical-align:-1px;border-radius:1px}
.czoom{position:absolute;inset-inline-end:12px;top:12px;z-index:3;display:flex;gap:3px;align-items:center;background:rgba(255,255,255,.92);border:1px solid #D3D9DF;border-radius:4px;padding:3px;direction:ltr;cursor:default}
.czoom button{font:14px/1 var(--font-ui);color:#3A4654;background:#F4F6F8;border:1px solid #D3D9DF;border-radius:3px;min-width:26px;height:24px;cursor:pointer;padding:0 6px}
.czoom button:hover{color:#17212B;border-color:#AEB8C2;background:#fff}
.czoom .fitb{font:12px var(--font-ui)}
.czoom output{font:11.5px var(--font-ui);font-variant-numeric:tabular-nums;color:#17212B;min-width:44px;text-align:center}
.czoom .zh{font:11px var(--font-ui);color:#6A7683;padding:0 6px 0 4px;white-space:nowrap}
.czoom .cbuild{font:700 12px var(--font-ui);color:#fff;background:#2F6BE0;border-color:#2F6BE0;margin-inline-start:4px}
.czoom .cbuild:hover{background:#2A5FC9;color:#fff;border-color:#2A5FC9}
.czoom .cbuild.on{background:#17212B;border-color:#17212B}

/* ---------- build mode: lots, a tool column, a hotbar of the 12 types, a ghost */
.cmap.building{cursor:crosshair}
.cmap.building .bld{cursor:crosshair}
.cmap.building .bld.sel .pl{stroke:#2F6BE0;stroke-width:3}
.cmap.building .sign{pointer-events:none}
.cmap.building .sign .cbtn{display:none}
.cmap.building .sign{width:auto;max-width:210px;padding:5px 9px}
.cmap.building .sign .c,.cmap.building .sign .cbar{display:none}
.cmap.building .sign .n{margin:0}
.cmap .lot{pointer-events:none}
.c3gl{position:absolute;transform:translate(-50%,0) scale(var(--bs,1));transform-origin:50% 0;background:#2F6BE0;color:#fff;font:700 12px var(--font-ui);border-radius:12px;padding:4px 11px;white-space:nowrap;pointer-events:none;z-index:2}
.c3gl.bad{background:#fff;color:#B3261E;border:1px solid #D64545}
.c3msg{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:7;background:#17212B;color:#fff;font:700 12.5px var(--font-ui);border-radius:8px;padding:8px 14px;max-width:70%}
.c3msg.bad{background:#B3261E}
.c3tools{position:absolute;inset-inline-start:12px;top:64px;z-index:6;display:flex;flex-direction:column;gap:6px;background:rgba(255,255,255,.94);border:1px solid #D3D9DF;border-radius:8px;padding:6px;cursor:default}
.c3t{display:flex;flex-direction:column;align-items:center;gap:1px;background:none;border:2px solid transparent;border-radius:6px;padding:6px 4px 3px;width:56px;color:#26323F;cursor:pointer;font:11px var(--font-ui)}
.c3t:hover{background:#F1F4F7}
.c3t.on{border-color:#2F6BE0;background:#E8F0FD}
.c3hot{position:absolute;left:24px;right:24px;bottom:14px;z-index:6;background:rgba(255,255,255,.96);border:1px solid #D3D9DF;border-radius:8px;padding:8px 12px 10px;cursor:default}
.c3hot .hh{display:flex;justify-content:space-between;font:12px var(--font-ui);color:#5A6673;margin-bottom:6px}
.c3hot .hh b{color:#17212B}
.c3hot .hs{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px}
.c3h{position:relative;display:flex;flex-direction:column;align-items:center;gap:0;background:#fff;border:1px solid #D9DFE5;border-radius:6px;padding:3px 2px 4px;cursor:pointer;font:12px var(--font-ui);color:#26323F;min-width:0}
.c3h:hover{border-color:#8FA0B2}
.c3h.on{border:2px solid #2F6BE0;background:#E8F0FD;padding:2px 1px 3px}
.c3h em{position:absolute;left:6px;top:3px;font:700 10px var(--font-ui);color:#5A6673;font-style:normal}
.c3h svg{display:block;width:62px;height:50px}
.c3h span{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}

/* ---------- the 3D office: a room standing on the light ground grid */
.stage.w3on{background:#ECEFF2}
.stage.w3on .stage-in{display:none}
.w3host{position:absolute;inset:0;display:none}
.stage.w3on .w3host{display:block}
.w3host canvas{display:block;width:100%;height:100%;outline:none}
.w3ov{position:absolute;inset:0;pointer-events:none;overflow:hidden;--bs:1}
.w3ov div{pointer-events:none}
.w3ov [data-anchor],.w3ov [data-anchor] *{pointer-events:auto}
.w3ov [data-anchor]{will-change:left,top}
.w3card{position:absolute;transform:translate(-50%,-100%) scale(var(--bs,1));transform-origin:50% 100%;display:flex;flex-direction:column;align-items:center;background:none;border:0;padding:0;cursor:pointer;font:11px var(--font-ui);color:#0F172A;transition:opacity .25s;z-index:1}
.w3card .fr{width:58px;height:58px;border-radius:14px;padding:3px;background:#fff;border:2px solid var(--sc,#A3AAB5);display:block}
.w3card .fr .in{display:block;width:100%;height:100%;border-radius:10px;overflow:hidden}
.w3card .fr svg{width:100%;height:100%;display:block}
.w3card .nm{margin-top:5px;display:flex;gap:5px;align-items:center;font-weight:700;background:rgba(255,255,255,.88);padding:1px 7px;border-radius:6px;white-space:nowrap;max-width:190px}
.w3card .nm b{overflow:hidden;text-overflow:ellipsis}
.w3card .nm small{font-weight:400;color:#64748B}
.w3card .nm i{font-style:normal;color:var(--sc,#64748B)}
.w3card.sel .fr{box-shadow:0 0 0 3px rgba(37,99,235,.3)}
.w3who{position:absolute;transform:translate(-50%,-100%) scale(var(--bs,1));transform-origin:50% 100%;font:700 10.5px/1.2 var(--font-ui);color:#334155;background:rgba(255,255,255,.9);border:1px solid #D7DCE3;border-bottom:2px solid var(--sc,#A3AAB5);border-radius:6px;padding:1px 6px;white-space:nowrap;pointer-events:none!important}
.w3card.away .fr{border-style:dashed}
.w3card.absent{opacity:.62}
.w3card.dim{opacity:.55}
.w3card.glb .nm::after{content:"GLB";font-size:9px;color:#fff;background:#0F172A;border-radius:4px;padding:0 4px}
.w3card.tray .fr{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;color:#2563EB;border-color:#2563EB}
.w3card.tray .fr svg{width:24px;height:24px}
.w3drop{position:absolute;inset:10px;border:2px dashed rgba(37,99,235,.6);border-radius:18px;display:none;align-items:flex-start;justify-content:center;pointer-events:none;z-index:9}
.w3drop.on{display:flex}
.w3drop span,.w3toast{margin-top:64px;background:#2563EB;color:#fff;font:700 12.5px var(--font-ui);padding:8px 14px;border-radius:10px}
.w3toast{position:absolute;left:50%;top:0;transform:translateX(-50%);opacity:0;transition:opacity .25s;pointer-events:none;z-index:9;white-space:nowrap}
.w3toast.on{opacity:1}
.w3toast.bad{background:#B91C1C}
/* the office's own labels, restyled for the light floor */
.stage.w3on .bub{background:rgba(255,255,255,.96);color:#0F172A;border:1px solid #D7DCE3;border-radius:12px;box-shadow:none;padding:6px 10px 7px}
.stage.w3on .bub::after{display:none}
.stage.w3on .bub[data-at=card]{transform:translate(34px,calc(-100% - 22px)) scale(var(--bs,1));transform-origin:0 100%}
[dir=rtl] .stage.w3on .bub[data-at=card]{transform:translate(calc(-100% - 34px),calc(-100% - 22px)) scale(var(--bs,1));transform-origin:100% 100%}
.stage.w3on .bub.w3gone{visibility:hidden}
.stage.w3on .bub[data-at=card].w3flip{transform:translate(calc(-100% - 34px),calc(-100% - 22px)) scale(var(--bs,1));transform-origin:100% 100%}
[dir=rtl] .stage.w3on .bub[data-at=card].w3flip{transform:translate(34px,calc(-100% - 22px)) scale(var(--bs,1));transform-origin:0 100%}
.stage.w3on .bub.stale{background:#FFF7E6;border:1px dashed #D97706}
.stage.w3on .bub.mini{box-shadow:none;border-radius:9px}
.stage.w3on .bub.sel{outline:2px solid #2563EB}
.stage.w3on .bub.hand{background:#ECFDF3}
.stage.w3on .bub.hand.g-failed{background:#FEF2F2}.stage.w3on .bub.hand.g-findings{background:#FFF7E6}
.stage.w3on .tray-label,.stage.w3on .tag,.stage.w3on .deleg{background:rgba(255,255,255,.95);color:#0F172A;border:1px solid #D7DCE3;border-radius:8px;box-shadow:none;padding:3px 8px}
.stage.w3on .tag::after{display:none}
.stage.w3on .deleg{color:#1D4ED8}
.stage.w3on .legend{background:rgba(255,255,255,.9);color:#334155;border-color:#D7DCE3}
.stage.w3on .crumb button{color:#475569}.stage.w3on .crumb button:hover{color:#0F172A}.stage.w3on .crumb b{color:#0F172A}.stage.w3on .crumb .dim{color:#94A3B8}
.w3proj{position:absolute;inset-inline-end:14px;bottom:44px;display:flex;flex-direction:column;gap:6px;z-index:3;pointer-events:none}
.w3proj div{background:rgba(255,255,255,.92);border:1px solid #D7DCE3;border-radius:8px;padding:5px 10px;font:11.5px/1.45 var(--font-ui);color:#334155;min-width:170px}
.w3proj b{display:block;color:#0F172A}
.w3proj .bad{color:#B91C1C!important}
.w3box{margin-top:6px;padding:8px 10px;border:1px solid var(--line);border-radius:4px;background:var(--panel-raised);font-size:12px}
.w3box .h{display:flex;justify-content:space-between;gap:8px}
.w3box .map{color:var(--ink-dim);font-size:11.5px;margin-top:4px;overflow-wrap:anywhere}
.w3box .acts{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.w3box button{font:12px var(--font-ui);color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:3px;padding:2px 8px;cursor:pointer}
`

module.exports = { FONT, WORLD_STYLE }
