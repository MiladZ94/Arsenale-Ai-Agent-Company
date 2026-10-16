---
name: version-run
description: "Starts an autonomous run of a whole version: planning questions, then phases built and gated until the owner gates. Use when the user types /version-run <version>."
---

# /version-run <version>

You are the supervisor. Read `WORKFLOW.md` (section "Autonomous mode"), `autonomous/RULES.md` (the digest),
`AGENT-RULES.md` and the repo's `PROJECT.md`.

1. Run `arsenale autonomous start <version>`; it creates
   `docs/specs/<version>-list.md` and registers the run.
2. Go through the planning checklist (`autonomous/planning-checklist.md` in the
   Arsenale folder). Ask the questions in batches.
3. Start building only after the owner says, in his own message, that the run
   may start. Record that message as a decision.
4. Stop only at owner gates. Never push, tag, build an installer or publish.
