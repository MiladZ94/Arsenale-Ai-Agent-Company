# Autonomous runs: the essential rules

A short digest for the supervisor and every agent in an autonomous version run.
`arsenale init` installs it to `<data folder>/autonomous/RULES.md` (by default
`~/.arsenale/autonomous/RULES.md`). The longer rules live in `agents/AGENT-RULES.md`
section 10 and `agents/WORKFLOW.md` "Autonomous mode".

## The shape of a run

1. One interactive planning session, then the run goes on without the owner.
   The owner's own "start" message is the run authorisation.
2. Planning covers: specs, questions asked in batches of 5, mockups for new UI,
   a test baseline, a phase plan with a risk tier per phase, a token budget.
3. The state file `docs/specs/<version>-list.md` is the source of truth: requests,
   phases, decisions, owner gates, review log, token ledger. A resumed run needs
   nothing else. The mirror under `<data folder>/version-runs/` is what the
   dashboard reads; if they disagree, rewrite the mirror from the file.
4. `arsenale autonomous start|status|resume <version>` creates, reads and
   re-registers that file. `start` takes a version such as `1.2`, `1.2.3` or
   `1.2.3-beta.1`.

## Branches and merging

5. Every agent works in its own git worktree on `auto/<version>/<phase>/<request>`
   and commits only there, only because the run authorisation covers it.
6. The supervisor merges into `auto/<version>/integration`, never `main`, one
   branch at a time, smallest and most-depended-on first, and runs the full suite
   after each merge. A merge that breaks the suite is reverted with a new revert
   commit (no rewind) and goes back to its agent as a fix.
7. Nobody pushes, tags, rebases, changes git config or publishes. Those are owner
   actions.

## Gates after each phase

8. Order: `code-reviewer`, then `finding-verifier`, then a fix round, then the
   data, security, visual and performance gates where they apply.
9. Reviewers and the verifier read the diff, not the repo: the diff, the changed
   paths, the spec section and the builder's report. They read `REVIEW.md` first.
   Findings are labelled Important, Nit or Pre-existing, with id, `file:line`,
   claim and triggering input.
10. Only `confirmed` findings are fixed. The verifier never rejects a security
    finding on doubt alone: that is `unclear`, and `unclear` goes to the owner.
11. A fix for an Important finding includes a regression test that fails on the
    old code. Round 2 and 3 reviews get only the fix diff.
12. Three fix rounds at most per phase. After the third the supervisor records a
    "rethink" decision and starts one new set of three; if that fails too the phase
    is `blocked`, the owner is told, and independent phases carry on.
13. Slow suites run only when stored data changed. When skipped, the review log
    says "slow suite skipped, no stored data touched".
14. An incident found in the field becomes a test before it is fixed.

## Risk tiers

15. Low: ordinary code, one reviewer. Medium: more review and the normal suite.
    High (stored data, file format, crypto, IPC, permissions or roles, licence,
    restricted views, packaging, calculation code): two reviewers, the verifier,
    data-migration for stored data, security-reviewer for crypto/IPC/permissions,
    the slow suites, and heavy-tier fixes.
16. Use the heavy model tier only where it pays: specs, security, data and
    file-format work, calculations. Say why in the run log when a run is raised.
17. At most 3 heavy-tier runs at once, counted across every version run.
    `arsenale start` refuses a 4th (`"tier":"heavy"` in the JSON). Standard and
    light runs may run alongside.

## Owner gates: the only stops

18. Stop and ask for: a release (building an installer, signing, tagging,
    pushing, publishing), anything on the PROJECT.md "Owner gates (autonomous
    mode)" list, the budget at 100 %, a blocked phase, and any action that
    `check_action` marks `ask` or `never`. Never use a placeholder to get past one.
    Questions reach the owner through `arsenale gate`, answers come back through
    the dashboard (`arsenale answers`). An agent cannot answer a gate.
19. Budget: warning at 80 %. At 100 % no new agent starts; running agents finish
    their step, save their work on their branch and report. The supervisor then
    asks the owner.

## Logging and resuming

20. Start every agent run with `arsenale start`, tagged with `versionRun`,
    `phase` and, so a resume can judge it, the agent's `pid`. Add
    `"tier":"heavy"` for a heavy-tier run. Report steps with `arsenale progress`.
21. Tokens are summed per phase from those tags. A phase with no recorded tokens
    shows "not recorded", never 0.
22. After a restart, `arsenale autonomous resume <version>` closes runs of that
    version whose PID is gone as `stopped`. Never kill a process by name, only by
    a recorded PID. Then continue from the first phase that is not merged and gated.
23. Two runs may go at once on one machine. Branches, ledgers and gates carry
    their run id; one session never starts agents for the other run's repo.

## Safety

24. No real data, no secrets, no personal paths in anything written. Invented data
    only in tests and demos.
25. No throwaway executables, no self-copying launchers, no windows on the owner's
    screen: agents run apps headless. Windows cannot be held awake by Arsenale:
    the owner sets Settings > System > Power before an overnight run.
26. Prompts to agents are short and point to sections (repo, PROJECT.md, state-file
    section, run id, task); they do not paste them.
27. Evidence over claims: a real test line, a real build result, a screenshot that
    was opened. A step not run is "not run".

## The end

28. The final report states what was delivered, decisions taken, gates passed,
    findings and their fate, tokens used against the budget, what was not done,
    and the owner's next actions.

## Board actions from the command line

`"by":"board"` on the CLI is accepted only with the owner's launch key
(`ARSENALE_BOARD_TOKEN`, or `--board-token`). The supervisor never has it: it
acts as the supervisor, and board-only actions (budgets, approvals, gate
answers, the campus outside a live run) are the owner's, on the dashboard.
