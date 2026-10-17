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
| `tools/pages/world/kit.cjs` | the shared three.js kit: the engine (orthographic isometric camera, pan, zoom, picking), the 12 procedural building shapes, the avatar, the desk, the asset loader (buildings, furniture, characters), the checkerboard floor |
| `tools/pages/world/campus.cjs` | the campus board (design C2): lots, buildings, build mode, hotbar, ghost; talks to `POST api/campus` |
| `tools/pages/world/office3d.cjs` | the office floor (design C2): zone rooms, one figure per run, the side list, label placement |
| `tools/pages/world/palette.cjs` | role, room and state colours, one table, with the contrast check (4.5:1) |
| `tools/pages/world/style.cjs` | the CSS of both |
| `tools/pages/world/scripts.cjs` | Node: the pinned three.js and the asset models, inlined into the page |
| `tools/vendor/three/` | three.js r184, pinned (`three.cjs` is byte-identical to `three@0.184.0` `build/three.cjs`), the r184 `GLTFLoader`, `SkeletonUtils` and `BufferGeometryUtils` converted to classic scripts; MIT, see `three-LICENSE.txt` |
| `tools/campus.cjs` | the campus model and its one write path (`campus.json`); see its header |
| `tools/assets.cjs`, `tools/assets/` | the asset manifest and loader; see below |

The pages keep their own data code (who works where, budgets, runs). Only the
look lives in the shared files, and it must never name a company, an office or
a person: it is public.

## Nothing is downloaded

Every building, the avatar and the desk can be drawn in code from boxes,
cylinders and cones (`kit.cjs`): that is the fallback and needs no file. Real
CC0 models from Kenney ship in `tools/assets/kenney/` and replace the shapes
(see `tools/assets/NOTICE.md` for the packs). A model is added by putting a
`.glb` in `tools/assets/` and its entry in `tools/assets/manifest.json` (file,
`use`, name, author, source URL, licence, date fetched, sha256). `use` is
`building:<type>` (one of the 12 office types), `furniture:<name>` (desk, chair,
sofa, plant, screen) or `character:<style>` (office). Only `CC0-1.0` files with a
matching hash are used, and `tools/test/assets.test.cjs` fails for a shipped
file with no such entry. Other candidates are the KayKit and Quaternius free
packs; check each name and licence on the source page before adding one.
Textures must be embedded in the file (the server serves pages and JSON only).

## People

There is one avatar style everywhere: with the `character:office` model the
person sits at a desk and a round badge in the zone colour (`palette.cjs`) with
their initials floats above the head; without it, a round head on a coloured
body with the initials on it. State is told by the shape of the number badge as
well as its colour. It is one character model for every agent: there are no
per-role or per-person models.
