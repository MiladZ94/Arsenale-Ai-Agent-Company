/* An engineering office with 8 figures working (the implementer twice), one
 * waiting and 6 idle: the scene the office layout tests (and a look by hand)
 * use. All of it invented. */
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { makeSandbox } = require('./helpers.cjs')

const PEOPLE = [
  ['planner', 'Planner', 'lead'], ['architect', 'Architect', 'lead'], ['implementer', 'Implementer', 'build'], ['refactorer', 'Refactorer', 'build'],
  ['tester', 'Tester', 'review'], ['reviewer', 'Reviewer', 'review'], ['releaser', 'Releaser', 'docs'],
  // idle all day
  ['writer', 'Technical writer', 'docs'], ['designer', 'Designer', 'design'], ['analyst', 'Data analyst', 'build'],
  ['auditor', 'Auditor', 'review'], ['scribe', 'Scribe', 'docs'], ['helper', 'Helper', 'guest'],
]
const WORKING = [
  ['planner', 'Drafting spec 2/4'], ['architect', 'Reading schema'], ['implementer', 'Parser 5/9'], ['implementer', 'Writing tests 2/6'],
  ['refactorer', 'Splitting module'], ['tester', 'Running 128 cases'], ['reviewer', 'Reading the diff'], ['releaser', 'Building the installer'],
]

function scenario(opts = {}) {
  const sb = makeSandbox(opts)
  // only these people: the sandbox's own six are removed
  for (const f of fs.readdirSync(sb.agents)) if (f !== 'AGENT-RULES.md') fs.unlinkSync(path.join(sb.agents, f))
  // a person without a definition file is "retired": every one of them has a file
  for (const [id, title] of PEOPLE) fs.writeFileSync(path.join(sb.agents, id + '.md'), ['---', 'name: ' + id, 'description: ' + title + ' (invented)', 'model: sonnet', 'effort: medium', 'tools: Read', '---', 'Invented test agent.', ''].join(String.fromCharCode(10)))
  const employees = {}
  for (const [id, title, zone] of PEOPLE) employees[id] = { homeOfficeId: 'engineering', title, zone }
  const seed = {
    company: { name: 'Northwind Labs', issuePrefix: 'NW' },
    offices: [
      { id: 'engineering', name: 'Engineering', leadEmployeeId: '', profile: 'engineering', theme: 'blue' },
      { id: 'docs', name: 'Docs', leadEmployeeId: '', profile: 'docs', theme: 'amber' },
      { id: 'hq', name: 'Headquarters', leadEmployeeId: 'supervisor', profile: 'operations', theme: 'coral' },
    ],
    projects: [{ id: 'ledger', name: 'Ledger', key: 'LEDG', officeId: 'engineering', aliases: ['ledger'] }],
    employees,
  }
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(seed)).code, 0)
  sb.cli('--heartbeat')
  for (const [agent, doing] of WORKING) {
    const r = sb.cli('--start', JSON.stringify({ agent, task: doing, project: 'ledger', model: 'sonnet', doing }))
    assert.equal(r.code, 0, r.err)
  }
  return sb
}

module.exports = { scenario, PEOPLE, WORKING }
