# Version {{VERSION}}: {{APP}}

- App: {{APP}}
- Version: {{VERSION}}
- Version run id: {{RUN_ID}}
- Status: planning
- Integration branch: {{BRANCH}}
- Run authorisation: none yet (the owner's own message starts the run)
- Budget: {{BUDGET}} tokens (advisory; warn at 80 %, ask at 100 %)

## Request list

| Id | Request | Source |
|---|---|---|
| R1 | | |

## Phase plan

| Phase | Name | Requests | Tier and reason | Depends on | Status |
|---|---|---|---|---|---|
| P1 | | | | | planned |

## Decisions

| Id | Date | Who | Decision | Reason | Source | Status |
|---|---|---|---|---|---|---|
| D1 | | | | | | final |

## Open owner gates

None.

## Gates and packs

| Gate | Pack | Agent |
|---|---|---|
| review | `verification` | `code-reviewer` |
| finding check | `verification` | `finding-verifier` |
| visual | `verification` | `visual-qa` |
| data | `data-integrity` | `data-migration` |
| security | `security` | `security-reviewer` |
| release | `release` | `release-manager`, `release-builder` |

The core team pack (`core-team`) holds every one of these agents; the packs add the office and helpers for the gate.

## Review log

One line per gate run: date, phase, reviewer, report path, result.

## Token ledger

| Phase | Estimate | Used |
|---|---|---|
| P1 | | not recorded |
