/* Just enough glTF binary reading and writing for the character build, with
 * no packages: a GLB reader that returns accessors as plain typed arrays, a
 * PNG decoder (8 bit, not interlaced) for the colour atlases the source
 * models use, and a GLB writer. Used by build-characters.cjs only. */
const fs = require('fs')
const zlib = require('zlib')

const TYPE = { 5120: [Int8Array, 1, 127], 5121: [Uint8Array, 1, 255], 5122: [Int16Array, 2, 32767], 5123: [Uint16Array, 2, 65535], 5125: [Uint32Array, 4, 1], 5126: [Float32Array, 4, 1] }
const COMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }

function readGlb(file) {
  const b = typeof file === 'string' ? fs.readFileSync(file) : file
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB: ' + file)
  let off = 12, json = null, bin = null
  while (off < b.length) {
    const len = b.readUInt32LE(off), kind = b.readUInt32LE(off + 4)
    const body = b.subarray(off + 8, off + 8 + len)
    if (kind === 0x4e4f534a) json = JSON.parse(body.toString('utf8'))
    else if (kind === 0x004e4942 && !bin) bin = body
    off += 8 + len
  }
  return { json, bin }
}

/** An accessor as a flat Float32Array (floats, or integers turned into
 *  numbers; `normalized` ones come back in 0..1) plus its shape. */
function readAccessor(g, idx) {
  const a = g.json.accessors[idx], bv = g.json.bufferViews[a.bufferView]
  const [Ctor, size, max] = TYPE[a.componentType], n = COMP[a.type]
  const stride = bv.byteStride || size * n
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0)
  const out = new Float32Array(a.count * n)
  const dv = new DataView(g.bin.buffer, g.bin.byteOffset, g.bin.byteLength)
  const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType]
  for (let i = 0; i < a.count; i++) {
    for (let k = 0; k < n; k++) {
      let v = size === 1 ? dv[get](base + i * stride + k) : dv[get](base + i * stride + k * size, true)
      if (a.normalized && a.componentType !== 5126) v = Math.max(v / max, -1)
      out[i * n + k] = v
    }
  }
  void Ctor
  return { data: out, count: a.count, n }
}

/** The bytes of an embedded image. */
function imageBytes(g, i) {
  const bv = g.json.bufferViews[g.json.images[i].bufferView]
  return g.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)
}

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0
  const idat = []
  let plte = null, trns = null
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), kind = buf.toString('latin1', off + 4, off + 8), body = buf.subarray(off + 8, off + 8 + len)
    if (kind === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; ctype = body[9]; interlace = body[12] }
    else if (kind === 'PLTE') plte = body
    else if (kind === 'tRNS') trns = body
    else if (kind === 'IDAT') idat.push(body)
    off += 12 + len
  }
  if (depth !== 8 || interlace) throw new Error('PNG: only 8 bit, not interlaced')
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype]
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0, up = y ? px[(y - 1) * stride + x] : 0, ul = y && x >= ch ? px[(y - 1) * stride + x - ch] : 0
      let v = raw[src + x]
      if (f === 1) v += a
      else if (f === 2) v += up
      else if (f === 3) v += (a + up) >> 1
      else if (f === 4) { const p = a + up - ul, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : ul }
      px[y * stride + x] = v & 255
    }
  }
  const rgba = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    let r, g, b, a = 255
    if (ctype === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; a = px[i * 4 + 3] }
    else if (ctype === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2] }
    else if (ctype === 0) { r = g = b = px[i] }
    else if (ctype === 4) { r = g = b = px[i * 2]; a = px[i * 2 + 1] }
    else { const k = px[i]; r = plte[k * 3]; g = plte[k * 3 + 1]; b = plte[k * 3 + 2]; if (trns && k < trns.length) a = trns[k] }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a
  }
  return { w, h, rgba }
}

/** Collects accessors into one binary buffer, then writes the GLB. */
function makeWriter() {
  const chunks = [], views = [], accessors = []
  let size = 0
  const add = (bytes, target) => {
    const pad = (4 - (size % 4)) % 4
    if (pad) { chunks.push(Buffer.alloc(pad)); size += pad }
    views.push(Object.assign({ buffer: 0, byteOffset: size, byteLength: bytes.byteLength }, target ? { target } : {}))
    chunks.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)); size += bytes.byteLength
    return views.length - 1
  }
  /** `arr` is a typed array; `type` 'VEC3' etc.; extra: { normalized, target, minmax } */
  const accessor = (arr, type, extra = {}) => {
    const ct = { Float32Array: 5126, Uint16Array: 5123, Uint8Array: 5121, Uint32Array: 5125 }[arr.constructor.name]
    const n = COMP[type], a = { bufferView: add(arr, extra.target), componentType: ct, count: arr.length / n, type }
    if (extra.normalized) a.normalized = true
    if (extra.minmax) {
      const mn = new Array(n).fill(Infinity), mx = new Array(n).fill(-Infinity)
      for (let i = 0; i < arr.length; i++) { const k = i % n; if (arr[i] < mn[k]) mn[k] = arr[i]; if (arr[i] > mx[k]) mx[k] = arr[i] }
      a.min = mn; a.max = mx
    }
    accessors.push(a)
    return accessors.length - 1
  }
  const finish = (json) => {
    json.buffers = [{ byteLength: size + ((4 - (size % 4)) % 4) }]
    json.bufferViews = views
    json.accessors = accessors
    let j = Buffer.from(JSON.stringify(json), 'utf8')
    j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)])
    const bin = Buffer.concat([...chunks, Buffer.alloc((4 - (size % 4)) % 4)])
    const head = Buffer.alloc(12)
    head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + j.length + 8 + bin.length, 8)
    const h1 = Buffer.alloc(8); h1.writeUInt32LE(j.length, 0); h1.writeUInt32LE(0x4e4f534a, 4)
    const h2 = Buffer.alloc(8); h2.writeUInt32LE(bin.length, 0); h2.writeUInt32LE(0x004e4942, 4)
    return Buffer.concat([head, h1, j, h2, bin])
  }
  return { accessor, finish }
}

module.exports = { readGlb, readAccessor, imageBytes, decodePng, makeWriter }
