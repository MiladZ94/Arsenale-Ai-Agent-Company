# The shared world

`office-world.cjs` draws the campus and the 3D office floor. Its author's
private dashboard, which grew out of the same code, used to keep a copy of it
in step with a sync script; that dashboard now runs Arsenale itself against its
own data folder (`config.json` `runsDir`, `companyDir`, see `paths.cjs`), so
there is one copy of the drawing code and nothing to sync.

## Files

| File | What it is |
|---|---|
| `tools/office-world.cjs` | the one require path: re-exports the pieces below |
| `tools/pages/world/campus.cjs` | the campus: light isometric buildings (SVG) on a lot grid, an office card above each, zoom and pan, build mode (hotbar, tools, ghost); talks to `POST api/campus` |
| `tools/pages/world/office3d.cjs`, `office3d/` | the office floor in three.js: a room, a station and a card per person, the lounge, the supervisor's station, the walks |
| `tools/pages/world/style.cjs` | the CSS of both |
| `tools/pages/world/scripts.cjs` | Node: the pinned three.js and the characters, inlined into the page |
| `tools/vendor/three/` | three.js r184, pinned (`three.cjs` is byte-identical to `three@0.184.0` `build/three.cjs`), the r184 `GLTFLoader`, `SkeletonUtils` and `BufferGeometryUtils` converted to classic scripts; MIT, see `three-LICENSE.txt` |
| `tools/characters/default.glb` | the default character, made by `tools/characters/make-default-character.cjs`; CC0, see `tools/characters/LICENSE.txt` |
| `tools/campus.cjs` | the campus model and its one write path (`campus.json`); see its header |

The pages keep their own data code (who works where, budgets, runs). Only the
look lives in the shared files, and it must never name a company, an office or
a person: it is public.

## Nothing is downloaded

The buildings are drawn in code (SVG) and the character is made by our own
script, so no asset file is needed. A model of someone's own replaces the
default character, as below.

## Characters

Every desk shows `characters/default.glb` until a person's own file replaces it:

- drop a `.glb` on that person's desk in the office (remembered in that
  browser), or use **Load .glb…** in the details panel;
- or put `<agent-name>.glb` in the `characters` folder of the data folder
  (`ARSENALE_HOME/characters/`); the page inlines it on the next load.

A replacement file uses the same clip names, matched without regard to case:
`Idle`, `Typing`, `Thinking`, `Celebrate`, and `Walk` and `Stand` for the walks
between the lounge, the supervisor and the desk (see `CLIP_RX` in
`pages/world/office3d/part2.js` for the other names that match). A file without `Walk` or
`Stand` moves and waits in its idle pose. glTF 2.0 binary, textures embedded, no Draco
or meshopt, Y up, metres, facing +Z. A clip name with "sit" in it, or scene
extras `{"arsenale": {"seated": true}}`, seats the person on the chair; otherwise
they stand beside the desk.
