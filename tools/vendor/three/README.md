# three.js r184, pinned

Loaded by the office page from this folder (inlined by `office-world.cjs`),
never from a CDN.

| File | From | Changes |
|---|---|---|
| `three.cjs` | `three@0.184.0`, `build/three.cjs` | none (SHA-256 `0fe243aabd03faa48e4156b51bf5b4c943fea15748aa623047aab539ab3b9624`) |
| `GLTFLoader.js` | r184 `examples/jsm/loaders/GLTFLoader.js` | turned into a classic script: imports read from `window.THREE`, exports go to `window.THREE_ADDONS` |
| `SkeletonUtils.js` | r184 `examples/jsm/utils/SkeletonUtils.js` | the same |
| `BufferGeometryUtils.js` | r184 `examples/jsm/utils/BufferGeometryUtils.js` | the same |

MIT licence, `three-LICENSE.txt`. To move to another release, replace all four
files from the same release and update this table.
