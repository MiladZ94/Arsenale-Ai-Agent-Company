# Assets

Arsenale ships no third-party asset files. The campus buildings and the office
are drawn by code (procedural low-poly shapes).

A real model may replace a shape. Only CC0-1.0 files are accepted, and each
file needs an entry in `manifest.json` with its name, author, source URL,
licence, date fetched and SHA-256 (see `tools/assets.cjs`). Candidate sources:
Kenney, KayKit and Quaternius free packs. Check the name and the licence on the
source page before a file is added.

`tools/test/assets.test.cjs` fails when a file here has no entry, when its
licence is not CC0-1.0, or when its hash differs.
