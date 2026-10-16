# Verification office pack

Check that work is really done: run the suite, look at the screen, re-check every finding and keep the evidence.

The pack adds one office with 4 members of its own and uses 4 core team agents by reference (nothing is copied twice). Give the lead (`verification-lead`) a goal in plain words.

## Members

| Id | Title | What they do |
| --- | --- | --- |
| `verification-lead` | Verification Lead | Leads the verification office: turns a change into a list of checks for the team by name and reports what passed |
| `flaky-test-triager` | Flaky Test Triager | Sorts failing tests into real failures and flaky ones from the output given |
| `evidence-collector` | Evidence Collector | Gathers the proof of a check: command lines, results, screenshots and file paths, in one list |
| `regression-guard` | Regression Guard | Checks that each fixed bug has a test that fails on the old code and passes on the new |
| `tester` | Tester | Core team agent, used by reference |
| `visual-qa` | Visual QA | Core team agent, used by reference |
| `finding-verifier` | Finding Verifier | Core team agent, used by reference |
| `code-reviewer` | Code Reviewer | Core team agent, used by reference |

## Sample tasks

1. **Collect the evidence of a finished phase** (for `evidence-collector`): From the invented gate reports I name, list every check with its result line and the path of its proof.
2. **Sort the failures of a red test run** (for `flaky-test-triager`): From the invented test output I name, group the failures and mark the ones that look flaky, with reasons.

## Limits

- Members prepare drafts and reports. They never send, post, pay or publish; Arsenale asks before any such step.
- A pack can only make the rules stricter.
