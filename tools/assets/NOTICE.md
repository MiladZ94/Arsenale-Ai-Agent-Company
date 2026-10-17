# Assets

The campus buildings are real low-poly models from third-party CC0 packs. The
office furniture and the people are still drawn by code (procedural shapes),
and so is any building type with no model here.

Shipped packs (CC0 1.0, public domain; each pack's own licence text is in
`licenses/`):

- Kenney, "City Kit (Commercial)" 2.1, https://kenney.nl/assets/city-kit-commercial
  (12 buildings in `kenney/`). The pack's texture is embedded into each file so
  it loads from one piece; nothing else was changed.

A model is added by dropping a .glb here with an entry in `manifest.json`: its
name, pack, author, source URL, licence, date fetched and SHA-256 (see
`tools/assets.cjs`). Only CC0-1.0 files are accepted. Other candidate sources:
KayKit and Quaternius free packs. Check the name and the licence on the source
page before a file is added.

`tools/test/assets.test.cjs` fails when a file here has no entry, when its
licence is not CC0-1.0, or when its hash differs.
