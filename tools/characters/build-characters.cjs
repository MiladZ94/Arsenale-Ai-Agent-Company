/* Builds the shipped office characters from the KayKit packs (CC0), and
 * writes the licence record next to them.
 *
 *   node tools/characters/build-characters.cjs --src <folder with the two unpacked packs>
 *
 * <src> holds kaykit-adventurers/ and kaykit-character-animations/, each with
 * the pack's own folder under files/ (the way the download was unpacked).
 * The packs are data: this script reads .glb and .png files from them and
 * never runs anything that came with them.
 *
 * For each character it
 *  - keeps the body, head, arms and legs, and leaves out every prop and every
 *    piece of costume that is a mesh of its own (capes, hats, helmets, quiver,
 *    masks);
 *  - turns the colour atlas into vertex colours: the head keeps its face and
 *    hair, the hands take the face's skin tone, the sleeves and the body become a
 *    neutral "Shirt" that the page tints with the office's colour, the legs
 *    become plain dark trousers and shoes;
 *  - merges the skeleton with six clips of the shared Rig_Medium set, named
 *    Idle, Walk, Sit, Typing, Stand and Celebrate (Typing is the seated clip
 *    with the arms moving over a keyboard: a recorded change).
 * The output is deterministic: the same packs give the same bytes. */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { readGlb, readAccessor, imageBytes, decodePng, makeWriter } = require('./glb-io.cjs')
const manifest = require('./manifest.cjs')

const OUT = __dirname
const GENERATOR = 'Arsenale character build'
const SHIRT_NAME = 'Shirt'

// the shipped set: file, the source model, and the part of the pack it comes from
const SET = [
  { file: 'person-1.glb', from: 'adv', model: 'Rogue' },
  { file: 'person-2.glb', from: 'adv', model: 'Ranger' },
  { file: 'person-3.glb', from: 'adv', model: 'Mage' },
  { file: 'person-4.glb', from: 'adv', model: 'Barbarian' },
  { file: 'person-5.glb', from: 'adv', model: 'Knight' },
  { file: 'person-plain.glb', from: 'mannequin', model: 'Mannequin_Medium' },
]
const PACKS = {
  adv: {
    id: 'kaykit-adventurers', dir: 'kaykit-adventurers/files/KayKit_Adventurers_2.0_FREE', model: (m) => 'Characters/gltf/' + m + '.glb', licence: 'License.txt',
    library: 'KayKit - Character Pack: Adventurers 2.0 (Free)', author: 'Kay Lousberg (www.kaylousberg.com)', pageUrl: 'https://kaylousberg.itch.io/kaykit-adventurers',
    downloadedAt: '2026-10-21', archiveSha256: 'abe48f4763fba0896bab486ee9e6d08ca6b5b3884b9601f235c8847ae94dc479', licenceFile: 'KayKit-Adventurers-License.txt',
  },
  anim: {
    id: 'kaykit-character-animations', dir: 'kaykit-character-animations/files/KayKit_Character_Animations_1.1', licence: 'License.txt',
    library: 'KayKit - Character Animations 1.1', author: 'Kay Lousberg (www.kaylousberg.com)', pageUrl: 'https://kaylousberg.itch.io/kaykit-character-animations',
    downloadedAt: '2026-10-21', archiveSha256: '65882f31f905ad2e953819648a59287cdeab8f623908d5ef701971d3758be20f', licenceFile: 'KayKit-Character-Animations-License.txt',
  },
}
PACKS.mannequin = Object.assign({}, PACKS.anim, { model: (m) => 'Mannequin Character/characters/' + m + '.glb' })
const RIG = (n) => 'Animations/gltf/Rig_Medium/Rig_Medium_' + n + '.glb'
// shipped clip -> [animation file, source clip]; Typing is made, not copied
const CLIPS = [
  ['Idle', 'General', 'Idle_A'], ['Walk', 'MovementBasic', 'Walking_A'], ['Sit', 'Simulation', 'Sit_Chair_Idle'],
  ['Typing', null, null], ['Stand', 'General', 'Idle_B'], ['Celebrate', 'Simulation', 'Cheering'],
]
const KEEP = /^(ArmLeft|ArmRight|Body|Head|LegLeft|LegRight)$/
const TROUSERS = '#2E3644', SHOES = '#1E2229'
const HANDS = /^(hand|wrist|handslot)\./
const LEGS = /^(upperleg|lowerleg|foot|toes)\./
const FEET = /^(foot|toes)\./
const ARM_TRACKS = /^(upperarm|lowerarm|wrist|hand|handslot)\.(l|r)$/

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const hex = (s) => [1, 3, 5].map((i) => lin(parseInt(s.slice(i, i + 2), 16) / 255))
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const eulerQ = (x, y, z) => {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2)
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3]
}

