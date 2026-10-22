/* Invented version runs for the Version run page tests and screenshots: two
 * runs of two apps, with run-log tokens, running agents, owner gates and
 * decisions. Not a test file (run.cjs only takes *.test.cjs). */
const fs = require('fs')
const path = require('path')

const PHASES_X = [
  { id: 'P1', name: 'Storage layer', tier: 'high', requests: ['R1', 'R2'], percent: 100, status: 'merged' },
  { id: 'P2', name: 'Sync engine', tier: 'high', requests: ['R3', 'R4', 'R5'], percent: 66, status: 'gating round 2 of 3' },
  { id: 'P3', name: 'Settings page', tier: 'low', requests: ['R6'], percent: 40, status: 'building' },
]
const PHASES_Y = [
  { id: 'P1', name: 'Data model', tier: 'high', requests: ['R1'], percent: 100, status: 'merged' },
  { id: 'P2', name: 'Reports tab', tier: 'low', requests: ['R2'], percent: 0, status: 'blocked' },
]

const put = (dir, name, rec) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(rec, null, 2)) }

/** opts.only: 'x' for one run; opts.xTokens: tokens of run X per phase (default 1.66M of 2M). */
function seed(sb, opts = {}) {
  const o = Object.assign({ xTokens: [412000, 800000, 448000], only: '' }, opts)
  const ver = (rec) => { const r = sb.cli('--version-run', JSON.stringify(rec)); if (r.code !== 0) throw new Error(r.err) }
  ver({ id: 'app-x-1.2', app: 'app X', version: '1.2', status: 'running', budget: 2000000, integrationBranch: 'auto/1.2/integration', phases: PHASES_X })
  o.xTokens.forEach((t, i) => sb.run({ agent: 'implementer', task: 'x ' + i, versionRun: 'app-x-1.2', phase: 'P' + (i + 1), tokens: t }))
  if (o.only !== 'x') {
    ver({ id: 'app-y-0.9', app: 'app Y', version: '0.9', status: 'waiting for owner', budget: 1000000, integrationBranch: 'auto/0.9/integration', phases: PHASES_Y })
    sb.run({ agent: 'implementer', task: 'y 1', versionRun: 'app-y-0.9', phase: 'P1', tokens: 410000 })
  }
  const now = Date.now()
  const iso = (ago) => new Date(now - ago * 60000).toISOString()
  const active = (id, agent, run, phase, model, doing, ago) => put(path.join(sb.runs, 'active'), id, { id, agent, task: doing, startedAt: iso(ago), versionRun: run, phase, model, doing })
  // two runs of ONE agent in one version: two rows
  active('a1', 'implementer', 'app-x-1.2', 'P2', 'sonnet', 'fix R-14: retry cap', 4)
  active('a2', 'implementer', 'app-x-1.2', 'P3', 'sonnet', 'write tests for R-21', 9)
  if (o.only !== 'x') active('a3', 'reviewer', 'app-y-0.9', 'P1', 'opus', 'round 1, 1 of 4 done', 2)
  const gate = (id, run, label, question, choices, ago) => put(path.join(sb.runs, 'gates'), id, { id, project: '', kind: 'C', label, question, choices, status: 'waiting', askedBy: 'supervisor', askedAt: iso(ago), versionRun: run, history: [] })
  gate('g1', 'app-x-1.2', 'Budget', 'Used 83 % of 2.0M. Continue to 100 %?', ['Continue', 'Raise', 'Stop'], 41)
  if (o.only !== 'x') gate('g2', 'app-y-0.9', 'Blocked phase', 'Reports tab needs the v2 schema. Skip or wait?', ['Skip', 'Wait'], 18)
  const dec = (id, run, by, text, reason, ago) => put(path.join(sb.runs, 'decisions'), id, { id, project: '', run, by, text, reason, state: 'taken', at: iso(ago) })
  dec('d1', 'app-x-1.2', 'supervisor', 'Split Sync engine into 2 requests', 'Over 400 lines', 120)
  dec('d2', 'app-x-1.2', 'agent', 'Retry capped at 5 min', 'Spec left it open', 60)
  dec('d3', 'app-x-1.2', 'user', 'Attachments wait for 1.3', 'Keeps release small', 30)
}

module.exports = { seed, PHASES_X, PHASES_Y }
