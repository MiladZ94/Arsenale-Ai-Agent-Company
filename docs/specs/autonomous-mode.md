# Spec: Autonomous mode (autonomous version development)

Status: draft for Gate A. Nothing here is built. Open questions are at the end
(section 12) and block the steps named there.

Examples use invented names only ("app X", version "1.2", "feature A").

Sources read for this spec: `README.md`, `agents/WORKFLOW.md`,
`agents/AGENT-RULES.md`, the agent definitions in `agents/` (checked in detail:
`code-reviewer.md`, `data-migration.md`), `adapters/claude-code/skills/feature/SKILL.md`,
`tools/` (the list of files; `runlog.cjs` exports; the routes of
`agent-dashboard-server.cjs`). The review practice below is taken from the
owner's notes on `claude.dev/blog/solving-code-review-at-anthropic`; the author
of this spec did not re-fetch the article, so its wording must be checked
against the article before it is quoted in public docs.

---

## 1. Goal

Today the development cycle (`WORKFLOW.md`, ten stages, three gates) asks the
owner for input at many points: every feature stops at Gate A, Gate B and
Gate C. For a whole version (for example "app X 1.2", twelve requests) the
owner is pulled in again and again, and the supervisor re-reads long history
each time. **Autonomous mode** lets a supervisor run a whole version after ONE
planning session: it collects the request list, asks every open question in
batches, records the answers and every later decision of its own in one
version state file, then builds the version in dependency-ordered phases with
parallel agents in separate git worktrees, runs layered review gates after each
phase, and stops only at the owner gates: building or publishing a release, and
domain numbers or formulas. The owner reviews once at the end, with a report of
all decisions. The run may last several days and survives restarts. Token cost
is a hard requirement: a budget is estimated up front, 80 % warns, 100 % stops
and asks.