function sampleAtlas(img, u, v) {
  const x = Math.min(img.w - 1, Math.max(0, Math.floor(u * img.w))), y = Math.min(img.h - 1, Math.max(0, Math.floor(v * img.h)))
  const i = (y * img.w + x) * 4
  return [lin(img.rgba[i] / 255), lin(img.rgba[i + 1] / 255), lin(img.rgba[i + 2] / 255)]
}

/** The merged, recoloured mesh of one source model: two primitives (the
 *  tintable shirt, and everything else), as flat arrays. */
function recolour(g) {
  const skin = g.json.skins[0], joints = skin.joints, jname = joints.map((n) => g.json.nodes[n].name)
  const img = decodePng(imageBytes(g, 0))
  const parts = []
  g.json.nodes.forEach((nd) => {
    if (nd.mesh === undefined || nd.skin === undefined) return
    const part = nd.name.split('_').pop()
    if (!KEEP.test(part)) return
    const prim = g.json.meshes[nd.mesh].primitives[0], at = prim.attributes
    const pos = readAccessor(g, at.POSITION), nor = readAccessor(g, at.NORMAL), uv = readAccessor(g, at.TEXCOORD_0)
    const jn = readAccessor(g, at.JOINTS_0), wt = readAccessor(g, at.WEIGHTS_0), idx = readAccessor(g, prim.indices)
    parts.push({ part, pos, nor, uv, jn, wt, idx })
  })
  // the skin tone, read off the face (the brighter half of what faces forward at eye and cheek height):
  // the hands take it, so a glove or a bracer never survives into an office
  const skinTone = (() => {
    const head = parts.find((p) => p.part === 'Head'), ys = []
    for (let i = 0; i < head.pos.count; i++) ys.push(head.pos.data[i * 3 + 1])
    const lo = Math.min(...ys), hi = Math.max(...ys), face = []
    for (let i = 0; i < head.pos.count; i++) {
      const y = (head.pos.data[i * 3 + 1] - lo) / (hi - lo)
      if (head.nor.data[i * 3 + 2] > 0.6 && y > 0.3 && y < 0.6) face.push(sampleAtlas(img, head.uv.data[i * 2], head.uv.data[i * 2 + 1]))
    }
    face.sort((a, b) => luma(...b) - luma(...a))
    const top = face.slice(0, Math.max(1, face.length >> 1))
    return top[top.length >> 1]
  })()
  // pass 1: what each vertex is
  const verts = []
  for (const p of parts) {
    p.cls = []
    for (let i = 0; i < p.pos.count; i++) {
      let best = 0, bw = -1
      for (let k = 0; k < 4; k++) if (p.wt.data[i * 4 + k] > bw) { bw = p.wt.data[i * 4 + k]; best = k }
      const dj = jname[p.jn.data[i * 4 + best]] || ''
      const orig = sampleAtlas(img, p.uv.data[i * 2], p.uv.data[i * 2 + 1])
      let cls
      if (p.part === 'Head') cls = 'keep'
      else if (/^Arm/.test(p.part)) cls = HANDS.test(dj + '.') ? 'hand' : 'shirt'
      else if (/^Leg/.test(p.part)) cls = FEET.test(dj + '.') ? 'shoes' : 'trousers'
      else cls = LEGS.test(dj + '.') ? (FEET.test(dj + '.') ? 'shoes' : 'trousers') : 'shirt'
      p.cls.push({ cls, orig })
      verts.push({ cls, l: luma(...orig) })
    }
  }
  // the original shading, softened, rides on the new flat colours
  const mean = {}
  for (const k of ['shirt', 'trousers', 'shoes']) { const a = verts.filter((v) => v.cls === k); mean[k] = a.length ? a.reduce((s, v) => s + v.l, 0) / a.length : 1 }
  const shade = (k, l) => Math.min(1.12, Math.max(0.62, 1 + (l / (mean[k] || 1) - 1) * 0.45))
  const base = { trousers: hex(TROUSERS), shoes: hex(SHOES) }
  const prims = { shirt: { P: [], N: [], C: [], J: [], W: [], I: [] }, other: { P: [], N: [], C: [], J: [], W: [], I: [] } }
  for (const p of parts) {
    const colour = p.cls.map(({ cls, orig }) => {
      if (cls === 'keep') return orig
      if (cls === 'hand') return skinTone
      const s = shade(cls, luma(...orig))
      if (cls === 'shirt') return [s, s, s]
      return base[cls].map((c) => c * s)
    })
    const isShirt = p.cls.map((c) => c.cls === 'shirt')
    const remap = { shirt: new Map(), other: new Map() }
    for (let t = 0; t < p.idx.count; t += 3) {
      const tri = [p.idx.data[t], p.idx.data[t + 1], p.idx.data[t + 2]]
      const key = tri.filter((i) => isShirt[i]).length >= 2 ? 'shirt' : 'other'
      const dst = prims[key], map = remap[key]
      for (const i of tri) {
        if (!map.has(i)) {
          map.set(i, dst.P.length / 3)
          dst.P.push(p.pos.data[i * 3], p.pos.data[i * 3 + 1], p.pos.data[i * 3 + 2])
          dst.N.push(p.nor.data[i * 3], p.nor.data[i * 3 + 1], p.nor.data[i * 3 + 2])
          dst.C.push(colour[i][0], colour[i][1], colour[i][2])
          for (let k = 0; k < 4; k++) { dst.J.push(p.jn.data[i * 4 + k]); dst.W.push(p.wt.data[i * 4 + k]) }
        }
        dst.I.push(map.get(i))
      }
    }
  }
  return { prims, skin }
}

