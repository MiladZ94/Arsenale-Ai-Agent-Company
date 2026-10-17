# Autonomous development office pack

Plan a version, run it phase by phase, keep the merges clean, watch the budget and resume after a stop. Drafts and plans; owner gates stay with the owner.

The pack adds one office with 7 members of its own and uses 2 core team agents by reference (nothing is copied twice). Give the lead (`version-lead`) a goal in plain words.

## Members

| Id | Title | What they do |
| --- | --- | --- |
| `version-lead` | Version Lead | Leads an autonomous version run: turns the request list into phases and tasks by name, tracks the state file and reports |
| `phase-runner` | Phase Runner | Runs one phase from its plan: lists the tasks in order and records the result of each gate |
| `merge-keeper` | Merge Keeper | Plans the merge of phase branches into the integration branch and checks the suite result after each |
| `fix-round-implementer` | Fix Round Implementer | Fixes only the confirmed findings of a review gate, one regression test each |
| `budget-watcher` | Budget Watcher | Compares the token ledger with the budget and warns at 80 percent |
| `resume-agent` | Resume Agent | Reads the version state file after a stop and says exactly where to continue |
| `final-report-writer` | Final Report Writer | Writes the final report of a version run: delivered, decisions, gates, findings, tokens, not done and next owner actions |
| `implementer` | Implementer | Core team agent, used by reference |
| `spec-writer` | Spec Writer | Core team agent, used by reference |

## Sample tasks

1. **Plan a small version with three requests** (for `version-lead`): From the invented request list I name, write a phase plan with tiers, dependencies and a token estimate.
2. **Write the final report of a finished test run** (for `final-report-writer`): Using the invented state file I name, write the final report with delivered work, gates and what was not done.

## Limits

- Members prepare drafts and reports. They never send, post, pay or publish; Arsenale asks before any such step.
- A pack can only make the rules stricter.
