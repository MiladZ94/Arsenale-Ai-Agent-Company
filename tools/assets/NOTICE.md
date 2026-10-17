# Assets

The campus buildings, the office furniture and the person at each desk are real
low-poly models from third-party CC0 packs. Anything with no model here (or
whose file is missing or refused) is drawn by code (procedural shapes).

Shipped packs (CC0 1.0, public domain; each pack's own licence text is in
`licenses/`):

- Kenney, "City Kit (Commercial)" 2.1, https://kenney.nl/assets/city-kit-commercial
  (5 buildings in `kenney/commercial/`).
- Kenney, "City Kit (Industrial)" 2.0, https://kenney.nl/assets/city-kit-industrial
  (3 buildings and the water tower in `kenney/industrial/`).
- Kenney, "City Kit (Suburban)" 2.0, https://kenney.nl/assets/city-kit-suburban
  (3 buildings in `kenney/suburban/`).
- Kenney, "Furniture Kit" 2.0, https://kenney.nl/assets/furniture-kit
  (desk, chair, sofa, plant, screen in `kenney/furniture/`).
- Kenney, "Mini Characters" 1.0, https://kenney.nl/assets/mini-characters
  (one character in `kenney/characters/`).

Each pack's texture is embedded into the files that use one, so a model loads
from one piece; nothing else was changed. Only what the page uses is shipped.

A model is added by dropping a .glb here with an entry in `manifest.json`: its
name, pack, author, source URL, licence, date fetched and SHA-256 (see
`tools/assets.cjs`). Only CC0-1.0 files are accepted. Other candidate sources:
KayKit and Quaternius free packs. Check the name and the licence on the source
page before a file is added.

`tools/test/assets.test.cjs` fails when a file here has no entry, when its
licence is not CC0-1.0, or when its hash differs.

The head-and-shoulders pictures and the seated-at-a-desk picture in `portraits/` are renders of that one
Mini Characters figure and the Furniture Kit desk (`tools/render-portraits.cjs`), so a person on the Team,
Tasks and Approvals screens is the same character as at the desks in the
office. They are derived from a CC0 model and are CC0 too.