const q16 = (f) => Math.round(Math.min(1, Math.max(0, f)) * 65535)

function loadClips(packDir, wanted) {
  const files = {}
  const out = {}
  for (const [name, file, src] of wanted) {
    if (!file) continue
    if (!files[file]) files[file] = readGlb(path.join(packDir, RIG(file)))
    const g = files[file], a = g.json.animations.find((x) => x.name === src)
    if (!a) throw new Error('no clip ' + src + ' in ' + file)
    const tracks = []
    for (const ch of a.channels) {
      const nodeName = g.json.nodes[ch.target.node].name, s = a.samplers[ch.sampler]
      tracks.push({ node: nodeName, path: ch.target.path, interp: s.interpolation || 'LINEAR', times: readAccessor(g, s.input).data, values: readAccessor(g, s.output).data })
    }
    out[name] = { source: file + ':' + src, tracks }
  }
  return out
}

/** Typing: the seated clip, with the arms moving over a keyboard. The arm
 *  poses are absolute (the tracks they replace are dropped); the hands tap
 *  in turn, a whole number of cycles over the clip so it loops cleanly. */
function typingFrom(sit) {
  const dur = Math.max(...sit.tracks.map((t) => t.times[t.times.length - 1]))
  const cycles = Math.max(1, Math.round(dur / 0.8)), steps = cycles * 8
  const times = Float32Array.from({ length: steps + 1 }, (_, i) => dur * i / steps)
  const tracks = sit.tracks.filter((t) => !(t.path === 'rotation' && ARM_TRACKS.test(t.node)))
  const pose = [['upperarm.l', 0, 0.9, 0.25, 0.024], ['upperarm.r', 1, 0.9, -0.25, 0.024], ['lowerarm.l', 0, 1.2, 0, 0.16], ['lowerarm.r', 1, 1.2, 0, 0.16]]
  for (const [node, side, x, z, wig] of pose) {
    const vals = new Float32Array((steps + 1) * 4)
    for (let i = 0; i <= steps; i++) {
      const w = Math.sin(i / steps * Math.PI * 2 * cycles + side * 1.6) * wig
      vals.set(eulerQ(x + w, 0, z), i * 4)
    }
    tracks.push({ node, path: 'rotation', interp: 'LINEAR', times, values: vals })
  }
  return { source: sit.source + ' (arms: synthesised)', tracks }
}