Arsenale stays what the README says it is: it **watches** and never runs
agents. The supervisor (the user's coding tool) does the running; Arsenale
supplies the rules, the new agent, the skills and a "Version run" page.

## 2. Out of scope

- Arsenale does not start, stop or schedule agents or sessions, and its server
  never starts a process (README "What it is"). The supervisor does.
- No automatic building, signing, tagging, pushing or publishing of a release.
  Not even as an option in this version.
- No automatic decision on domain numbers, formulas, constants or defaults.
- No change to Gate A, Gate B or Gate C for ordinary `/feature` and `/fix`
  runs. Autonomous mode is a separate, explicit mode.
- No cloud service, no telemetry, no new network call.
- No automatic merge to `main`, and no pull request opened without the owner.
- Cost in USD is shown only when `model-prices.json` is filled in, as today;
  otherwise "n/a", never 0.
- No new design of the existing screens; only the new "Version run" page.
  Its visual direction goes to `ui-designer` (Gate B applies to that page).

## 3. User stories

1. As the owner, I want one planning session in which every open question of a
   version is asked in batches, so that I am not interrupted again until the
   release gate.
2. As the owner, I want every answer and every decision the supervisor takes
   later in one file with ids (D1, D2 ...), so that I can audit the version and
   overrule a decision.
3. As the owner, I want the run to stop by itself before a release build or a
   change to engineering numbers, so that I keep control of the two things that
   cannot be undone or checked by tests.
4. As the owner, I want review findings that were checked against the code, so
   that I do not read false alarms.
5. As the owner, I want a token budget per version with a warning at 80 % and
   a stop at 100 %, so that a run cannot burn my allowance unnoticed.
6. As the owner, I want to watch phases, agents, decisions, open gates, review
   reports and the budget on one dashboard page and in the chat.
7. As the owner, I want a run to continue overnight and across days, and to
   resume after a restart with one command, so that I do not babysit it.
8. As a maintainer of a repo, I want a `REVIEW.md` that says what "broken"
   means in my repo, so that reviewers judge against my rules.
9. As a maintainer, I want a problem that slipped through once to become a test
   or a rule, so that it cannot slip through twice.
10. As a user of another coding tool, I want the same rules written so that any
    supervisor can follow them, with Claude Code getting skills as shortcuts.

## 4. The run, step by step (overview)

1. **Planning session** (the only interactive part).
2. **Authorisation**: the owner says "start the run" (rule 3).
3. **Phases**: for each phase, build in parallel worktrees, merge one by one,
   run gates, fix rounds.
4. **Owner gates**: stop, ask, wait.
5. **Final report** and hand-over for the release gate.

## 5. Rules

### 5.1 Planning

1. A run starts with `/version-run <app> <version>` (Claude Code skill) or "run
   the autonomous cycle in WORKFLOW.md" in another tool. The supervisor reads
   `WORKFLOW.md`, `AGENT-RULES.md` and the repo's `PROJECT.md` first.
2. The supervisor collects the request list (owner's messages, issues, a
   `feature-scout` backlog if asked) and writes it to the version state file
   (rule 6). Each request gets an id R1, R2 ...
3. For every request, `spec-writer` runs (heavy tier) in the planning session
   and its open questions are merged into **numbered batches**. The supervisor
   asks one batch at a time in the user's language, each question with its
   options and recommended default, and waits. It runs `arsenale answers`
   before asking again. Answers become decisions (rule 7). "Use your defaults"
   is recorded as one decision per question, not as a blanket.
4. Planning ends only when (a) no question is open, (b) the phase plan, the
   risk tier of each phase and the **token budget estimate** (rule 40) are
   shown to the owner, and (c) the owner has said, in his own message, that the
   run may start. That message is recorded as a decision and is the
   **run authorisation**. Its scope is exactly: agents commit on their own
   branches, the supervisor merges them into the version's integration branch
   (rule 22), nothing else. It is never an authorisation to push, tag, build
   an installer or publish.
5. New UI in the version still needs mockups (Gate B). The supervisor collects
   all of them during planning: `ui-designer` runs for every UI request, the
   owner picks in one sitting. Work that needs a mockup that was not chosen is
   not started.

### 5.2 The version state file

6. There is **one** state file per version, in the project repo:
   `docs/specs/<version>-list.md` (for example `docs/specs/1.2-list.md`). The
   folder is the specs folder named in PROJECT.md "Docs"; the file name is the
   default. It holds, in this order: header (app, version, status, integration
   branch, run authorisation id, budget), the request list, the phase plan,
   the **decisions** (D1 ...), the open owner gates, the review log (one line
   per gate run with the report path), and the token ledger per phase.
7. Every decision has an id, the date, who decided (`owner` or `supervisor` or
   an agent name), the text, the reason, the source (question number or
   finding id) and `status` (`final`, `reversible`, `overruled`). A decision the
   supervisor takes on its own is also logged with `arsenale decision` so that
   it shows in the decision timeline. A decision is never deleted; the owner
   overrules by a new decision that references the old id.
8. The state file is the **only** memory a resumed supervisor needs, together
   with the run log. Agent prompts point to it ("Read section P2 of
   `docs/specs/1.2-list.md`") instead of pasting it (rule 42).
9. The supervisor updates the file at every phase change, every decision and
   every gate result, and before any pause. A write is a full file write of the
   changed section; an interrupted write must not corrupt the file (write a
   temporary file next to it and rename it).
10. The file contains no secret, no real personal data and no real project or
    customer name (AGENT-RULES rule 2). The final report is built from this
    file.

### 5.3 Phases and parallel work

11. The supervisor splits the requests into phases ordered by dependency:
    a phase starts only when everything it depends on is merged and passed its
    gates. Dependencies are written in the state file (P2 depends on P1).
    Typical order: data and format changes first, then logic, then UI, then
    docs.
12. Inside a phase, work that touches different files runs in parallel, one
    agent per **git worktree** and one **branch** per agent, named
    `auto/<version>/<phase>/<request>` (for example `auto/1.2/p2/r5`). Two
    agents never edit the same file at once (existing rule); if two requests
    need the same file, they are in different phases or the same agent.
13. Worktrees live in the scratchpad or another folder outside the repo tree.
    They hold only tracked files. The supervisor removes each worktree after
    its merge and records the PIDs of any process it started (rule 30).
14. An agent commits **only on its own branch**, and only after the run
    authorisation. It never pushes, merges, tags, rebases or changes git
    config. The existing "never rewind the tree" rule holds.
15. **Merge one by one.** The supervisor merges branches into the integration
    branch in a fixed order (smallest, most-depended-on first). After **each**
    merge it runs the full test suite (PROJECT.md "test" command). A merge that
    breaks the suite is reverted on the integration branch by a new revert
    commit (not a rewind), and the request goes back to its agent as a fix.
    The suite is the full one for merges; the slow or compatibility suites
    follow rule 44.
16. Heavy-tier agents in parallel: at most two or three (AGENT-RULES section 9
    rule 7). Standard and light runs may run alongside.

### 5.4 Gates after each phase

17. After a phase is merged, the gates run in this order, each only if its
    trigger applies (risk tier, rule 25):
    1. **Code review** (always): `code-reviewer`, plus a second reviewer on the
       high tier (rule 21).
    2. **finding-verifier** (always when there are findings): rule 19.
    3. **Fix round** by the same implementer (existing follow-up rule).
    4. **data-migration** when anything stored changed (file format, fields,
       identity keys, envelope, local storage, settings, import/export).
    5. **security-reviewer** when crypto, IPC, permissions, roles, licence,
       restricted views or packaging changed.
    6. **visual-qa** when anything visible changed, against the chosen mockup.
    7. **performance** when the change scales with data or speed was the
       complaint.
    8. **domain-validator** is NOT run to decide anything: when a result could
       have changed, the run reaches an owner gate (rule 33).
18. A failure at any gate goes back to the implementer as a finding (WORKFLOW
    "Loops"), then that gate runs again on the **new diff only** after round 1.
19. **finding-verifier** (new agent, draft in section 9). It receives the list
    of findings from all reviewers of the gate and, for each one, re-checks it
    against the code: is the cited line real, does the input produce the wrong
    result, is it already handled elsewhere, is it introduced by this diff. It
    returns, per finding, `confirmed`, `rejected` (with the reason in one line)
    or `unclear`. Only `confirmed` findings go to the fix round. `unclear`
    findings go to the supervisor, who may escalate them to a heavier verifier
    (rule 20) or record a decision. Rejected findings are listed in the review
    log with their reason; they are not silently dropped.
20. Findings tagged data, security, crypto, permissions or file-format are
    verified at the **standard** tier at least, and a rejected finding in those
    areas is re-checked by the heavy tier before it is final. Cheap verification
    is for ordinary findings only.
21. Two reviewers on the high tier: `code-reviewer` and a second
    `code-reviewer` run with a different brief (for example "hunt for data
    loss and wrong error handling" against "hunt for logic and edge cases"), in
    parallel, reading the same diff. Medium tier uses one reviewer. Low tier
    uses one reviewer at the light or standard tier.
22. Merges go to an **integration branch** `auto/<version>/integration`, created
    from the branch PROJECT.md names as the base. The run never changes `main`
    or any branch the owner works on. The owner merges the integration branch
    himself, or says so at the release gate.
23. **Evidence over claims.** A phase or a fix is "done" only with evidence in
    the report: the test command and its real result, the build result, a
    screenshot that was opened and looked at (AGENT-RULES rule 6), a fixture
    run for migrations. A claim without evidence ("should work") is a finding.
24. **Severity.** Every finding is labelled **Important** (must fix before the
    phase is accepted: data loss, security hole, wrong result, crash, a broken
    spec rule), **Nit** (worth fixing, does not block) or **Pre-existing**
    (present before this diff; recorded, not fixed unless the owner asked).
    Important findings are fixed in the fix round. Nits are fixed in the same
    round only when cheap; otherwise they are listed in the final report.
    Pre-existing findings are never fixed silently; they go to the final report
    and, if serious, are proposed as requests for the next version.

### 5.5 Risk tiers

25. The supervisor sets a **risk tier per phase** from what the diff touches
    and writes it in the state file with the reason. The tier decides the gates
    (table). The tier of a phase can only be raised, never lowered, while the
    run is going; a reviewer or the supervisor raises it when the diff turns out
    to touch more.

| Tier | Typical change | Gates that run |
|---|---|---|
| Low | text, docs, comments, tests only, styling inside one component | one reviewer (light or standard), finding-verifier if any finding, visual-qa if visible |
| Medium | ordinary feature or fix, no stored data and no permissions touched | `code-reviewer`, finding-verifier, fix round, visual-qa if visible, performance if it scales |
| High | stored data, file format, crypto, IPC, permissions or roles, licence, restricted views, packaging, calculation code | two reviewers, finding-verifier at standard tier or above, data-migration if stored data, security-reviewer if crypto/IPC/permissions, full and slow suites, heavy-tier fixes |

26. Anything touching a calculation (formula, constant, unit, default,
    tolerance) is high and also an owner gate (rule 33), whatever else the
    phase contains.

### 5.6 Fix rounds and the cap

27. A phase gets at most **3 review/fix rounds**. Round 1 reviews the whole
    phase diff; rounds 2 and 3 review **only the diff of the fix**, with the
    list of confirmed findings and their fixes.
28. If Important findings remain after round 3, the supervisor does not try a
    4th round. It stops the phase, **rethinks the approach** (a new short plan,
    possibly a different split or a different implementation), records the
    rethink as a decision, and runs the phase again from build with a fresh
    round counter. If the rethink also fails after another 3 rounds, the run
    stops for that phase, marks it `blocked`, continues with phases that do not
    depend on it, and puts it in the final report as an owner decision.
29. A serious data or security finding is fixed by the supervisor's own
    process, not by waiting: heavy-tier fix, then re-review of the fix diff by
    the heavy tier, repeated up to the cap in rule 27. Only after the cap does
    it stop.

### 5.7 Recurring findings become tests or rules

30. ("Incidents become evals".) When a finding is `confirmed` and either
    (a) it is Important, or (b) the same kind of finding appears a second time
    in the run, the supervisor asks: can a test catch this? If yes, the fix
    round **must** add that test (a regression test that fails on the old code,
    proven in a temporary worktree as AGENT-RULES rule 1 says). If no test is
    possible, the supervisor proposes a line for `REVIEW.md` or PROJECT.md. A
    proposed rule is recorded as a decision with status `reversible`; the owner
    sees it in the final report.
    Example: files missing from the build list broke the packaged test build
    twice; the fix was a packaging test that fails when a source file is not
    included in the package list.
31. Each repo may have a `REVIEW.md` in its root (template in section 8).
    Reviewers and the verifier read it before the diff. If it is missing, the
    review log says so, and the supervisor offers `dev-docs` to write one from
    the template at the end of planning (one batch question, not a stop).

### 5.8 Owner gates (the only stops)

32. The run stops, asks and waits (as a gate on the dashboard and in the chat)
    in exactly these cases:
    1. **Release**: building an installer or package, signing, tagging,
       copying to a share, pushing, publishing, opening a pull request to a
       protected branch.
    2. **Domain numbers and formulas**: any item on the project's *domain
       gate list* (rule 33), when the change would alter it or its result.
    3. **Budget 100 %** (rule 41).
    4. **A blocked phase** (rule 28) that others depend on.
    5. **A new, unplanned requirement** that is not in the request list and
       would need an owner decision (scope question).
    6. **An action the safety rules mark `ask` or `never`** (`check_action`).
33. The **domain gate list** is configurable per project, in PROJECT.md under a
    new heading "Owner gates (autonomous mode)": a list of paths, modules or
    kinds of change (for example "everything under `src/calc/`", "tax rates",
    "tolerances", "default unit systems"). If a project has the heading but it
    is empty, no domain gate exists. If the heading is missing, the supervisor
    asks during planning (one question) and records the answer; a project with
    calculations never runs without an answer.
34. At an owner gate the supervisor does not stop the whole run if other
    phases do not depend on the gated work: it parks the gated item, marks it
    `waiting for owner` in the state file, and continues with independent
    phases. It never works around the gate (no "temporary" value).
35. Data format and security changes **may** run autonomously, with the
    data-migration and security-review gates of rule 17. A change that would
    make an older release unable to open a file written by the new one is
    allowed only when the spec says so explicitly (a decision with the owner's
    answer); otherwise it is an Important finding.

### 5.9 Safety rules carried over

36. **Never kill processes by name.** Only PIDs the agent itself started, with
    their children (AGENT-RULES rule 5). No `taskkill /IM`, `Stop-Process -Name`
    or `pkill`.
37. **Headless only.** Dev servers, apps and browsers for tests and screenshots
    run hidden or headless; no window may open on the owner's screen. If a test
    needs a window and cannot run hidden, it is "not run" and reported.
38. **No throwaway executables.** Agents do not create, copy or launch
    one-off executables or self-copying launchers. Tests use the project's own
    test commands. A test that must run a packaged binary asks the owner first.
39. **Never push or publish** without the owner. Agents commit only on their
    own branch (rule 14); the supervisor commits only merges on the integration
    branch. Real data is never used in tests (invented fixtures only); a
    secret, a licence file or a real record found in a diff is a stop and a
    finding, named but never printed.

### 5.10 Token budget and economy

40. **Budget estimate.** During planning the supervisor estimates tokens per
    phase (number of agents x typical run size for their tier, from the run
    log of earlier versions when there is one, else from a stated default),
    sums them, adds a reserve for fix rounds (default: one extra round per
    phase), and shows the table to the owner. The owner may change it. It is
    stored in the state file as the **version budget** (a token number).
41. **Thresholds.** At **80 %** of the budget the supervisor posts a warning
    (chat and dashboard) with the remaining plan, and continues. At **100 %** it
    starts no new agent, lets running agents finish their current step, writes
    the state file, opens a gate "budget reached" with three options (raise the
    budget by an amount; cut scope to what is merged; stop here) and waits. The
    budget is advisory like all Arsenale budgets (README): the supervisor
    follows it; Arsenale cannot stop an agent.
42. **Short prompts.** An agent prompt contains: the repo and app folder, the
    path of PROJECT.md, the path and section of the state file, the run id, the
    task in two or three lines, and what the agent must not do. It does not
    paste the state file, the spec, or earlier reports (it points to them).
43. **Model by weight** (AGENT-RULES rule 3), applied as: light tier for
    scanning, collecting lists, reading logs, finding-verifier on ordinary
    findings, and screenshot/visual checks; standard tier for ordinary
    building, fixing, review of medium diffs, tests, docs; heavy tier **only**
    for data and security-critical builds and fixes, specs, data-migration,
    security-reviewer, calculation work. Raising a run to heavy is logged with
    the reason. `architecture-reviewer` is not part of an autonomous run unless
    the owner asks.
44. **Read the diff, not the repo.** Reviewers and the verifier receive the
    diff, the changed files' paths, the relevant spec section and the builder's
    report path; they open other files only for a specific doubt. Reports
    follow AGENT-RULES section 9 rule 1 (short, detail in a file).
    **Skip slow suites when stored data is untouched:** the slow or
    compatibility suites named in PROJECT.md run only when the phase's tier is
    high because of stored data or format; otherwise the normal suite is
    enough. The supervisor records "slow suite skipped, no stored data touched"
    in the review log.
45. **Per-phase token usage** is recorded: the supervisor tags every run with
    the phase (rule 46), and the dashboard sums tokens per phase from the run
    log (and from transcripts where Claude Code allows). Where tokens cannot be
    read for a tool, the phase shows "not recorded", never 0.
46. **Run log fields.** `arsenale start` accepts two new optional fields,
    `versionRun` (for example `app-x-1.2`) and `phase` (for example `P2`). The
    finish record repeats them. Existing runs without them are unaffected.

### 5.11 Multi-day runs, overnight, resume

47. State survives restarts: the state file (decisions, phases, ledger, open
    gates) plus the run log are enough to continue. The supervisor writes the
    file before it ends a turn or waits (rule 9).
48. **Resume.** `/version-resume <version>` (skill) or "resume the autonomous
    run of <version>": the supervisor reads the state file, runs
    `arsenale answers` and `arsenale inbox`, lists runs of that version still
    `running` in the log, checks which of them have no live process (it checks
    only PIDs recorded in the state file or run log, never by name), marks
    abandoned runs `stopped`, checks which worktrees and branches exist, and
    continues from the first phase that is not `merged and gated`. A phase that
    was half built resumes from its branches; it does not start over.
49. **Overnight.** While a run is active (at least one phase `building` or
    `gating`) the machine must not go to sleep; when the run is idle (waiting
    for the owner, or finished) the hold is released. How the hold is made is
    open question 2. The hold is released also on error exit and on stop.
50. The run does not need the owner's chat to be open: owner gates wait on the
    dashboard and in the chat, and the run continues after the answer is read
    with `arsenale answers`.

### 5.12 Final report

51. The final report (written to the state file and given in the chat in the
    user's language) contains: what was requested and what was delivered per
    request; phases with tiers, rounds used and result; all decisions D1 ...
    with status, newest overrulings first; owner gates reached and their state;
    all `Important` findings and how they were fixed, all Nits and
    Pre-existing items left; rejected findings counted (and listed in the
    review log); tests and evidence per phase; recurring-finding tests and
    rules added; token usage per phase against the budget; what was NOT done
    (not pushed, not built, not published, checks skipped and why); and the
    exact next owner actions (merge the integration branch? build? release?).
52. The `docs-explainer` recap with a glossary is part of the hand-over, as in
    WORKFLOW stage 9.

### 5.13 Portable: everything ships with Arsenale

53. Autonomous mode depends on **no file outside the Arsenale repo and the
    project**. On a fresh machine, `git clone` of Arsenale plus the installer
    must be enough. Nothing may read the owner's private notes, memory files,
    private agent folders or any path of the machine that built the feature.
54. The repo ships, under a new `autonomous/` folder (installed copies go to
    the user-level agent folder and `~/.arsenale`): the rules (the WORKFLOW and
    AGENT-RULES sections), all agent definitions including `finding-verifier`,
    the **version state-file template** (`version-list.template.md`), the
    `REVIEW.template.md`, the **planning question checklist**
    (`planning-checklist.md`: scope, users and roles, stored data and
    compatibility, security surface, UI needing mockups, owner gates, test
    suites and baseline, budget, release steps), the **owner-gate list
    template** (default entries: release steps; calculations, constants,
    units, defaults, tolerances; money and legal text), the **token budget
    defaults** (per tier, per agent kind, fix-round reserve; plain JSON,
    `autonomous/budget-defaults.json`, overridable in PROJECT.md), and the
    Version run page (part of the dashboard build).
55. **One-command setup.** `arsenale init [--dir <repo>]` scaffolds a project:
    asks before each write, shows the plan with `--dry-run`, and creates only
    what is missing: `PROJECT.md` (from the template, filled with what it
    detects from `package.json` or other manifests and marked "to confirm"
    where it guesses), `REVIEW.md`, `docs/specs/`, and the "Owner gates" and
    "Test suites" sections. It never overwrites an existing file; an existing
    `PROJECT.md` only gets the missing sections appended after the owner agrees.
    It installs the user-level agents, skills and rules if they are not yet
    installed (the same code as the installer; no second copy of the files).
56. `arsenale autonomous start <version> [--dir <repo>]` creates
    `docs/specs/<version>-list.md` from the template with the status
    `planning`, the integration branch name and the budget defaults filled in,
    registers the version run in the data folder (rule 46, question 1), and
    prints the next instruction for the supervisor ("read WORKFLOW.md,
    Autonomous mode, then run the planning checklist"). It starts no agent.
    `arsenale autonomous status <version>` prints phase, gates and budget;
    `arsenale autonomous resume <version>` prints the resume instruction (rule
    48) and re-registers the run. These commands read and write files only.
57. If `git` is missing, or the folder is not a git repo, `init` says so and
    offers `git init` (asked, never silent); an empty repo with no commit gets
    a first commit only with the owner's yes, because worktrees need one.
58. Every shipped file is generic: invented examples only, no company, person
    or project names, no machine paths.

### 5.14 Dogfood: Arsenale builds its own autonomous mode

59. The first two runs are pilots, in parallel: **pilot 1**, a version of an
    owner's application ("app X 1.2"), and **pilot 2**, this feature built in
    the Arsenale repo itself ("Arsenale 1.1"). Pilot 2 follows this spec's own
    rules as far as they exist; where a rule is not built yet, the supervisor
    follows the written rule by hand and records the gap as a decision. Pilot 2
    must not depend on code it is still writing: the first phases build the
    parts the run needs (state-file template, `finding-verifier`, run-log
    fields); later phases may then use them.
60. **No collisions between two runs.** Each run has its own `versionRun` id
    (`app-x-1.2`, `arsenale-1.1`), its own state file in its own repo, its own
    integration branch and branch names, its own worktree folder
    (`<scratchpad>/<versionRun>/...`), and its own budget in its own state
    file. Agent branches carry the version, so two runs never share a branch.
    Run-log records carry `versionRun`, so each page and each ledger counts only
    its own runs. One session never starts agents for the other run's repo.
61. **Shared dashboard.** The Version run page lists all runs (a selector at the
    top; the default is the one with open gates, then the newest). Office and
    Activity pages show both, filterable by `versionRun`. Gates carry the
    `versionRun`, so an owner gate states which run asked.
62. **Shared budgets.** The version budget is per run and enforced only by that
    run's supervisor. Two runs also draw on the same company, office or
    employee budgets and on the owner's real usage allowance. So: the combined
    80 % / 100 % of the **company** budget (when one is set) is also checked
    with `arsenale budget-check` before every agent start, as today; and the
    supervisors respect a **global heavy-tier limit** of three concurrent heavy
    runs across both runs (AGENT-RULES section 9 rule 7), counted from `running`
    records in the run log. The version page shows both gauges: this run's
    budget, and the combined use of all active runs.
63. **Machine resources.** Two runs share one machine: test suites of the two
    repos can run at once, which is allowed, but a "busy machine" time-out is
    re-run once (section 9 rule 3) before it counts as a failure. The
    keep-awake hold (rule 49) is shared: released only when no run is active.
64. **Order of safety.** Because pilot 2 changes the tooling pilot 1 uses
    (agents, rules, dashboard), pilot 1 uses the **installed** copies; Arsenale
    changes are installed for pilot 1 only after the owner merges the
    integration branch of pilot 2 and re-runs the installer. Pilot 2 never
    edits the owner's user-level agent folder in place during its run.

### 5.15 First dogfood tasks: office view fixes

Source: the owner's screenshot of the Campus/office view (not available to the
spec writer; the points below are from the owner's description, so details of
the current look are unchecked and must be confirmed by `ui-designer` against
the running page). These are the first requests of pilot 2 (rule 59). They are
**UI work: mockups first** (the owner's rule). `ui-designer` makes 2-3
directions for the office view; the owner picks (Gate B). In an autonomous run
the owner has said the supervisor picks; the supervisor then logs the choice,
the rejected directions and the reason as a decision (`arsenale decision`), and
the owner can overrule it in the final report. Code is in
`tools/agent-office-page.cjs` and `tools/office-world.cjs` (inferred from file
names; not yet read).

65. **Idle agents are not prominent.** In the office, an agent whose state is
    idle does not show its large portrait card. Working and waiting agents are
    shown prominently. Idle agents are shown as small, dimmed figures in the
    lounge, or hidden behind a count ("12 idle") that opens the list; which of
    the two (or both, by number of idle agents) is a design choice for the
    mockups. Clicking an idle agent (or the count) still opens its details
    panel. A failed or done state is not idle and keeps its card.
66. **One agent type, two runs at once.** When one agent type has two or more
    runs running at the same time, the office shows one figure per run, at its
    own desk, each with its own status bubble and its own current step. They
    share one title with a multiplier ("implementer ×2"). A run keeps its figure
    and desk for its whole life; when one of the two finishes, only that figure
    leaves. If there are more simultaneous runs than free desks, the guest-desk
    rule of the README applies, and the title still counts all runs.
67. **No-overlap layout.** Labels, status bubbles, portrait cards and the "N
    reports handed in" box never cover an avatar or each other, at any number of
    agents the page supports and at the supported window sizes. The mockups
    define the mechanism; acceptable ones are (a) collision avoidance: each
    label is placed at the nearest free slot around its figure, keeping a
    minimum gap in px, with a leader line when moved, or (b) a side list: bubbles
    and counters move out of the scene into a list beside it, and the scene keeps
    only the figure and a short name. When no free slot exists, the label
    collapses to a short form (initial or count) rather than overlapping, and the
    full text is in the details panel. Long and non-Latin names are cut with an
    ellipsis at a fixed width, never wrapped over a neighbour.
68. **Per-project cards on the right stay as they are** (the owner said they
    are fine). Not part of the redesign; they must not shift or change in the
    mockups.

Acceptance tests for this section:

- **O1 (visual-qa).** Given 14 agents of which 12 are idle and 2 working,
  when the office opens, then only the two working agents show portrait cards,
  and the idle ones appear as small dimmed figures or as "12 idle" (per the
  chosen mockup); clicking "12 idle" opens the list.
- **O2 (visual-qa).** Given two simultaneous runs of agent type "implementer"
  (one at "reading A", one at "running tests"), then the office shows two
  figures at two desks, each with its own bubble, under one title "implementer
  ×2"; when the first finishes, one figure remains, titled "implementer".
- **O3 (visual-qa).** Given 6 working agents close together, a long Latin name
  and a long non-Latin name, and "7 reports handed in", then no label, bubble
  or box overlaps an avatar or another label (measured by bounding boxes in a
  headless check of the DOM, plus a screenshot that was opened and looked at),
  at 1280x720 and 1920x1080.
- **O4 (visual-qa).** Given the same data, then the per-project cards on the
  right are pixel-identical in size and position to before the change.
- **O5.** Given the supervisor picks a direction in autonomous mode, then a
  decision with the reason and the rejected directions is on the decision
  timeline.

## 6. Edge cases

- **Empty list.** A version with no requests: planning ends with "nothing to
  run"; no state file is created, or it is created with status `empty`.
- **One request.** Allowed; one phase; the cycle is the same, with fewer
  ceremonies, but the gates still run. (For a single request `/feature` is
  usually cheaper; the supervisor may say so.)
- **Very many requests (e.g. 40).** Planning is split into batches of at most
  5 questions; if the estimate exceeds the owner's stated limit, the supervisor
  proposes splitting into two versions and asks.
- **Long text, non-Latin text.** Decision text, request names and findings are
  stored as UTF-8 and shown without cutting a character; the state file keeps
  the owner's own language for his answers; ids and labels stay English.
- **Cancel part way through.** The owner says "stop" in the chat or answers
  "stop here" at a gate: no new agents, running agents finish their step, state
  file saved, status `stopped`, worktrees kept until the owner says to remove
  them (or `resume` continues). Stopping never deletes branches or work.
- **Two agents need one file.** Handled in planning (rule 12). If discovered
  late, the later branch is rebased by its own agent on its own branch before
  merge; the supervisor never resolves conflicts silently in a way that drops
  one side. A conflict that is not mechanical is a finding for the implementer.
- **The suite is red before the run starts.** Planning records the baseline
  (which tests fail on the base branch). New failures are measured against it;
  a red baseline is reported to the owner before the run starts.
- **The suite is flaky or times out on a busy machine.** Re-run only the
  failing tests (AGENT-RULES section 9 rule 3); a test that fails once and
  passes is recorded as flaky in the review log.
- **Old file in a new app / new file in an old app.** This is the job of the
  data-migration gate for the project; for Arsenale itself see section 10.
- **Offline or read-only.** Without network the run continues (no step needs
  it). A read-only repo or a locked state file stops the run with a clear
  message and no partial writes.
- **Restricted roles.** The agents have no way to answer gates, change budgets
  or settings; autonomous mode adds no tool for that. The version budget lives
  in the state file and the supervisor's own record; changing it needs the
  owner's message (a decision).
- **Invalid budget input.** A budget must be a positive whole number of tokens;
  zero, negative, or text is refused and asked again. 80 % and 100 % are
  computed on the budget, never on a rounded display.
- **A decision made by the supervisor is wrong.** The owner overrules by new
  decision; the supervisor re-plans from the first affected phase, and phases
  already merged that depend on it are re-gated, not silently kept.
- **A finding that shows the spec was wrong.** Goes back to a spec-writer run;
  if it opens a question that only the owner can answer, it is an owner gate
  (rule 32.5), and independent phases continue (rule 34).
- **The machine restarts mid-merge.** Resume checks the integration branch for
  an unfinished merge and the state file for the merge order; it finishes or
  aborts that one merge, runs the suite, then continues. It never uses a
  command that rewinds the tree.

## 7. Dashboard: the "Version run" page

A new page, reachable from the nav next to Tasks and Decisions. It reads the
version run records and the run log; it writes nothing and starts nothing. The
only write is the owner's answer to a gate, through the existing `/api/answer`.
Layout and look go to `ui-designer`; this section is the content.

1. **Header:** app and version ("app X 1.2"), status (`planning`, `running`,
   `waiting for owner`, `stopped`, `blocked`, `done`), elapsed time, last
   update, integration branch.
2. **Phases:** one row per phase: name, risk tier, requests in it, percent
   complete (merged requests / all requests in the phase, plus a gate marker:
   building, gating round n of 3, fixing, merged, blocked), tokens used.
3. **Current agents:** agents running now with phase, request, model, step
   (from `progress`), and time running. Same data as the Office page, filtered
   to this version.
4. **Decisions:** list D1 ... newest first; owner vs supervisor vs agent;
   status; filter "supervisor decisions only"; each with its reason.
5. **Open owner gates:** release, domain, budget, scope, blocked phase, with
   the question, options and the answer buttons (the existing approval
   letter). Shows how long each has waited.
6. **Review reports:** per phase and round: reviewers run, findings by
   severity, confirmed / rejected / unclear counts from the verifier, link to
   the report file path (shown as text; a file is never opened).
7. **Token budget gauge:** used / budget, the 80 % mark, the 100 % mark,
   per-phase bars, "not recorded" where unknown, USD only when priced.
8. **Empty states:** no version run yet (a short explanation and the command to
   start one); a run with no tokens recorded.
9. The page works in the demo (`arsenale demo`) with an invented run.

## 8. REVIEW.md and PROJECT.md additions

`agents/REVIEW.template.md` (new), copied by `dev-docs` into a repo as
`REVIEW.md`. Headings:

- **What "broken" means here**: data loss, wrong result, crash on start,
  permission bypass, a file the previous release cannot open, a missing file
  in the package. Ranked, with one example each.
- **Never acceptable** (always Important): list of project-specific musts.
- **Usually a Nit**: style, naming, comments.
- **Known pre-existing issues**: so reviewers do not report them again.
- **Where to look first**: paths and risky modules.
- **Checks that must show evidence**: the commands (test, build, packaging
  test) and what a pass looks like.
- **Incident log**: each past slip-through with its test or rule (rule 30).

`PROJECT.template.md` gets: an "Owner gates (autonomous mode)" section (rule
33), a "Test suites" section naming the full, fast and slow/compat commands
(rule 44), and a pointer to `REVIEW.md`.

## 9. Draft: `agents/finding-verifier.md`

For `agent-builder` to write after approval. It follows the format of the
existing definitions.

```
---
name: finding-verifier
description: Re-checks every finding that reviewers reported against the actual code and the diff, and drops false positives. Use it after code-reviewer, security-reviewer, data-migration, ux-reviewer or visual-qa have reported, before any fix round in an autonomous run or a large review. It does not find new problems, does not edit files and does not review the whole app.
model: haiku
effort: low
color: red
zone: review
tools: Read, Glob, Grep, Bash
---

You verify findings. You do not edit files, commit, or look for new problems.

Follow `AGENT-RULES.md` (in the same folder as this file) and the repo's
`PROJECT.md`. Read the repo's `REVIEW.md` if it exists.

Input from the supervisor: the list of findings (id, file:line, claim, input
that triggers it, severity), the path of the diff or the branch names, and the
spec section. Run Bash only to read (git diff, git show, git blame, grep) or to
run one targeted existing test; never to change anything.

For each finding, decide with evidence:
1. Is the cited location real in the current code? (A moved or deleted line is
   `rejected: stale`.)
2. Does the described input really give the described wrong result? Follow the
   code path; run the one test or command that shows it when a cheap one
   exists.
3. Is it already handled earlier in the path (a guard, a validation, a test)?
4. Was it introduced by this diff, or does it exist before it? Label
   `pre-existing` when it does.
5. Is the severity right? Important = data loss, security, wrong result,
   crash, broken spec rule. Nit = style, small clarity. Say if you change it.

Verdicts: `confirmed`, `rejected` (one line why, with the file:line that
disproves it), `unclear` (what you could not establish, and what would
decide it). Doubt is `unclear`, never `rejected`. A finding about data,
security, crypto, permissions or a file format is never rejected by you
alone: mark it `unclear` with your reasoning so the supervisor can send it to
the heavy tier.

Never read the whole repo; open only what the finding points to and the
smallest context needed. Never print a secret or personal data you meet; name
the file.

Report (at most about 250 words, detail in a file in the scratchpad): a table
of finding id, verdict, severity (changed or not), evidence line. Then the
counts: confirmed, rejected, unclear, pre-existing. Say what you did not run.
```

## 10. Data and compatibility impact (for Arsenale itself)

- **New run-log fields:** `versionRun`, `phase` (optional, on start and
  finish). Older Arsenale reading new records ignores unknown fields; older
  records have no such fields and show as before. No format version change
  needed if the record reader already ignores unknown keys (to be verified by
  `data-migration` in the implementation, step 1).
- **New record kind:** a version-run record in the data folder
  (`<data>/version-runs/<id>.json`): id, app, version, status, phases with
  tiers and percents, budget, the state file path, and last update. It is a
  **mirror** for the dashboard, written by the supervisor through a new CLI
  command (see question 1); the state file in the repo is the source for
  resume. If the two disagree, the state file wins and the mirror is rewritten.
- **An older Arsenale opening a new data folder:** ignores the new folder and
  fields; the new page does not exist there.
- **A new Arsenale opening an old data folder:** the page shows "no version
  run yet".
- **Agents and skills:** installing adds `finding-verifier.md`, two skills and
  `REVIEW.template.md`; uninstall removes only unedited ones (existing
  installer behaviour). A user who edited a bundled agent keeps it.
- **No engineering results are involved** in Arsenale. For a project that uses
  autonomous mode, calculation changes are owner gates (rule 33), so results
  never change without the owner.

## 11. Acceptance tests

All data invented. "Doc check" tests are done by reading the bundled files;
"tool test" tests are automated in `tools/test/`.

1. **State file written.** Given a planning session for "app X 1.2" with three
   requests and two answered questions, when the owner authorises the run, then
   `docs/specs/1.2-list.md` exists with R1-R3, two decisions D1-D2 with source,
   the phase plan, the budget, and the authorisation as D3.
2. **Batch questions.** Given 9 open questions, when planning asks, then it
   asks in batches of at most 5, each with options and a default, and waits.
3. **Authorisation scope.** Given the run authorisation, when an agent tries
   `git push` or an installer build, then it stops and opens a gate; nothing is
   pushed. (Doc check of the rules; supervisor behaviour checked in a dry
   demonstration.)
4. **Worktrees and branches.** Given phase P2 with requests R4 and R5 on
   different files, when it runs, then two worktrees and branches
   `auto/1.2/p2/r4` and `auto/1.2/p2/r5` exist, each with commits only on
   its own branch, and `main` is unchanged.
5. **Merge one by one.** Given R4 and R5 branches, when merged, then the full
   suite runs after each merge, and a deliberately broken R5 is reverted by a
   revert commit and sent back, while R4 stays.
6. **Verifier drops a false positive.** Given a reviewer finding "null deref at
   file F line 40" where line 38 already guards it, when `finding-verifier`
   runs, then the verdict is `rejected` with "guarded at F:38", and the finding
   is listed in the review log but not sent to the fix round.
7. **Verifier never rejects a security finding alone.** Given a finding tagged
   security that the verifier doubts, then the verdict is `unclear`, and the
   supervisor sends it to the heavy tier.
8. **Round cap.** Given a phase whose Important finding survives three fix
   rounds, then there is no 4th round; a rethink decision is recorded; after a
   second failed set of 3 rounds the phase is `blocked` and the run goes on
   with independent phases.
9. **Diff-only re-review.** Given round 2, then the reviewer's brief contains
   only the fix diff and the finding list, not the whole phase diff. (Brief
   inspected in the run log.)
10. **Risk tiers.** Given a docs-only phase, then only the low-tier gates run;
    given a phase changing a stored settings file, then two reviewers,
    data-migration and the slow suite run; given a phase changing a tax-rate
    constant, then the run reaches the domain owner gate.
11. **Slow suite skipped.** Given a medium phase with no stored data touched,
    then the slow suite is skipped and the log says "slow suite skipped, no
    stored data touched".
12. **Incident becomes a test.** Given a confirmed Important finding "a source
    file is missing from the package list", then the fix round adds a packaging
    test that fails on the old code (proven in a temporary worktree) and the
    test is named in the final report.
13. **Release gate.** Given all phases merged and gated, then the supervisor
    does not build; it opens the release gate and the status is `waiting for
    owner`.
14. **Token thresholds.** Given a budget of 1,000,000 tokens, when usage reaches
    800,000, then one warning is posted (chat and dashboard) and the run goes
    on; at 1,000,000 no new agent starts, a gate with three options appears, and
    the state file is saved. A budget of 0 or "abc" is refused.
15. **Per-phase tokens.** Given runs tagged `phase: P1` and `phase: P2`, then
    the dashboard shows tokens per phase, and "not recorded" for a run whose
    tokens cannot be read. (Tool test.)
16. **Resume.** Given a run stopped by a restart with P1 merged and P2 half
    built, when `/version-resume 1.2` runs, then P1 is not repeated, P2
    continues from its branches, an orphaned `running` record is marked
    `stopped` by PID check and not by name, and no process is killed by name.
17. **Keep-awake.** Given a running phase, then the hold is active (checked by
    the means chosen in question 2); given the run waiting at an owner gate or
    finished, then the hold is released; given the supervisor crashes, then the
    hold is not left on.
18. **Safety rules.** Given a run, then no `taskkill /IM`, `pkill` or
    `Stop-Process -Name` appears in any agent log; no window opened (headless
    only); no new `.exe` or launcher is created; test fixtures contain no real
    data (the code review checks this).
19. **Dashboard page.** Given a demo run with 3 phases, then the "Version run"
    page shows the phases with percents, the current agents, the decisions list,
    one open gate with answer buttons, review reports with severity counts, and
    the gauge with the 80 % mark. Needs `visual-qa`. Empty state also checked.
20. **Gate answer from the page.** Given an open "release" gate, when the owner
    clicks answer on the page, then it lands in `answers.jsonl` and the
    supervisor reads it with `arsenale answers`; an agent attempting the same
    through MCP is refused. (Tool test.)
21. **Final report.** Given a finished run, then the report contains every
    item of rule 51, in the user's language, with decisions ordered as stated.
22. **Public repo hygiene.** Given the new files, then a search finds no
    company name, person name, real project name or key (code review).
24. **Fresh machine, empty repo.** Given a clean machine (a clean user account
    or container with only Node.js and git, no `~/.claude`, no `~/.arsenale`, no
    access to any private file), when Arsenale is cloned, the installer is run,
    a new empty folder is `git init`ed and `arsenale init` is run, then
    `PROJECT.md`, `REVIEW.md` and `docs/specs/` exist, the agents (including
    `finding-verifier`), skills and rules are installed, and `arsenale
    autonomous start 0.1` creates `docs/specs/0.1-list.md` with the budget
    defaults; the planning instruction is printed. (Tool test on a temporary
    `ARSENALE_HOME` and temporary folders.)
25. **No private dependency.** Given the shipped `autonomous/` folder and the
    new agent files, then a search finds no absolute path, user name, company
    name, or reference to a file outside the repo; and a run of test 24 with
    the real home folder hidden gives the same result.
26. **Init is safe.** Given a repo that already has a `PROJECT.md`, when `arsenale
    init --dry-run` runs, nothing is written and the plan lists the sections it
    would append; when `init` runs and the owner declines, nothing changes;
    when it is run twice, the second run changes nothing.
27. **Dashboard on a fresh install.** Given the fresh install of test 24 and a
    started version run, then `arsenale demo`-style serving shows the Version
    run page with the new run in `planning` and its budget gauge. Needs
    `visual-qa`.
28. **Two runs, no collision.** Given runs `app-x-1.2` and `arsenale-1.1` with
    invented agents, then each ledger counts only its own tagged runs, branch
    names differ, a gate shows its run, the selector switches runs, and a third
    heavy start is refused by the global limit. (Tool test.)
29. **Pilot 2 bootstrap.** Given the Arsenale repo at its current commit, when
    pilot 2 runs, then its first phase produces the template, the verifier and
    the run-log fields before any later phase relies on them, and the user-level
    agent folder is unchanged during the run (rule 64).
30. **Domain validation.** Not applicable inside Arsenale; for adopting
    projects, the domain gate list is exercised by test 10. No
    `domain-validator` run is needed for Arsenale itself.

## 12. Impact on existing Arsenale files

| File or area | Change |
|---|---|
| `agents/WORKFLOW.md` | New section "Autonomous mode" (phases, gates, tiers, owner gates, the cap, resume); table row for `finding-verifier`; note that Gate A/B/C are replaced in this mode by planning + run authorisation + the two owner gates |
| `agents/AGENT-RULES.md` | New section 10 "Autonomous runs": worktree and branch rules, commit only on own branch, short prompts that point to the state file, verifier rule, evidence rule, `phase` field in `arsenale start`; section 9 gets the diff-only and slow-suite rules by reference |
| `agents/finding-verifier.md` | New (section 9 draft) |
| `agents/code-reviewer.md` | Findings carry a severity (Important / Nit / Pre-existing); a "diff-only" mode for rounds 2-3; read `REVIEW.md`; second brief for the high tier |
| `agents/security-reviewer.md`, `data-migration.md`, `visual-qa.md` | Same severity labels; read `REVIEW.md`; report format that the verifier can read (id, file:line, claim, input) |
| `agents/spec-writer.md` | Questions numbered so they can be merged into batches; domain-gate flag on a question |
| `agents/PROJECT.template.md` | New sections: Owner gates, Test suites (full / fast / slow), pointer to `REVIEW.md` |
| `agents/REVIEW.template.md` | New |
| `agents/dev-docs.md` | Can write `REVIEW.md` from the template |
| `agents/labels.json` | Label for `finding-verifier` |
| `adapters/claude-code/skills/version-run/SKILL.md`, `version-resume/SKILL.md` | New skills; `adapters/*/README.md` get the "run the autonomous cycle" instruction block for other tools |
| `install.ps1`, `install.sh`, `tools/test/install.test.cjs` | Install and uninstall the new agent, skills and template; test them |
| `tools/runlog.cjs` | Optional `versionRun`, `phase` on start/finish; new `versionRun` record write; the owner-only rule: only the board answers its gates (already so) |
| `tools/log-agent-run.cjs` | CLI command(s) for version-run records and `--help` text |
| `tools/mcp-server.cjs` | Tools to record a phase and read the version run (no tool to answer gates or change the budget) |
| `tools/agent-dashboard-server.cjs`, `build-agent-dashboard.cjs` | Route `/api/version-runs`; include version runs in `/api/state` |
| new `tools/version-run-page.cjs` | The page |
| `tools/dashboard-strings.cjs` | Strings for the page |
| `tools/demo.cjs` | An invented version run in the demo |
| `tools/test/cli.test.cjs` and new tests | The tool tests named in section 11 |
| `README.md`, `CONTRIBUTING.md` | A short section "Autonomous mode", the screenshot, the safety notes; no change to the claim that Arsenale never runs agents |
| new `autonomous/` folder | Rules extract, state-file template, planning checklist, owner-gate list template, `budget-defaults.json` (rule 54) |
| `bin/arsenale.cjs`, `tools/log-agent-run.cjs` | New commands `init`, `autonomous start/status/resume` (rules 55-56), file-only |
| `install.ps1`, `install.sh` | Same install code reused by `arsenale init` (no second copy of the files) |
| `.github/workflows/ci.yml` | Run the fresh-machine test (24) on the three systems |

## 13. Implementation plan (small steps)

Each step ends with the targeted tests; the full suite once at the end of the
step, and review as in the normal cycle.

1. **Decide the open questions (section 14).** Then `data-migration` checks the
   run-log reader ignores unknown fields.
2. **Run-log fields and version-run record** in `runlog.cjs` and the CLI, with
   tool tests (tests 15, 20).
3. **`finding-verifier.md`**, `labels.json`, the severity labels in the four
   reviewer definitions, the `REVIEW.template.md`.
4. **`PROJECT.template.md` and `spec-writer.md`** changes.
5. **`WORKFLOW.md` and `AGENT-RULES.md` sections** (rules of section 5).
6. **Skills `version-run` and `version-resume`**, the adapter READMEs, the
   installers and their tests.
6b. **Portable bundle and setup commands:** the `autonomous/` folder, `arsenale
   init`, `arsenale autonomous start|status|resume`, tests 24-26 (pilot 2
   builds this step first among the runtime parts, rule 59).
7. **Keep-awake helper** per the answer to question 2, with its test (test 17).
8. **Dashboard server routes and data**, then `ui-designer` for the page
   (Gate B), then `tools/version-run-page.cjs`, strings, demo data, `visual-qa`.
9. **Dry run** on a throwaway sample repo with invented content (two phases,
   one forced false positive, one forced packaging failure, one budget
   crossing), checking tests 1-21 and 24-29 by hand and by log. In practice
   this is pilot 2 itself (rule 59), running next to pilot 1.
10. **Docs** (`README.md`, `CONTRIBUTING.md`), `docs-explainer` recap, then Gate
    C for commit and release as usual for Arsenale (its PR-only `main`).

## 14. OPEN QUESTIONS for the owner

1. **Where does the dashboard read a version run from?**
   The state file is in the project repo (`docs/specs/<version>-list.md`), but
   Arsenale reads only its own data folder and listed transcript folders.
   - A: the supervisor mirrors the state to `<data>/version-runs/<id>.json`
     (a small CLI command), the md file stays the source for resume.
   - B: the dashboard reads the md file directly from a folder the owner lists
     (like `transcriptRoots`).
   - C: the data folder JSON is the only source and the md is generated from it.
   Recommended: **A**. It keeps the page on data Arsenale already owns, needs no
   new "may read this folder" setting, and the md remains readable and
   versioned by git. Cost: two copies, with the md winning on conflict.
   Blocks: step 2 and the dashboard (step 8).

2. **How is the machine kept awake while a run is active?**
   Arsenale's server never starts a process, and agents may not create
   throwaway executables.
   - A: a small command in the Arsenale CLI (`arsenale awake start|stop`) run
     by the supervisor, which holds the OS "do not sleep" request while its own
     PID lives (Windows execution-state request, macOS `caffeinate -i -w <pid>`,
     Linux `systemd-inhibit`), and releases it on exit.
   - B: the supervisor's tool does it (Claude Code setting or the owner's
     power plan); Arsenale only documents it.
   - C: documentation only, the owner sets the power plan once.
   Recommended: **A**, as a command the owner can read and that holds only
   while a PID lives, so a crash cannot leave it on. It needs an exception
   sentence in the README ("the server never starts a process" stays true; the
   CLI command does, once, at the supervisor's request). Blocks: step 7 and
   acceptance test 17.

3. **What does the "run authorisation" cover?**
   Gate C today means "permission to commit and release, per repo, per
   action". Autonomous mode needs permission to commit on agent branches and
   merge into an integration branch without asking each time.
   - A: one authorisation, given at the end of planning, covers commits on
     agent branches and merges into `auto/<version>/integration`; nothing else
     (push, tag, build, publish remain gates).
   - B: as A, but also allow a push of the integration branch to the repo's
     own remote (not `main`).
   - C: keep asking for commit permission per phase.
   Recommended: **A**. It matches what was done by hand and removes every stop
   except the two the owner named. Blocks: rules 4, 14, 22 and the skill text.

4. **At 100 % of the token budget, which stop is right?**
   - A: no new agents; running agents finish their step; ask (raise, cut scope,
     stop).
   - B: stop everything immediately, including running agents' work.
   Recommended: **A**; an immediate stop can leave a worktree half-edited and
   costs more to recover than the step it saves. Blocks: rule 41.

5. **Should a rejected finding in a data or security area ever be final without
   a heavy-tier second look?**
   - A: no, always a heavy re-check (rule 20 as written).
   - B: yes, if the standard-tier verifier rejects it with a disproving
     file:line.
   Recommended: **A** for the first versions, to measure how often the cheap
   tiers are wrong, then relax by decision. Blocks: rule 20 only.

7. **Pilot 2 and the user-level agent folder.** Pilot 2 edits the repo copies
   only (rule 64), but you may want pilot 1 to benefit sooner.
   - A: pilot 1 keeps the installed copies until pilot 2's integration branch
     is merged and the installer re-run.
   - B: after each pilot-2 phase that passes its gates, you re-run the
     installer so pilot 1 gets the new rules at once.
   Recommended: **A**; rules that change under a running version are a
   collision risk. Blocks: rule 64.

6. **Default budget estimate source.** With no earlier versions in the run log,
   the supervisor has no numbers.
   - A: a stated default per run by tier (written in AGENT-RULES, adjustable
     per project in PROJECT.md), corrected after the first phase from real
     usage.
   - B: the supervisor must ask the owner for a number.
   Recommended: **A** with a re-estimate after phase 1 shown to the owner as a
   decision. Blocks: rule 40 wording only.

### Owner answers (2026-10-16)
All seven recommendations accepted: Q1 A (mirrored JSON in the data folder, the md stays the source), Q2 A (`arsenale awake start|stop`, held only while its PID lives), Q3 A (run authorisation = commits on agent branches + merges into `auto/<version>/integration`; push, tag, build, publish stay owner gates), Q4 A (at 100 %: no new agents, running ones finish their step, then ask), Q5 A (data/security findings always re-checked at the heavy tier), Q6 A (shipped budget defaults, re-estimated after phase 1 and shown as a decision), Q7 A (pilot 1 keeps the installed agents until pilot 2's integration branch is merged and the installer re-run).

### Owner rule (2026-10-16): English only, minimal text
Arsenale must contain NO right-to-left-language text (remove `agents/labels.fa.json`, any such strings in tools, pages, docs and agent files, and any setting that switches the UI to right-to-left-language) and its UI and docs must be minimal: short labels, no explanatory paragraphs on screens, docs trimmed to what a new user needs. Planned as a cleanup phase of pilot 2 (after phase 1), with visual-qa on every page.

### Owner direction (2026-10-16 night): full Arsenale review and redesign scope
- Full review of Arsenale (look, structure, data), the supervisor reviews its own work too.
- Visual design: the office view and especially the CAMPUS buildings look wrong (buildings look like a shop). Use public, free-licensed assets (e.g. CC0 isometric packs; licence recorded per asset) instead of hand-made shapes.
- City-builder style campus: the user (and the supervisor) can ADD buildings/offices like in a building game; more office types than the current four.
- An agent type with N parallel tasks = N separate figures (distinct schematic per run), never one figure; avatars far less busy (simple, readable at a glance).
- Agent packs per task type (new packs for different kinds of work), all usable in autonomous runs.
- Archive / database: correct structure, NO right-to-left-language text in stored data; LTR/RTL alignment correct and consistent with the design.
- Add anything else that helps reach reliable autonomous development and avoids future problems.
Plan: review pass → spec addendum + one batch of owner questions → autonomous phases (after the current phase 2a/2b).

## 16. Redesign and hardening (from the full review)

Source: the full review of 2026-10-16 (not stored in the repo). Phases 2a (cleanup) and 2b (portable) continue as planned; the phases below follow them. Phase 3 is the Version run page of sections 7 and 13 step 8, unchanged. Each phase is sized for one or two parallel worktrees.

### 16.1 Decisions (final, no open questions)

- **A1** Nothing Arsenale ships or writes contains right-to-left-language text: no `*Fa` fields written, no such labels, files or screenshots. Text typed by the user is stored as typed and shown with `dir="auto"`. Old `*Fa` fields are ignored on load (not migrated, not deleted).
- **A2** Assets are CC0 only. Candidates: Kenney, KayKit, Quaternius free packs. Names and licences must be re-verified on the source page before any asset file is committed.
- **A3** The campus is drawn with three.js (orthographic, isometric) with a static image fallback when WebGL is unavailable.
- **A4** In autonomous runs the supervisor may place buildings and offices and logs each one as a decision. The user can move or remove any of them.
- **A5** The core team becomes a pack.
- **A6** The archive page is restyled to the board style.

### 16.2 Rules

**Phase H, hardening (first)**

1. Every write of a run-log file or company file writes a temporary file in the same folder, then renames it. A reader never sees a partial file.
2. Company files (`employees.json`, `offices.json`, `projects.json`, `campus.json`) are changed under a per-file lock. Two writers in parallel lose no update. A stale lock (owner PID gone) is taken over.
3. Tests have two tiers: `fast` (default `npm test`, no browser, under 3 minutes) and `ui` (Chrome tests, concurrency at most 2, one retry on "no DevTools port", separate command). The phase gate runs `fast` per merge and both tiers before the phase is accepted.
4. Page builders over 800 lines are split into modules per screen or concern. The split changes no behaviour: generated HTML/JS is identical before and after (byte comparison in a test) and visual-qa screenshots match.
5. Bug fixes, each with a regression test: (a) Team page lists an existing office as "not set up"; (b) Archive shows 0 tokens while the board shows the real total; (c) "Unassigned work" shows "$0", must show "n/a" like other unpriced items; (d) org chart names and headers are cut to a letter at 1366 px, they must show an ellipsis at a fixed width; (e) Tasks page shows "No tasks yet" before data arrives, it must show a loading state; (f) `demo` prints its address and key URL to a redirected stdout and has a `--no-open` mode that does not block.
6. User-entered text elements carry one shared class (`unicode-bidi: plaintext; text-align: start`) on every page, so right-to-left and English text both start at the left edge.

**Phase 4, Campus and offices**

7. `company/campus.json` (schemaVersion 1, optional; absent = layout derived as today): `grid {cols, rows}`, `buildings [{id, officeId, type, x, y, rot, floors, createdBy, createdAt}]`, `roads`, `props`. An older Arsenale ignores it; a newer file than the app knows is read-only.
8. Buildings stay inside the grid and never overlap. One office per building. A building without an office is a lot. Removing a building archives its office; history is kept.
9. One write path: `campus.place|move|rotate|remove`. The board calls it directly. The supervisor calls it in autonomous runs only; every call writes a decision (A4). An agent through MCP cannot remove a building.
10. 12 office types, each with a shipped model, default zones and default pack: engineering, verification, security, release, docs, design, data, planning, legal, business (finance/hr/support/marketing), archive hall, domain lab. The office `profile` selects the type; list position no longer does.
11. Build mode on the campus: palette, click a lot to place, drag to move, `R` rotates, `Delete` archives. Placing creates the office and offers its default pack.
12. Run id is the figure id: N parallel runs of one agent type show N figures, each at its own desk with its own bubble; the title shows the multiplier. A run keeps figure and desk for its whole life.
13. One simple avatar style in campus, office, team and org pages. No person is drawn twice (no portrait card plus figure). Name tag only; details are in the panel.
14. No label, bubble or box overlaps an avatar or another label (rule 67 of 5.15), measured by bounding boxes at 1366x768 and 1920x1080.
15. Every asset file is listed in `assets/LICENSES.json` with `file, name, author, source URL, licence, date fetched, sha256`, plus `NOTICE.md`. A test fails when a shipped asset has no entry or its entry's licence is not `CC0-1.0`, or its hash differs. Assets are added to package `files`.
16. The campus fallback without WebGL is one pre-rendered image per building type (also CC0-derived and listed in the manifest).

**Phase 4b, Packs**

17. Pack format: members up to 24, zones beyond the current 5 (verify, ship, plan, ops, data, legal), and an optional `taskType` list used to route tasks to an office.
18. Nine new packs, all tool-agnostic and stricter-only: `autonomous-dev`, `verification`, `security`, `release`, `docs`, `data-integrity`, `devops`, `domain-engineering`, `legal-compliance` (`product-discovery` is optional). The core team is a pack `core-team`; every core agent has an explicit `zone:` line before `labels.fa.json` is removed.
19. Packs install, update and remove like the existing ones; an edited member is kept on update.

### 16.3 Edge cases

- Old company files with `*Fa` keys load; the keys are not written back. Old files without `campus.json` show the derived layout; the first placement creates the file.
- Crash between temp write and rename leaves the old file intact and a stray temp file that is cleaned at next start.
- Two lots requested at the same cell: the second placement is refused with the reason.
- Very many buildings (200) and runs (50 of one type): the page stays usable; extra figures collapse to a count.
- Long names and right-to-left names are cut at a fixed width with an ellipsis.
- No WebGL: static fallback, no error.
- A shipped asset removed from disk: the building shows a plain placeholder, the test fails.

### 16.4 Phase plan

| Phase | Content | Depends on | Worktrees | Tier |
|---|---|---|---|---|
| 2a, 2b | in progress | | | |
| H | rules 1-6 | 2a | 2 (storage and bug fixes; test tiers and module split) | High (stored data) |
| 3 | Version run page (section 7) | H | 1 | Medium |
| 4 | rules 7-16; sub-steps 4.1 data and write path, 4.2 assets and manifest, 4.3 three.js campus and Build mode, 4.4 figures, avatar, overlap | H, 3 | 2 | High (stored data), visual-qa |
| 4b | rules 17-19 | 4.1 | 2 (pack format and core team; new packs) | High (pack format) |
| 5 | dry run per section 13 step 9, on a throwaway repo | 4b | 1 | Medium |
| 6 | review, README and CONTRIBUTING trimmed, regenerated screenshots, docs-explainer recap | 5 | 1 | Low |

Owner gates unchanged: no asset file is committed before its licence has been re-verified and recorded; release stays a gate.

### 16.5 Acceptance tests

H1. Given two processes writing the same `employees.json` 200 times each, then the file always parses and no update is lost.
H2. Given a kill between temp write and rename, then the old file is intact and the dashboard still shows the run.
H3. Given `npm test`, then no browser starts and it ends in under 3 minutes; given `npm run test:ui`, then at most 2 Chrome instances run at once and a launch timeout is retried once.
H4. Given the split page builders, then output HTML equals the stored pre-split output, and no builder file exceeds 800 lines.
H5. Given the demo data, then the Team page shows no existing office as "not set up"; Archive tokens equal the board total; "Unassigned work" shows "n/a"; org chart names show an ellipsis; Tasks shows a loading state first (visual-qa at 1366 and 1920).
H6. Given `arsenale demo --no-open > out.txt`, then `out.txt` contains the key URL within 5 seconds and the command can be stopped by its PID.
H7. Given a task, a question and a run typed in a right-to-left language (fixture built from escapes), then they are stored as typed, shown with `dir="auto"`, start at the same edge as English in tasks, approvals, activity, decisions (visual-qa); and a repo search finds no right-to-left-language text in shipped files except the two name-normalisation helpers, written as escapes.
C1. Given a company file with `nameFa` keys, then it loads and the next save contains none of them.
C2. Given `campus.place` onto an occupied cell, an out-of-grid cell, or by an agent through MCP for `remove`, then it is refused and nothing changes.
C3. Given the supervisor places an office in an autonomous run, then a decision with the reason is on the timeline and the user can move or remove the building.
C4. Given 3 parallel runs of one agent type, then 3 figures at 3 desks with own bubbles and the title "x3"; when one ends, only its figure leaves (visual-qa).
C5. Given 14 agents at 1366x768 and 1920x1080, then no bounding boxes of labels, bubbles, boxes and avatars intersect (DOM check plus an opened screenshot) and the right-hand project cards are unchanged.
C6. Given a file under `assets/` without a manifest entry, or with a non-CC0 licence, or a changed hash, then the test fails.
C7. Given WebGL disabled, then the campus shows the static fallback for every building type.
C8. Given a campus with the 12 office types, then each type is visually distinct (visual-qa), not one shape with a different colour.
P1. Given the install of all packs, then `core-team` and the 9 new packs install, update and remove; an edited member is kept; every member has a `zone:`.
P2. Given a task with `taskType` "security review", then it is routed to the security office, or shown unrouted when none exists.
R1. Given the final repo, then no shipped file contains `labels.fa.json`, `*Fa` writes, `LANG === 'fa'` branches or `-fa` screenshots (code review plus search).
