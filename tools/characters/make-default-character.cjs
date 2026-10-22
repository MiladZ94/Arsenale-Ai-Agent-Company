#!/usr/bin/env node
/* Builds tools/characters/default.glb, the character every desk in the 3D
 * office uses until someone drops in their own.
 *
 *   node tools/characters/make-default-character.cjs [out.glb]
 *
 * A low-poly person, seated (the rest pose is on a chair: hips at 0.47 m,
 * feet on the floor), Y up, metres, origin on the floor under the hips (the
 * middle of the seat), facing +Z. It
 * is made here from three.js primitives and written with the small glTF 2.0
 * writer below, so no model is downloaded and the file is our own work,
 * released as CC0 (characters/LICENSE.txt). The output is byte-for-byte the
 * same on every run: nothing in it depends on the clock or on Math.random.
 *
 * Clips, matched by name in office-world.cjs (the same names a replacement
 * file should use): Idle, Typing, Thinking, Celebrate (seated), Walk and
 * Stand (standing up). They animate nodes (no skinning), which every glTF
 * viewer plays.
 *
 * Materials are named Skin, Hair, Shirt, Trousers, Shoes, Eyes. The office
 * recolours Skin, Hair and Shirt per agent, but only in this file: the scene
 * carries extras {arsenale:{default:true, seated:true}}, and a file without
 * that mark keeps its own colours.
 */
const fs = require('fs')
const path = require('path')
const T = require(path.join(__dirname, '..', 'vendor', 'three', 'three.cjs'))

// ---------- the person
const MAT = {
  Skin: '#E9B994', Hair: '#3B2A20', Shirt: '#5B7FCB', Trousers: '#3F4A5A', Shoes: '#22262C', Eyes: '#1B1B1F',
}
const nodes = [] // { name, t:[x,y,z], r:[x,y,z,w], children:[], meshes:[{geo, mat}] }
function node(name, parent, t) {
  const n = { name, t: t || [0, 0, 0], r: [0, 0, 0, 1], children: [], parts: [] }
  nodes.push(n)
  if (parent) parent.children.push(n)
  return n
}
// a part is a geometry placed inside its node; the transform is baked into the vertices
function part(n, geo, mat, at, rot, scale) {
  const g = geo.clone()
  if (scale) g.scale(scale[0], scale[1], scale[2])
  if (rot) g.applyQuaternion(new T.Quaternion().setFromEuler(new T.Euler(rot[0], rot[1], rot[2])))
  if (at) g.translate(at[0], at[1], at[2])
  n.parts.push({ geo: g, mat })
}
const cap = (r, l) => new T.CapsuleGeometry(r, l, 3, 10)
const ball = (r, w, h) => new T.SphereGeometry(r, w || 14, h || 10)
const boxG = (w, h, d) => new T.BoxGeometry(w, h, d)

const root = node('Character', null)
const hips = node('Hips', root, [0, 0.47, 0])
part(hips, boxG(0.3, 0.12, 0.24), 'Trousers', [0, 0.02, -0.02])
for (const [side, sx] of [['L', -1], ['R', 1]]) {
  // thigh forward along +Z, knee at the front of the chair, shin straight down
  const leg = node('Leg' + side, hips, [sx * 0.085, 0, 0])
  part(leg, cap(0.068, 0.3), 'Trousers', [0, 0, 0.17], [Math.PI / 2, 0, 0])
  const shin = node('Shin' + side, leg, [0, 0, 0.36])
  part(shin, cap(0.06, 0.32), 'Trousers', [0, -0.21, 0])
  part(shin, boxG(0.11, 0.07, 0.2), 'Shoes', [0, -0.435, 0.05])
}
const torso = node('Torso', hips, [0, 0.06, -0.03])
part(torso, cap(0.155, 0.22), 'Shirt', [0, 0.2, 0])
part(torso, boxG(0.08, 0.05, 0.02), 'Shirt', [0, 0.39, 0.145]) // the collar
const head = node('Head', torso, [0, 0.47, 0])
part(head, new T.CylinderGeometry(0.05, 0.055, 0.08, 10), 'Skin', [0, 0.02, 0])
part(head, ball(0.165, 16, 12), 'Skin', [0, 0.18, 0])
// hair: a cap over the top and back of the head
part(head, new T.SphereGeometry(0.178, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), 'Hair', [0, 0.195, -0.012], [-0.28, 0, 0])
for (const sx of [-1, 1]) {
  part(head, ball(0.022, 8, 6), 'Eyes', [sx * 0.058, 0.19, 0.152])
  part(head, ball(0.035, 8, 6), 'Skin', [sx * 0.163, 0.17, 0], null, [0.5, 1, 0.8]) // ears
}
part(head, ball(0.024, 8, 6), 'Skin', [0, 0.15, 0.165]) // nose
const arms = {}
for (const [side, sx] of [['L', -1], ['R', 1]]) {
  const sh = node('Arm' + side, torso, [sx * 0.2, 0.34, 0])
  part(sh, cap(0.05, 0.16), 'Shirt', [0, -0.11, 0])
  const el = node('Elbow' + side, sh, [0, -0.23, 0])
  part(el, cap(0.045, 0.14), 'Skin', [0, -0.09, 0])
  part(el, ball(0.052, 10, 8), 'Skin', [0, -0.2, 0])
  arms[side] = { sh, el }
}

