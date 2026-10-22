/* An invented local office pack ("Bakery Desk") and a small zip writer for
 * the local-pack tests. The zip writer can also write the broken and hostile
 * zips the reader must refuse. All names and text are invented. */
const zlib = require('zlib')
const { crc32 } = require('../zip-read.cjs')

const SAFETY = '## Safety: prepare, do not act\n\n- Prepare drafts; do not act. Never send, post, publish, pay, order, sign, delete or share anything outside this computer yourself.\n'

function member(id, title, extra) {
  const x = Object.assign({ tools: 'Read, Glob, Grep, Write', body: '' }, extra || {})
  const lines = ['---', 'name: ' + id, 'description: "' + title + ' of the invented Bakery Desk."', 'model: sonnet', 'effort: medium']
  if (x.tools !== null) lines.push('tools: ' + x.tools)
  lines.push('color: orange', 'zone: build', '---', '', 'You are the ' + title + ' of this company\'s Bakery Desk.', '', 'Follow `AGENT-RULES.md` (the house rules in the same folder as this file).', '', '## What you do', '', '- Draft weekly bread menus.', x.body, '', SAFETY)
  return lines.join('\n')
}

/** The pack as { path: text }. `opts.id`, `opts.version`, `opts.mutate(pack.json)`. */
function bakeryPack(opts) {
  const o = opts || {}
  const pj = {
    format: 'arsenale-pack', formatVersion: 1, id: o.id || 'demo-bakery-pack', version: o.version || '1.0.0',
    name: 'Bakery Desk', description: 'An invented office that plans bread menus.', minArsenale: '1.0.0',
    office: { id: o.office || 'bakery-desk', name: 'Bakery Desk', theme: 'amber', profile: 'ops', lead: 'bakery-lead' },
    members: [
      { file: 'agents/bakery-lead.md', id: 'bakery-lead', zone: 'lead', title: 'Bakery Lead', tier: 'standard' },
      { file: 'agents/bread-writer.md', id: 'bread-writer', zone: 'build', title: 'Bread Writer', tier: 'light' },
    ],
    sampleTasks: [
      { title: 'Plan a week of bread', description: 'Draft a menu for an invented bakery.', assignee: 'bakery-lead' },
      { title: 'Write a rye note', description: 'A short invented note.', assignee: 'bread-writer' },
    ],
    policy: { members: { 'bread-writer': { payment: 'never' } } },
  }
  if (o.mutate) o.mutate(pj)
  return Object.assign({
    'pack.json': JSON.stringify(pj, null, 2),
    'labels.json': JSON.stringify({ 'bakery-lead': { dept: 'lead' }, 'bread-writer': { dept: 'build' } }),
    'README.md': '# Bakery Desk\n\nAn invented office.\n',
    'agents/bakery-lead.md': member('bakery-lead', 'Bakery Lead', o.lead),
    'agents/bread-writer.md': member('bread-writer', 'Bread Writer', o.writer),
  }, o.files || {})
}

/** The page's upload body for a folder: paths under one top folder, base64. */
function folderBody(files, top) {
  return { op: 'stage', files: Object.entries(files).map(([p, t]) => ({ path: (top === undefined ? 'demo-bakery-pack/' : top) + p, data: Buffer.from(t).toString('base64') })) }
}

/** A zip of [{ name, data, method, madeBy, ext, usize, crc }]. */
function makeZip(entries) {
  const locals = [], centrals = []
  let off = 0
  for (const e of entries) {
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data || '')
    const method = e.method === undefined ? 8 : e.method
    const packed = method === 8 ? zlib.deflateRawSync(data) : data
    const name = Buffer.from(e.name, 'latin1')
    const crc = e.crc === undefined ? crc32(data) : e.crc
    const usize = e.usize === undefined ? data.length : e.usize
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(method, 8)
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(packed.length, 18); lh.writeUInt32LE(usize, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28)
    locals.push(lh, name, packed)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(e.madeBy === undefined ? 20 : e.madeBy, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(method, 10)
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(packed.length, 20); ch.writeUInt32LE(usize, 24); ch.writeUInt16LE(name.length, 28)
    ch.writeUInt32LE((e.ext || 0) >>> 0, 38); ch.writeUInt32LE(off, 42)
    centrals.push(ch, name)
    off += 30 + name.length + packed.length
  }
  const cd = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16)
  return Buffer.concat([...locals, cd, end])
}
const zipOf = (files, top) => makeZip(Object.entries(files).map(([p, t]) => ({ name: (top === undefined ? 'demo-bakery-pack/' : top) + p, data: t })))
const zipBody = (buf) => ({ op: 'stage', zip: buf.toString('base64') })

module.exports = { bakeryPack, member, folderBody, makeZip, zipOf, zipBody }