function writeCharacter(srcGlb, clips) {
  const { prims, skin } = recolour(srcGlb)
  const nodes = srcGlb.json.nodes, joints = skin.joints
  const newIndex = new Map(joints.map((n, i) => [n, i]))
  const w = makeWriter()
  const outNodes = joints.map((n) => {
    const s = nodes[n], o = { name: s.name }
    if (s.translation) o.translation = s.translation.map((v) => +v.toFixed(7))
    if (s.rotation) o.rotation = s.rotation.map((v) => +v.toFixed(7))
    if (s.scale && s.scale.some((v) => Math.abs(v - 1) > 1e-4)) o.scale = s.scale
    if (s.children) { const c = s.children.filter((k) => newIndex.has(k)).map((k) => newIndex.get(k)); if (c.length) o.children = c }
    return o
  })
  const rootBone = joints.findIndex((n) => !nodes.some((m) => (m.children || []).includes(n) && newIndex.has(nodes.indexOf(m))))
  const meshNode = outNodes.length, group = outNodes.length + 1
  outNodes.push({ name: 'Body', mesh: 0, skin: 0 })
  outNodes.push({ name: 'Rig_Medium', children: [rootBone, meshNode] })
  // geometry
  const primitives = []
  const mats = [{ name: SHIRT_NAME, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.8 } }, { name: 'Outfit', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.8 } }]
  for (const [key, mi] of [['other', 1], ['shirt', 0]]) {
    const p = prims[key]
    if (!p.I.length) continue
    const C = new Uint16Array(p.C.length / 3 * 4)
    for (let i = 0; i < p.C.length / 3; i++) { C[i * 4] = q16(p.C[i * 3]); C[i * 4 + 1] = q16(p.C[i * 3 + 1]); C[i * 4 + 2] = q16(p.C[i * 3 + 2]); C[i * 4 + 3] = 65535 }
    const W = new Uint16Array(p.W.length)
    for (let i = 0; i < p.W.length; i += 4) {
      const s = p.W[i] + p.W[i + 1] + p.W[i + 2] + p.W[i + 3] || 1
      for (let k = 0; k < 4; k++) W[i + k] = q16(p.W[i + k] / s)
    }
    primitives.push({
      attributes: {
        POSITION: w.accessor(Float32Array.from(p.P), 'VEC3', { minmax: true, target: 34962 }),
        NORMAL: w.accessor(Float32Array.from(p.N), 'VEC3', { target: 34962 }),
        COLOR_0: w.accessor(C, 'VEC4', { normalized: true, target: 34962 }),
        JOINTS_0: w.accessor(Uint8Array.from(p.J), 'VEC4', { target: 34962 }),
        WEIGHTS_0: w.accessor(W, 'VEC4', { normalized: true, target: 34962 }),
      },
      indices: w.accessor(Uint16Array.from(p.I), 'SCALAR', { target: 34963 }), material: mi, mode: 4,
    })
  }
  const ibm = readAccessor(srcGlb, skin.inverseBindMatrices)
  const skins = [{ name: 'Rig_Medium', joints: joints.map((_, i) => i), skeleton: rootBone, inverseBindMatrices: w.accessor(Float32Array.from(ibm.data), 'MAT4') }]
  // clips
  const byName = new Map(outNodes.map((n, i) => [n.name, i]))
  const animations = []
  for (const [name, clip] of Object.entries(clips)) {
    const channels = [], samplers = []
    for (const t of clip.tracks) {
      const target = byName.get(t.node)
      if (target === undefined || target >= joints.length || t.path === 'scale') continue
      if (t.path === 'translation' && !/^(hips|root)$/.test(t.node)) continue // bones do not stretch or slide; only the hips and the root travel
      samplers.push({
        input: w.accessor(Float32Array.from(t.times), 'SCALAR', { minmax: true }),
        output: w.accessor(Float32Array.from(t.values), t.path === 'rotation' ? 'VEC4' : 'VEC3'),
        interpolation: t.interp,
      })
      channels.push({ sampler: samplers.length - 1, target: { node: target, path: t.path } })
    }
    animations.push({ name, channels, samplers })
  }
  const json = {
    asset: { version: '2.0', generator: GENERATOR, copyright: 'CC0 1.0. Models and animations by Kay Lousberg (KayKit).' },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [group], extras: { arsenale: { office: true, seated: true } } }],
    nodes: outNodes, meshes: [{ name: 'Body', primitives }], materials: mats, skins, animations,
  }
  return w.finish(json)
}