// ---------- the clips (node rotations and one translation)
const q = (x, y, z) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z)).toArray()
const rot = (name, times, eulers) => ({ node: name, path: 'rotation', times, values: eulers.flatMap((e) => q(e[0], e[1], e[2])) })
const pos = (name, times, ps) => ({ node: name, path: 'translation', times, values: ps.flat() })
// hands resting on the lap / on the keyboard: shoulder forward (negative X), elbow bent
const LAP = { sh: [-0.45, 0, 0], el: [-0.85, 0, 0] }
const DOWN = Math.PI / 2, STAND_HIPS = 0.83
const CLIPS = [
  { name: 'Idle', tracks: [
    rot('Torso', [0, 2, 4], [[0, 0, 0], [-0.03, 0, 0], [0, 0, 0]]),
    rot('Head', [0, 1.5, 3, 4], [[0, -0.22, 0], [0.04, 0.2, 0], [0, 0.05, 0], [0, -0.22, 0]]),
    rot('ArmL', [0, 4], [LAP.sh, LAP.sh]), rot('ArmR', [0, 4], [LAP.sh, LAP.sh]),
    rot('ElbowL', [0, 4], [LAP.el, LAP.el]), rot('ElbowR', [0, 4], [LAP.el, LAP.el]),
  ] },
  { name: 'Typing', tracks: [
    rot('Torso', [0, 0.5], [[0.08, 0, 0], [0.08, 0, 0]]),
    rot('Head', [0, 0.25, 0.5], [[0.16, 0, 0], [0.13, 0.03, 0], [0.16, 0, 0]]),
    rot('ArmL', [0, 0.25, 0.5], [[-0.62, 0, 0.05], [-0.5, 0, 0.05], [-0.62, 0, 0.05]]),
    rot('ArmR', [0, 0.25, 0.5], [[-0.5, 0, -0.05], [-0.62, 0, -0.05], [-0.5, 0, -0.05]]),
    rot('ElbowL', [0, 0.5], [[-1.0, 0, 0], [-1.0, 0, 0]]), rot('ElbowR', [0, 0.5], [[-1.0, 0, 0], [-1.0, 0, 0]]),
  ] },
  { name: 'Thinking', tracks: [
    rot('Torso', [0, 4], [[0.02, 0, 0], [0.02, 0, 0]]),
    rot('Head', [0, 2, 4], [[-0.06, 0.18, 0.12], [-0.1, 0.3, 0.16], [-0.06, 0.18, 0.12]]),
    rot('ArmR', [0, 4], [[-1.15, 0, -0.3], [-1.15, 0, -0.3]]), rot('ElbowR', [0, 4], [[-2.25, 0, 0], [-2.25, 0, 0]]),
    rot('ArmL', [0, 4], [LAP.sh, LAP.sh]), rot('ElbowL', [0, 4], [LAP.el, LAP.el]),
  ] },
  { name: 'Celebrate', tracks: [
    pos('Hips', [0, 0.4, 0.8], [[0, 0.47, 0], [0, 0.53, 0], [0, 0.47, 0]]),
    rot('ArmL', [0, 0.4, 0.8], [[0, 0, -2.6], [0, 0, -2.85], [0, 0, -2.6]]),
    rot('ArmR', [0, 0.4, 0.8], [[0, 0, 2.6], [0, 0, 2.85], [0, 0, 2.6]]),
    rot('ElbowL', [0, 0.8], [[-0.3, 0, 0], [-0.3, 0, 0]]), rot('ElbowR', [0, 0.8], [[-0.3, 0, 0], [-0.3, 0, 0]]),
    rot('Head', [0, 0.4, 0.8], [[-0.15, 0, 0], [-0.22, 0, 0], [-0.15, 0, 0]]),
  ] },
  // Standing up from the seated rest pose: each thigh turns down by a
  // quarter turn and its shin back by the same, which puts the hips at
  // 0.83 m (thigh 0.36 + shin and shoe 0.47) with the feet on the floor.
  // The hips dip at the ends of a stride, where the legs are furthest apart,
  // so the feet stay on the floor.
  walkClip(),
  { name: 'Stand', tracks: [
    pos('Hips', [0, 4], [[0, STAND_HIPS, 0], [0, STAND_HIPS, 0]]),
    rot('LegL', [0, 4], [[DOWN, 0, 0], [DOWN, 0, 0]]), rot('LegR', [0, 4], [[DOWN, 0, 0], [DOWN, 0, 0]]),
    rot('ShinL', [0, 4], [[-DOWN, 0, 0], [-DOWN, 0, 0]]), rot('ShinR', [0, 4], [[-DOWN, 0, 0], [-DOWN, 0, 0]]),
    rot('Torso', [0, 2, 4], [[0, 0, 0], [-0.02, 0, 0], [0, 0, 0]]),
    rot('Head', [0, 2, 4], [[0.05, -0.12, 0], [0.02, 0.12, 0], [0.05, -0.12, 0]]),
    rot('ArmL', [0, 4], [[-0.08, 0, -0.06], [-0.08, 0, -0.06]]), rot('ArmR', [0, 4], [[-0.08, 0, 0.06], [-0.08, 0, 0.06]]),
    rot('ElbowL', [0, 4], [[-0.22, 0, 0], [-0.22, 0, 0]]), rot('ElbowR', [0, 4], [[-0.22, 0, 0], [-0.22, 0, 0]]),
  ] },
]
function walkClip() {
  const P = 0.9, ts = [0, P / 4, P / 2, 3 * P / 4, P], A = 0.4
  // thigh angle (from straight down, forward is negative) and knee bend per key; the right leg is half a stride behind the left
  const thighL = [-A, 0, A, 0, -A], kneeL = [0.05, 0.1, 0.25, 0.65, 0.05]
  const thighR = [A, 0, -A, 0, A], kneeR = [0.25, 0.65, 0.05, 0.1, 0.25]
  return { name: 'Walk', tracks: [
    pos('Hips', ts, [0.8, 0.83, 0.8, 0.83, 0.8].map((y) => [0, y, 0])),
    rot('LegL', ts, thighL.map((a) => [DOWN + a, 0, 0])), rot('LegR', ts, thighR.map((a) => [DOWN + a, 0, 0])),
    rot('ShinL', ts, thighL.map((a, i) => [kneeL[i] - DOWN - a, 0, 0])), rot('ShinR', ts, thighR.map((a, i) => [kneeR[i] - DOWN - a, 0, 0])),
    // the arms swing against the legs
    rot('ArmL', ts, thighL.map((a) => [-a * 0.8, 0, -0.05])), rot('ArmR', ts, thighR.map((a) => [-a * 0.8, 0, 0.05])),
    rot('ElbowL', [0, P], [[-0.3, 0, 0], [-0.3, 0, 0]]), rot('ElbowR', [0, P], [[-0.3, 0, 0], [-0.3, 0, 0]]),
    rot('Torso', ts, [[0.04, 0.05, 0], [0.04, 0, 0], [0.04, -0.05, 0], [0.04, 0, 0], [0.04, 0.05, 0]]),
    rot('Head', [0, P], [[-0.04, 0, 0], [-0.04, 0, 0]]),
  ] }
}

