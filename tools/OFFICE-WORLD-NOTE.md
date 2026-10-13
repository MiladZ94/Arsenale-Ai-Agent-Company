# The shared office world

`office-world.cjs` draws the campus and the 3D office floor. Its author's
private dashboard, which grew out of the same code, used to keep a copy of it
in step with a sync script; that dashboard now runs Arsenale itself against its
own data folder (`config.json` `runsDir`, `companyDir`, see `paths.cjs`), so
there is one copy of the drawing code and nothing to sync.

## Files

| File | What it is |
|---|---|
| `tools/office-world.cjs` | campus art, the 3D office (three.js), and the Node helper that inlines the scripts into the page |
| `tools/vendor/three/` | three.js r184, pinned (`three.cjs` is byte-identical to `three@0.184.0` `build/three.cjs`), and the r184 `GLTFLoader`, `SkeletonUtils` and `BufferGeometryUtils` converted to classic scripts; MIT, see `three-LICENSE.txt` |
| `tools/characters/default.glb` | the default character, made by `tools/characters/make-default-character.cjs`; CC0, see `tools/characters/LICENSE.txt` |

The pages keep their own data code (who works where, budgets, runs). Only the
look lives in the shared file, and it must never name a company, an office or
a person: it is public.

## Characters

Every desk shows `characters/default.glb` until a person's own file replaces it:

- drop a `.glb` on that person's desk in the office (remembered in that
  browser), or use **Load .glb…** in the details panel;
- or put `<agent-name>.glb` in the `characters` folder of the data folder
  (`ARSENALE_HOME/characters/`); the page inlines it on the next load.

A replacement file uses the same clip names, matched without regard to case:
`Idle`, `Typing`, `Thinking`, `Celebrate`, and `Walk` and `Stand` for the walks
between the lounge, the supervisor and the desk (see `CLIP_RX` in
`office-world.cjs` for the other names that match). A file without `Walk` or
`Stand` moves and waits in its idle pose. glTF 2.0 binary, textures embedded, no Draco
or meshopt, Y up, metres, facing +Z. A clip name with "sit" in it, or scene
extras `{"arsenale": {"seated": true}}`, seats the person on the chair; otherwise
they stand beside the desk.
