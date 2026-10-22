/* A small reader for the .zip of an office pack (spec 1.2, rule 29 and Q4 b).
 *
 * Our own code on purpose: no dependency and no native unzip, so nothing on
 * this computer is run to open a stranger's file. Node's zlib inflates; that
 * is all it does. The bytes are untrusted, so the reader is strict and stops
 * at the first thing it does not expect:
 *   - one disk, no ZIP64, no encryption, only stored (0) or deflated (8);
 *   - the central directory is the truth, and every local header must agree
 *     with it (name, method), so two readers cannot see two different files;
 *   - names are printable ASCII (the pack's paths are ASCII anyway);
 *   - a link, a device or any entry that is not a plain file or folder is
 *     refused, from the Unix mode and from the DOS reparse-point bit;
 *   - sizes are checked from the central directory BEFORE anything is
 *     inflated, and again while inflating, because a declared size can lie
 *     (a zip bomb stops at the limit); entries may not overlap; the CRC must
 *     match;
 *   - no duplicate names (also not by case: Windows would merge them).
 *
 * Paths are not judged here beyond that: pack-local.cjs checks every name
 * against the pack's path rule, the same way for a zip and for a folder.
 */
const zlib = require('zlib')
const { fail } = require('./runlog.cjs')

const LIMITS = { entries: 200, file: 64 * 1024, total: 1024 * 1024 }
const S_IFMT = 0o170000, S_IFREG = 0o100000, S_IFDIR = 0o040000
const DOS_REPARSE = 0x400

let TABLE = null
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256)
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c }
  }
  let c = -1
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

const bad = (why) => fail(400, 'This .zip cannot be read: ' + why)

/** The entries of a zip: [{ name, dir, data }]. Throws a 400 with the reason. */
function readZip(buf, limits) {
  const L = Object.assign({}, LIMITS, limits || {})
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw bad('not a zip file')
  // the end record: the last 22 bytes plus at most a 64 KB comment
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw bad('not a zip file')
  const disk = buf.readUInt16LE(eocd + 4), cdDisk = buf.readUInt16LE(eocd + 6)
  const onDisk = buf.readUInt16LE(eocd + 8), count = buf.readUInt16LE(eocd + 10)
  const cdSize = buf.readUInt32LE(eocd + 12), cdOff = buf.readUInt32LE(eocd + 16), commentLen = buf.readUInt16LE(eocd + 20)
  if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) throw bad('ZIP64 is not supported')
  if (disk !== 0 || cdDisk !== 0 || onDisk !== count) throw bad('a zip split over several files')
  // the comment must end the file: bytes after it would be a second, hidden zip
  if (eocd + 22 + commentLen !== buf.length) throw bad('unexpected bytes after the end of the zip')
  if (count > L.entries) throw bad('more than ' + L.entries + ' entries')
  if (cdOff + cdSize > eocd) throw bad('the directory is outside the file')

  const list = []
  let p = cdOff
  for (let n = 0; n < count; n++) {
    if (p + 46 > cdOff + cdSize || buf.readUInt32LE(p) !== 0x02014b50) throw bad('a damaged directory')
    const madeBy = buf.readUInt16LE(p + 4), flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10)
    const crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), cmtLen = buf.readUInt16LE(p + 32)
    const diskStart = buf.readUInt16LE(p + 34), ext = buf.readUInt32LE(p + 38), lho = buf.readUInt32LE(p + 42)
    const end = p + 46 + nameLen + extraLen + cmtLen
    if (end > cdOff + cdSize) throw bad('a damaged directory')
    const raw = buf.subarray(p + 46, p + 46 + nameLen)
    p = end
    if (!raw.length || raw.some((b) => b < 0x20 || b > 0x7e)) throw bad('an entry name that is not plain ASCII')
    const name = raw.toString('latin1')
    if (csize === 0xffffffff || usize === 0xffffffff || lho === 0xffffffff) throw bad('ZIP64 is not supported')
    if (diskStart !== 0) throw bad('a zip split over several files')
    if (flags & 0x41) throw bad(name + ' is encrypted')
    if (method !== 0 && method !== 8) throw bad(name + ' uses a compression this reader does not take')
    // Unix hosts keep the file type in the high half: only a plain file or a folder
    if (madeBy >> 8 === 3) {
      const type = (ext >>> 16) & S_IFMT
      if (type !== 0 && type !== S_IFREG && type !== S_IFDIR) throw bad(name + ' is a link or a special file')
    }
    if (ext & DOS_REPARSE) throw bad(name + ' is a link or a special file')
    const dir = name.endsWith('/')
    if (dir && usize !== 0) throw bad(name + ' is a folder with content')
    if (usize > L.file) throw bad(name + ' is larger than ' + Math.round(L.file / 1024) + ' KB')
    if (method === 0 && csize !== usize) throw bad(name + ' has two different sizes')
    list.push({ name, dir, method, crc, csize, usize, lho })
  }
  if (p !== cdOff + cdSize) throw bad('a damaged directory')

  const seen = new Set()
  let total = 0
  for (const e of list) {
    const key = e.name.toLowerCase()
    if (seen.has(key)) throw bad('the name ' + e.name + ' is in it twice')
    seen.add(key)
    total += e.usize
  }
  // before a single byte is inflated
  if (total > L.total) throw bad('it unpacks to more than ' + Math.round(L.total / 1024) + ' KB')

  // each entry's local header and data, which must lie before the directory and never overlap
  const spans = []
  for (const e of list) {
    if (e.lho + 30 > cdOff || buf.readUInt32LE(e.lho) !== 0x04034b50) throw bad('a damaged entry: ' + e.name)
    const lflags = buf.readUInt16LE(e.lho + 6), lmethod = buf.readUInt16LE(e.lho + 8)
    const lnameLen = buf.readUInt16LE(e.lho + 26), lextraLen = buf.readUInt16LE(e.lho + 28)
    const lname = buf.subarray(e.lho + 30, e.lho + 30 + lnameLen).toString('latin1')
    if (lname !== e.name || lmethod !== e.method || (lflags & 0x41)) throw bad('the entry ' + e.name + ' does not match the directory')
    e.start = e.lho + 30 + lnameLen + lextraLen
    if (e.start + e.csize > cdOff) throw bad('a damaged entry: ' + e.name)
    spans.push([e.lho, e.start + e.csize])
  }
  spans.sort((a, b) => a[0] - b[0])
  for (let i = 1; i < spans.length; i++) if (spans[i][0] < spans[i - 1][1]) throw bad('entries overlap')

  const out = []
  let inflated = 0
  for (const e of list) {
    const packed = buf.subarray(e.start, e.start + e.csize)
    let data
    if (e.method === 0) data = Buffer.from(packed)
    else {
      // a declared size that lies is caught here: zlib stops at the limit
      try { data = zlib.inflateRawSync(packed, { maxOutputLength: Math.max(1, e.usize) }) } catch { throw bad(e.name + ' unpacks to more than it says, or is damaged') }
    }
    if (data.length !== e.usize) throw bad(e.name + ' unpacks to more than it says, or is damaged')
    if (crc32(data) !== e.crc) throw bad(e.name + ' is damaged (checksum)')
    inflated += data.length
    if (inflated > L.total) throw bad('it unpacks to more than ' + Math.round(L.total / 1024) + ' KB')
    out.push({ name: e.name, dir: e.dir, data })
  }
  return out
}

module.exports = { readZip, crc32, LIMITS }
