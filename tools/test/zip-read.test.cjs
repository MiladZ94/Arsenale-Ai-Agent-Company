/* Our own .zip reader (zip-read.cjs, spec 1.2 rule 29): it reads a plain
 * zip of a pack and refuses links, special files, encryption, odd
 * compression, lying sizes, zip bombs, overlapping entries, duplicate names,
 * bytes after the end and a damaged checksum. Invented data. Run: npm test */
const test = require('node:test')
const assert = require('node:assert/strict')
const { readZip } = require('../zip-read.cjs')
const { makeZip } = require('./pack-fixture.cjs')

const refused = (buf, re) => assert.throws(() => readZip(buf), (e) => { assert.equal(e.code, 400); assert.match(e.message, re); return true })

test('a stored and a deflated entry come back byte for byte, folders marked', () => {
  const out = readZip(makeZip([{ name: 'p/', data: '', method: 0 }, { name: 'p/pack.json', data: '{"a":1}', method: 0 }, { name: 'p/README.md', data: 'bread '.repeat(500) }]))
  assert.deepEqual(out.map((e) => [e.name, e.dir]), [['p/', true], ['p/pack.json', false], ['p/README.md', false]])
  assert.equal(out[1].data.toString(), '{"a":1}')
  assert.equal(out[2].data.toString(), 'bread '.repeat(500))
})

test('a Unix symlink, a device and a DOS reparse point are refused', () => {
  refused(makeZip([{ name: 'agents/x.md', data: '/etc/passwd', madeBy: 0x0314, ext: (0o120777 << 16) >>> 0 }]), /link or a special file/)
  refused(makeZip([{ name: 'agents/x.md', data: '', madeBy: 0x0314, ext: (0o020666 << 16) >>> 0 }]), /link or a special file/)
  refused(makeZip([{ name: 'agents/x.md', data: 'x', ext: 0x400 }]), /link or a special file/)
  // a plain Unix file is fine
  assert.equal(readZip(makeZip([{ name: 'a.md', data: 'x', madeBy: 0x0314, ext: (0o100644 << 16) >>> 0 }])).length, 1)
})

test('a zip bomb: a declared size that lies stops at the limit; a large declared size is refused before inflating', () => {
  // 2 MB of zeros deflate to a few KB; the entry claims 1 KB
  refused(makeZip([{ name: 'README.md', data: Buffer.alloc(2 * 1024 * 1024), usize: 1024 }]), /unpacks to more than it says/)
  // honest but too big: refused from the directory alone
  refused(makeZip([{ name: 'README.md', data: Buffer.alloc(70 * 1024) }]), /larger than 64 KB/)
  const many = Array.from({ length: 20 }, (_, i) => ({ name: 'f' + i + '.md', data: Buffer.alloc(60 * 1024) }))
  refused(makeZip(many), /unpacks to more than 1024 KB/)
})

test('too many entries, a duplicate name (also by case), a non-ASCII name are refused', () => {
  refused(makeZip(Array.from({ length: 201 }, (_, i) => ({ name: 'f' + i, data: '' }))), /more than 200 entries/)
  refused(makeZip([{ name: 'README.md', data: 'a' }, { name: 'readme.MD', data: 'b' }]), /twice/)
  refused(makeZip([{ name: 'agents/caf\xe9.md', data: 'a' }]), /not plain ASCII/)
})

test('encryption, an unknown method, a bad checksum, bytes after the end, overlap and junk are refused', () => {
  const enc = makeZip([{ name: 'a.md', data: 'x' }])
  // the flags of the central entry: offset of the directory + 8
  const cdOff = enc.readUInt32LE(enc.length - 6)
  const e1 = Buffer.from(enc); e1.writeUInt16LE(1, cdOff + 8); e1.writeUInt16LE(1, 6)
  refused(e1, /encrypted/)
  refused(makeZip([{ name: 'a.md', data: 'x', method: 12 }]), /compression/)
  refused(makeZip([{ name: 'a.md', data: 'hello', crc: 1234 }]), /checksum/)
  refused(Buffer.concat([makeZip([{ name: 'a.md', data: 'x' }]), Buffer.from('tail')]), /after the end|not a zip/)
  refused(Buffer.from('not a zip at all, just text'), /not a zip/)
  // two directory entries pointing at the same local entry
  const one = makeZip([{ name: 'a.md', data: 'x', method: 0 }, { name: 'b.md', data: 'y', method: 0 }])
  const off2 = one.readUInt32LE(one.length - 6)
  const second = off2 + 46 + 4 // past the first central entry (name "a.md")
  const o2 = Buffer.from(one); o2.writeUInt32LE(0, second + 42)
  refused(o2, /does not match the directory|overlap/)
})
