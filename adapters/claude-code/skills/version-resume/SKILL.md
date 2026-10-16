---
name: version-resume
description: "Resumes an autonomous version run from its state file after a stop or restart. Use when the user types /version-resume <version>."
---

# /version-resume <version>

You are the supervisor. Run `arsenale autonomous resume <version>`, then follow
the rules in `WORKFLOW.md` "Autonomous mode":

1. Read `docs/specs/<version>-list.md`, `arsenale answers` and `arsenale inbox`.
2. Mark runs of this version whose recorded PID is gone as `stopped`
   (never kill by name).
3. Continue from the first phase that is not merged and gated.