function main() {
  const args = process.argv.slice(2), at = args.indexOf('--src')
  const SRC = at >= 0 ? args[at + 1] : process.env.ARSENALE_CHAR_SRC
  if (!SRC) { console.error('usage: node build-characters.cjs --src <folder with the unpacked KayKit packs>'); process.exit(2) }
  const packDir = (p) => path.join(SRC, PACKS[p].dir)
  const clipsWanted = loadClips(packDir('anim'), CLIPS)
  clipsWanted.Typing = typingFrom(clipsWanted.Sit)
  const clips = {}
  for (const [name] of CLIPS) clips[name] = clipsWanted[name]
  const entries = []
  for (const item of SET) {
    const pk = PACKS[item.from], srcFile = path.join(packDir(item.from), pk.model(item.model))
    const srcBuf = fs.readFileSync(srcFile)
    const out = writeCharacter(readGlb(srcBuf), clips)
    fs.writeFileSync(path.join(OUT, item.file), out)
    const clipFiles = [...new Set(CLIPS.filter((c) => c[1]).map((c) => RIG(c[1])))]
    entries.push({
      file: item.file, kind: 'model',
      sources: [
        { pack: pk.id, library: pk.library, author: pk.author, pageUrl: pk.pageUrl, downloadedAt: pk.downloadedAt, archiveSha256: pk.archiveSha256, originalFile: pk.model(item.model), originalSha256: sha(srcBuf) },
        ...clipFiles.map((f) => ({ pack: PACKS.anim.id, library: PACKS.anim.library, author: PACKS.anim.author, pageUrl: PACKS.anim.pageUrl, downloadedAt: PACKS.anim.downloadedAt, archiveSha256: PACKS.anim.archiveSha256, originalFile: f, originalSha256: sha(fs.readFileSync(path.join(packDir('anim'), f))) })),
      ],
      licenceText: [pk.licenceFile, PACKS.anim.licenceFile].filter((v, i, a) => a.indexOf(v) === i).map((f) => 'licences/' + f),
      changes: [
        'costume props left out (capes, hats, helmets, quiver, masks, weapons)', 'outfit recoloured: neutral shirt (tinted by the page), plain dark trousers and shoes; face and hair kept',
        'atlas texture baked into vertex colours', 'merged with the shared Rig_Medium animation set; six clips kept and renamed ' + CLIPS.map((c) => c[0]).join(', '),
        'Typing synthesised from ' + clipsWanted.Sit.source + ' with a keyboard arm motion', 'asset.generator set to "' + GENERATOR + '"',
      ],
    })
    console.log(item.file, out.length, 'bytes')
  }
  // the licence texts of the two packs, copied as they came
  fs.mkdirSync(path.join(OUT, 'licences'), { recursive: true })
  for (const pk of [PACKS.adv, PACKS.anim]) fs.copyFileSync(path.join(packDir(pk === PACKS.adv ? 'adv' : 'anim'), pk.licence), path.join(OUT, 'licences', pk.licenceFile))
  manifest.setModels(entries, [PACKS.adv, PACKS.anim])
  manifest.refresh()
}

if (require.main === module) main()
module.exports = { SET, GENERATOR, SHIRT_NAME }