// ---------- a minimal glTF 2.0 binary writer
function linear(hex) {
  const c = new T.Color(hex) // three converts the sRGB hex to linear working colour
  return [c.r, c.g, c.b, 1].map((v) => Math.round(v * 1e6) / 1e6)
}
function writeGLB() {
  const chunks = []
  let byteLength = 0
  const bufferViews = [], accessors = []
  function view(typed, target) {
    const pad = (4 - (byteLength % 4)) % 4
    if (pad) { chunks.push(Buffer.alloc(pad)); byteLength += pad }
    const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)
    chunks.push(buf)
    const v = { buffer: 0, byteOffset: byteLength, byteLength: buf.length }
    if (target) v.target = target
    byteLength += buf.length
    bufferViews.push(v)
    return bufferViews.length - 1
  }
  function accessor(typed, type, componentType, target, minmax) {
    const size = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type]
    const a = { bufferView: view(typed, target), componentType, count: typed.length / size, type }
    if (minmax) {
      const min = Array(size).fill(Infinity), max = Array(size).fill(-Infinity)
      for (let i = 0; i < typed.length; i++) { const k = i % size; min[k] = Math.min(min[k], typed[i]); max[k] = Math.max(max[k], typed[i]) }
      a.min = min.map((v) => Math.fround(v)); a.max = max.map((v) => Math.fround(v))
    }
    accessors.push(a)
    return accessors.length - 1
  }
  const matNames = Object.keys(MAT)
  const materials = matNames.map((n) => ({ name: n, pbrMetallicRoughness: { baseColorFactor: linear(MAT[n]), metallicFactor: 0, roughnessFactor: n === 'Eyes' ? 0.35 : 0.75 } }))
  const meshes = []
  const gltfNodes = nodes.map((n) => {
    const out = { name: n.name }
    if (n.t.some((v) => v)) out.translation = n.t
    if (n.parts.length) {
      // one mesh per node, one primitive per material
      const byMat = new Map()
      for (const p of n.parts) { if (!byMat.has(p.mat)) byMat.set(p.mat, []); byMat.get(p.mat).push(p.geo) }
      const primitives = []
      for (const [m, geos] of byMat) {
        const merged = merge(geos)
        const P = new Float32Array(merged.pos), N = new Float32Array(merged.norm)
        const I = merged.pos.length / 3 > 65535 ? new Uint32Array(merged.idx) : new Uint16Array(merged.idx)
        primitives.push({
          attributes: { POSITION: accessor(P, 'VEC3', 5126, 34962, true), NORMAL: accessor(N, 'VEC3', 5126, 34962) },
          indices: accessor(I, 'SCALAR', I instanceof Uint32Array ? 5125 : 5123, 34963),
          material: matNames.indexOf(m),
        })
      }
      meshes.push({ name: n.name, primitives })
      out.mesh = meshes.length - 1
    }
    if (n.children.length) out.children = n.children.map((c) => nodes.indexOf(c))
    return out
  })
  const animations = CLIPS.map((c) => {
    const samplers = [], channels = []
    for (const tr of c.tracks) {
      const input = accessor(new Float32Array(tr.times), 'SCALAR', 5126, undefined, true)
      const output = accessor(new Float32Array(tr.values), tr.path === 'rotation' ? 'VEC4' : 'VEC3', 5126)
      samplers.push({ input, output, interpolation: 'LINEAR' })
      channels.push({ sampler: samplers.length - 1, target: { node: nodes.findIndex((n) => n.name === tr.node), path: tr.path } })
    }
    return { name: c.name, samplers, channels }
  })
  const pad = (4 - (byteLength % 4)) % 4
  if (pad) { chunks.push(Buffer.alloc(pad)); byteLength += pad }
  const json = {
    asset: { version: '2.0', generator: 'Arsenale make-default-character.cjs', copyright: 'CC0 1.0 (public domain dedication)' },
    scene: 0,
    scenes: [{ name: 'Default character', nodes: [0], extras: { arsenale: { default: true, seated: true } } }],
    nodes: gltfNodes, meshes, materials, accessors, bufferViews, animations,
    buffers: [{ byteLength }],
  }
  let js = Buffer.from(JSON.stringify(json), 'utf8')
  const jp = (4 - (js.length % 4)) % 4
  if (jp) js = Buffer.concat([js, Buffer.alloc(jp, 0x20)])
  const bin = Buffer.concat(chunks)
  const head = Buffer.alloc(12)
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8)
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b }
  return Buffer.concat([head, ch(js.length, 0x4E4F534A), js, ch(bin.length, 0x004E4942), bin])
}
function merge(geos) {
  const pos = [], norm = [], idx = []
  for (const g0 of geos) {
    const g = g0.index ? g0 : g0
    const base = pos.length / 3
    const p = g.attributes.position.array, n = g.attributes.normal.array
    for (let i = 0; i < p.length; i++) { pos.push(Math.round(p[i] * 1e5) / 1e5); norm.push(Math.round(n[i] * 1e4) / 1e4) }
    if (g.index) for (const i of g.index.array) idx.push(base + i)
    else for (let i = 0; i < p.length / 3; i++) idx.push(base + i)
  }
  return { pos, norm, idx }
}

const out = process.argv[2] || path.join(__dirname, 'default.glb')
const glb = writeGLB()
fs.writeFileSync(out, glb)
console.log('wrote ' + out + ' (' + (glb.length / 1024).toFixed(1) + ' KB)')
