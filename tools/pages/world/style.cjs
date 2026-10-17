/* The look of the world: the font and the CSS of the campus (C2, a building
 * game board) and of the 3D office (zone rooms, side list). */
const FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif'

const WORLD_STYLE = `
/* ---------- the shared 3D host: a canvas and a layer for labels */
.k3host{position:absolute;inset:0;overflow:hidden}
.k3host canvas{display:block;width:100%;height:100%;outline:none}
.k3ov{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.k3ov>*{pointer-events:none}

/* ---------- campus */
.cwrap{display:flex;height:100%}
.cmap{flex:1;position:relative;overflow:hidden;background:#F5F6F8;min-width:0;outline:none}
.c3stage{position:absolute;inset:0}
.c3bar{position:absolute;inset-inline-end:16px;top:12px;z-index:6;display:flex;gap:8px;align-items:center}
.c3cnt{font:12px var(--font-ui);color:#4A5663;background:rgba(255,255,255,.9);border:1px solid #D3D9DF;border-radius:6px;padding:6px 10px}
.c3ro{font:12px var(--font-ui);color:#8A5A00;background:#FFF6E0;border:1px solid #E7C97A;border-radius:6px;padding:6px 10px}
.c3b{font:700 13px var(--font-ui);color:#26323F;background:#fff;border:1px solid #C9D1D9;border-radius:6px;padding:7px 14px;cursor:pointer}
.c3b:hover{border-color:#8FA0B2}
.c3b.pri{background:#2F6BE0;border-color:#2F6BE0;color:#fff}
.c3b.pri:hover{background:#2A5FC9}
.c3lab{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:5px;background:#fff;border:1px solid #CBD3DB;border-bottom:3px solid var(--c,#8A97A6);border-radius:12px;padding:2px 10px;font:700 12px var(--font-ui);color:#17212B;white-space:nowrap;pointer-events:auto;cursor:pointer}
.c3lab b{overflow:hidden;text-overflow:ellipsis;max-width:130px}
.c3lab em{font-style:normal;font-size:13px;color:#19795A}
.c3lab u{text-decoration:none;font-size:11px;color:#fff;background:#B45309;border-radius:9px;padding:0 6px}
.c3ln{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.c3ln line{stroke:#7C8794;stroke-width:1.2}.c3ln circle{fill:#7C8794}
.cmap.building .c3lab{pointer-events:none}
.c3lab:focus-visible{outline:2px solid #2F6BE0}
.c3lab.hov,.c3lab.sel{border-color:#2F6BE0;box-shadow:0 0 0 2px rgba(47,107,224,.25)}
.c3gl{position:absolute;transform:translate(-50%,0);background:#2F6BE0;color:#fff;font:700 12px var(--font-ui);border-radius:12px;padding:4px 11px;white-space:nowrap;margin-top:8px}
.c3gl.bad{background:#fff;color:#B3261E;border:1px solid #D64545}
.c3msg{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:7;background:#17212B;color:#fff;font:700 12.5px var(--font-ui);border-radius:8px;padding:8px 14px;max-width:70%}
.c3msg.bad{background:#B3261E}
.c3tools{position:absolute;inset-inline-start:12px;top:64px;z-index:6;display:flex;flex-direction:column;gap:6px;background:rgba(255,255,255,.94);border:1px solid #D3D9DF;border-radius:12px;padding:6px}
.c3t{display:flex;flex-direction:column;align-items:center;gap:1px;background:none;border:2px solid transparent;border-radius:9px;padding:6px 4px 3px;width:56px;color:#26323F;cursor:pointer;font:11px var(--font-ui)}
.c3t:hover{background:#F1F4F7}
.c3t.on{border-color:#2F6BE0;background:#E8F0FD}
.c3hot{position:absolute;left:24px;right:24px;bottom:14px;z-index:6;background:rgba(251,250,247,.96);border:1px solid #D3D9DF;border-radius:14px;padding:8px 12px 10px}
.c3hot .hh{display:flex;justify-content:space-between;font:12px var(--font-ui);color:#5A6673;margin-bottom:6px}
.c3hot .hh b{color:#17212B}
.c3hot .hs{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px}
.c3h{position:relative;display:flex;flex-direction:column;align-items:center;gap:0;background:#fff;border:1px solid #D9DFE5;border-radius:9px;padding:3px 2px 4px;cursor:pointer;font:12px var(--font-ui);color:#26323F;min-width:0}
.c3h:hover{border-color:#8FA0B2}
.c3h.on{border:2px solid #2F6BE0;background:#E8F0FD;padding:2px 1px 3px}
.c3h em{position:absolute;left:6px;top:3px;font:700 10px var(--font-ui);color:#5A6673;font-style:normal}
.c3h img,.c3h svg{display:block;width:64px;height:52px;object-fit:contain}
.c3h span{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.c3flat{position:absolute;inset:56px 20px 20px;display:grid;gap:8px;align-content:start}
.c3flat .lot{border:1px dashed #AEB8C4;border-radius:6px;min-height:70px}
.c3flat .tile{display:flex;flex-direction:column;gap:2px;text-align:start;background:#fff;border:1px solid #CBD3DB;border-top:4px solid var(--c);border-radius:6px;padding:8px 10px;font:12px var(--font-ui);color:#4A5663;cursor:pointer;min-height:70px}
.c3flat .tile b{color:#17212B;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.c3flat .tile i{font-style:normal;color:#19795A}

/* ---------- the 3D office (C2): zone rooms and the side list */
.stage.w3on{background:#F5F6F8}
.stage.w3on .stage-in{display:none}
.stage.w3on .zoombar{inset-inline-end:288px;left:auto}
.stage.w3on .zoombar .zh{display:none}
.stage.w3on .ohead{max-width:calc(100% - 300px)}
.o3root{position:absolute;inset:0;display:none}
.stage.w3on .o3root{display:block}
.o3root .k3host{inset:0 276px 0 0}
.o3side{position:absolute;top:10px;bottom:10px;inset-inline-end:10px;width:262px;background:#FBFAF7;border:1px solid #D9D5CA;border-radius:12px;padding:12px 12px 8px;overflow-y:auto;font:12px var(--font-ui);color:#26323F;cursor:default}
.o3side h3{margin:0 0 8px;font:700 15px var(--font-ui);color:#17212B;display:flex;justify-content:space-between}
.o3side h3 span{font-weight:400;color:#66727F}
.o3side ol{list-style:none;margin:0;padding:0}
.o3row{display:flex;align-items:center;gap:9px;width:100%;text-align:start;background:none;border:0;border-top:1px solid #E7E3D9;padding:7px 4px;cursor:pointer;font:inherit;color:inherit}
.o3row:hover,.o3row.sel{background:#F1EEE5}
.o3row.sel{background:#E3DECF}
.o3b{flex:none;width:20px;height:20px;display:block}
.o3row .nm{flex:1;min-width:0;display:flex;flex-direction:column}
.o3row .nm b{font-size:13px;color:#17212B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.o3row .nm small{color:#66727F;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.o3row .st{flex:none;font-style:normal;font-weight:700;font-size:11.5px}
.o3side .idle{border-top:1px solid #E7E3D9;padding-top:8px;margin-top:2px}
.o3idle{display:flex;align-items:center;gap:10px;width:100%;background:#fff;border:1px solid #D9D5CA;border-radius:10px;padding:8px 10px;cursor:pointer;font:inherit;color:#17212B}
.o3idle:hover{border-color:#8FA0B2}
.o3idle b{margin-inline-start:auto;font-size:13px}
.o3idle .more{color:#66727F}
.o3idle .faces{display:flex}
.o3idle .faces u{display:block;width:10px;height:18px;border-radius:5px 5px 3px 3px;background:#C3C7CE;margin-inline-end:3px;position:relative}
.o3idle .faces u:before{content:"";position:absolute;left:1px;top:-5px;width:8px;height:8px;border-radius:50%;background:#E6D6C8}
.o3side .idle ul{list-style:none;margin:6px 0 0;padding:0}
.o3side .idle li{padding:4px 6px;color:#4A5663;display:flex;justify-content:space-between;gap:8px}
.o3side .idle li small{color:#8A949F}
.o3rep{display:flex;justify-content:space-between;width:100%;margin:0 0 6px;background:#fff;border:1px solid #D9D5CA;border-radius:8px;padding:6px 10px;font:700 12px var(--font-ui);color:#17212B;cursor:pointer}
.o3rep:hover{border-color:#8FA0B2}
.o3key{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:10px;color:#4A5663;font-size:11px}
.o3key span{display:flex;align-items:center;gap:4px}
.o3key svg{width:14px;height:14px}
.stage.w3on .legend{display:none}
.o3side .note{margin:10px 2px 2px;color:#7A838D;font-size:11px}
.o3a{position:absolute;pointer-events:auto;cursor:pointer;outline:none;border-radius:6px}
.o3a:focus-visible{box-shadow:0 0 0 2px #2F6BE0}
.o3a .n{position:absolute;left:50%;top:0;transform:translateX(-50%);width:20px;height:20px;display:block}
.o3a .body{position:absolute;display:block}
.o3a .body.dot{border:2px solid #fff;box-sizing:border-box;box-shadow:0 0 0 1px rgba(23,33,43,.3)}
.o3a .ini{position:absolute;left:0;right:0;text-align:center;color:#fff;font-weight:700;line-height:1;letter-spacing:0;pointer-events:none}
.o3a.sel{box-shadow:0 0 0 2px #2F6BE0;background:rgba(47,107,224,.08)}
.o3t,.o3c,.o3r{position:absolute;font:700 11.5px var(--font-ui);color:#17212B;background:#fff;border:1px solid #CFCBC0;border-radius:6px;padding:2px 8px;white-space:nowrap;pointer-events:none}
.o3t{border-bottom-width:3px;line-height:15px;pointer-events:auto;cursor:pointer}
.o3tip{position:absolute;z-index:5;max-width:260px;display:flex;flex-direction:column;gap:2px;font:400 12px var(--font-ui);color:#fff;background:#17212B;border-radius:6px;padding:6px 9px;pointer-events:none;white-space:normal;box-shadow:0 2px 8px rgba(23,33,43,.3)}
.o3tip b{font-weight:700}
.o3t.gone{display:none}
.o3r{display:flex;align-items:center;gap:5px;font-weight:700;font-size:11px;padding:1px 7px 1px 5px;background:rgba(255,255,255,.88)}
.o3r span{width:9px;height:9px;border-radius:2px;flex:none}
.o3c{display:flex;align-items:center;gap:6px;padding:3px 10px;pointer-events:auto}
.o3c.grp{border-color:#B45309;color:#7A3A06}
.o3c.lounge i{display:inline-block;width:12px;height:12px;border-radius:50%;background:#8A94A1}
.o3c button{font:700 11.5px var(--font-ui);background:none;border:0;color:inherit;cursor:pointer;display:flex;align-items:center;gap:6px;padding:0}
.o3c.rep{font-size:13px;padding:5px 14px;border-radius:7px}
.o3ln{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.o3ln line{stroke:#B45309;stroke-width:1.4}
`

module.exports = { FONT, WORLD_STYLE }
