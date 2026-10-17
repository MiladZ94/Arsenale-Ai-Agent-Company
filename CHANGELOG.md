# Changelog

All notable changes are listed here. Versions follow
[Semantic Versioning](https://semver.org).

## Unreleased

- **One look for every person (owner feedback).** Team, Tasks, Approvals, Finished work, the org chart, the wizard and the office packs no longer draw pixel-art people: every member is the same Kenney Mini Characters figure as at the desks in the office, as a small round portrait tinted in the office colour with an initials badge (the same two letters as the badge above a desk; the badge is drawn, not text). The pictures are rendered headlessly from the shipped CC0 models by `tools/render-portraits.cjs` into `tools/assets/portraits/` (manifest entries `portrait:front|left|right|desk`, CC0, derivation noted); with no picture a round head on a coloured body is drawn, and the assistant is a flat round robot. The Team screen has no 3D or iso room any more: each office is a flat floor with the office's checkerboard and one card per member showing the Kenney desk picture, a name, a status and the initials badge (the lighter option: no second 3D scene on a list screen). The wizard's office rows lose their left colour bar. Golden hashes: the two live pages grow by 122,447 bytes (the four embedded pictures) and the two non-live office pages shrink by 691 (the pixel-art code is gone); the archive pages did not move.
- **Short labels above the desks (owner feedback).** Above each desk there is now only a short name (at most 14 characters, never an ellipsis: "Data migration", "Release mgr", "Security rev"), placed clear of the head, the badges and other labels; the step and the full name show as a tip on hover or focus of the figure or its label, and stay in the side list. The desk grid is a little wider (2.4 x 3.6) so the labels fit. The office layout test now also checks label to head and label to label spacing and that no label is truncated, at 1366 and 1920. The office picture in the README and the office frames of the walkthrough GIF are re-recorded; the four page golden hashes that inline the world code changed (+2612 bytes each), the archive pages did not.
- **An open campus and an open office (owner feedback on the media).** The campus is one continuous flat checkerboard like a build grid: no trees, no raised slab, no tile with a border per lot; a lot's outline shows only in Build mode. A building's title is a small pill on the ground, put on the nearest spot that covers no building and no other title (a short leader line joins it to its lot when it had to move), and it carries the number of agents working there now ("Engineering · 3") and a "waiting" count only when something waits. The office has no rooms and no walls: one open checkerboard floor with the desks in a clean grid, each on a light tile in its zone colour with a "name · step" label over the figure (N runs of one agent are N desks), and one free area with a sofa and chairs where all idle agents sit, labelled "N idle". Tests keep every title off every building and off every other title at 1366 and 1920 wide. README media re-recorded.
- **Real campus buildings, furniture and people; a white checkerboard theme; new README media.** The 12 office types now use 12 different CC0 models from Kenney's City Kit (Commercial, Industrial, Suburban), so the campus mixes offices, factories, a water tower and houses; the office floor uses Kenney's Furniture Kit (desk, chair, screen, sofa, plant) and one Mini Characters figure sits at every desk, with the zone-colour initials badge and the number badge above the head. The asset manifest takes `building:<type>`, `furniture:<name>` and `character:<style>`; the shapes in code stay as the fallback. The campus lots and the office rooms are two-tone checkerboards on a white page again (not green grass), and a building's label stands on its own roof. Models are in `tools/assets/kenney/` (about 2 MB, licence texts in `tools/assets/licenses/`). Every README and `docs/screenshots/` image and the walkthrough GIF are re-recorded from `arsenale demo`.
- **Security hardening.** CLI actions that claim `"by":"board"` (campus, budgets, approvals, gate answers) need the owner's launch key in `ARSENALE_BOARD_TOKEN` (or `--board-token`); without it they act as an agent and board-only actions are refused. Supervisor campus edits need an active version run whose process is alive or that was updated in the last 30 minutes. `arsenale init` skips a symbolic link at a destination instead of writing through it.
- **Autonomous version runs.** `arsenale init` sets up agents, skills, PROJECT.md and the autonomous files; `arsenale autonomous start|status|resume <version>` keeps the state file and its mirror; a Version run page shows phases, token budget, agents, owner gates and review reports (a run selector when more than two runs are active). Run records carry optional `versionRun`, `phase`, `pid` and `tier`; a 4th heavy-tier run at once is refused, and `resume` closes runs whose process is gone. `arsenale awake` holds a Mac or Linux machine awake. The essential rules ship as `autonomous/RULES.md`. A version must look like `1.2` or `1.2.3-beta.1`.
- **Header and office.** The top bar fits at 1366 wide ("Live" with the interval as a tooltip), the office strip and the lounge show one idle count, and no label touches a desk.
- **Dry-run fixes.** `arsenale init --dry-run` shows the whole plan and a declined `init` writes nothing (not even `docs/specs`); `arsenale campus --help` (and the other short modes) print the help; `--version-run` takes a `reviews` list for the Version run page; a gate or decision can name its run with `versionRun`; a supervisor campus change needs a reason and is listed under its run; the round cap and the slow-suite note are in the autonomous rules; waiting-question and phone callouts lose the thick left stripe.
- **Campus builder and a calmer office (design C2).** The campus is a board of lots
  drawn in 3D from code: 12 building types, a Build mode with a hotbar (keys 1 to 9),
  move, rotate and archive tools, a ghost building and a "Lot taken" refusal. The
  layout is `company/campus.json`; an older company is laid out as before and nothing
  is written until the first change. `arsenale campus` lets the supervisor place and
  move buildings in an autonomous run (each change is a decision). The office is
  walled zone rooms with one figure per run (two runs of one agent are two figures),
  a side list with the step and state, "N idle" in the lounge, one avatar style
  everywhere, state by shape as well as colour, and labels that never cover a figure
  or each other. No portrait cards and no character files any more. `tools/assets/`
  and `manifest.json` are ready for CC0 models; none ships.
- **One light theme everywhere**: the header, the panels, the waiting rail,
  the org chart, activity, archive, dialogs and the 1.0 screens.
- **English only.** The language switch, all other-language strings, data and
  files, and the `?lang=` and `dash-lang` cookie handling are gone; every page
  is English.
- three.js r184 is pinned in `tools/vendor/three/` and inlined into the page.
  The page's Content-Security-Policy now allows `blob:` images and fetches,
  which GLTFLoader uses for the textures of an asset model.
- Every font is Arial, in weights 400 and 700.

## 1.0.0 (2026-10-06)

First public release.

### For everyone
- **Redesigned 1.0 screens.** Tasks as a board (To do, Working on it,
  Waiting for you, Done this week) or a list, a new-task page and a task page;
  Approvals as one letter at a time (the question in plain words, what would
  happen, why it matters, if you say no, whether it leaves your computer);
  Finished work as a searchable gallery; Settings with Assistants, Phone
  alerts, Safety rules, Office packs and Privacy; the first-start wizard in
  four steps beside a campus that builds itself; Team as an office room with
  the profile and the new-desk form at its side; and a new org chart.
- People are shown by name: a member may have a name, things they are good
  at and a picked look (all optional, in employees.json); a title made from an
  id spells acronyms ("SEO specialist"). File ids, task numbers and tokens
  only under Details.
- `arsenale demo --shop`: the invented company as a small shop with four
  office packs and no developers.
- **MCP server** (`arsenale mcp`), with no dependencies: tools to say hello,
  start a job, log a step, finish with a plain summary, ask the owner, read
  answers and the inbox, read, create and move tasks, comment, register a
  deliverable, record a decision, check an action, check a budget, read the
  team and a member's brief, and propose a hire. Answers are read per client,
  so two assistants never take each other's answers. Optional MCP over HTTP on
  the dashboard (`/mcp`), off unless `ARSENALE_MCP_TOKEN` is set.
- **Connect your assistant** (Settings): per client the exact command, link or
  snippet (Claude Desktop, Claude Code; Cursor, VS Code, Codex CLI and Gemini
  CLI marked experimental), a Test button, and, only after you saw the change,
  the edit of that client's settings file with a backup. ChatGPT is not
  connectable (it needs a public server).
- **Tasks**: write a task on the dashboard (who it is for, due date, links,
  "I want to check it before it is done"); the assistant reads it in its inbox,
  moves it and comments. A job started for a task moves it to In progress.
- **Approvals** screen: questions, choices, hire proposals with the full
  instructions, and approvals for actions that leave the computer.
- **Team**: hire and edit team members with a 4-step form that shows the
  generated file before writing it; profile with allowed actions,
  instructions and history; every edit keeps a backup; retire and restore.
- **Office packs**: Content & Marketing, Research, Operations & Admin, HR,
  Finance, Customer support and Design (33 members), installed into
  `~/.arsenale/agents`, removed without touching files you changed.
- **Safety rules** (`policy.json`): each outside action (send, post, pay,
  delete, share, change accounts, other) is Allowed, Ask me first (the default)
  or Never, per member; `check_action` / `arsenale check-action`. Advisory, and
  the screens say so.
- **Deliverables** gallery: links, text, images and files registered by the
  team, copied into Arsenale's own store (only from the folders you allow,
  never a protected file), with previews.
- **First-start wizard** in the dashboard: company, offices from packs, how
  you pay for your assistant, budget, assistants, notifications, a review of
  every file it will create, then Connect.
- **Plain words**: a Today strip on the campus ("your team finished 7 jobs in
  2 h 05 min · 3 deliverables · 1 question waiting"); a finished job shows its
  summary and what was done first, then the time, then money only when it is
  real ("Included in your plan" on a monthly plan, never "$0").
- **Notifications**: browser notifications for a new question, a task waiting
  for you and budget alerts. Phone channels, **experimental**: ntfy and
  Telegram with signed, single-use, 30-minute Approve / Decline buttons
  (details mode only; never for payments), Pushover notify-only; secrets only
  from environment variables.
- New CLI modes `--task`, `--comment`, `--deliverable`, `--check-action`
  (aliases `task`, `comment`, `deliverable`, `check-action`).
- Not in 1.0 (help wanted, see CONTRIBUTING.md): a desktop app, update checks,
  email notifications, clients that need a public server.

### The product
- One name, Arsenale, for the command, the page and the package.
- Works with any coding agent: a neutral run log (`arsenale log`, with short
  aliases `start`, `progress`, `finish`, `gate`, `decision`, `answers`, …) and
  adapters for Claude Code, OpenAI Codex CLI, Gemini CLI, Cursor, Aider and
  plain scripts (`adapters/`).
- Data lives in one folder, `~/.arsenale` (or `ARSENALE_HOME`), never next to
  the code. Agent folders and transcript folders are configurable
  (`config.json`, or `ARSENALE_AGENT_DIRS` / `ARSENALE_TRANSCRIPT_ROOTS`).
- `arsenale demo`: the dashboard on an invented company, in a temporary
  folder, without reading or writing your data.
- `arsenale serve --port N --no-open`; complete `--help` and documented exit
  codes for the launcher and the run log.
- Activity screen: company log lines and the history derived from runs,
  questions and decisions, grouped by day, with filters.
- Desks are generated for any list of agents (by a `zone:` line or the
  agent's name) instead of a fixed list of names.
- Bundled team: 20 specialists, an office lead and three heads
  (`engineering-lead`, `product-lead`, `research-lead`); rules and workflow in
  English, with "the user's language" instead of a fixed one; model tiers
  (heavy, standard, light) instead of fixed model names.
- Model prices ship empty; "heavy" models for the usage split are configurable
  (`heavyModels`).

### Security
- Every response forbids framing (`X-Frame-Options: DENY`,
  `frame-ancestors 'none'`); the HTML has a Content-Security-Policy whose only
  allowed script is the page's own, by a nonce made per response.
- `esc()` in the pages also escapes `'`.
- The finish record's file name is built from a parsed date and a cleaned
  agent name: no path traversal, no NTFS streams.
- JSON input by `--stdin`, `--file` or `@file`, documented everywhere instead
  of inline JSON in single quotes (which a quote in the text could break out of).
- Bad JSON gives one sentence and exit 1, never a stack trace.
- Transcript paths are read only inside the configured transcript roots.
- Ids from files and requests are matched as own keys only (`constructor`,
  `__proto__` and the like are not employees).
- One write library (`tools/runlog.cjs`) behind the three doors, with the
  actor fixed by the door: the page writes as the owner, MCP as the assistant,
  the CLI as its JSON says (unchanged). Owner-only work is refused in the
  library for every other actor. The CLI's output is byte-for-byte what it was.
- MCP over HTTP: Host, Origin and bearer-token checks, 20 calls a second,
  64 KB bodies (7 MB for a deliverable), sessions that expire after an hour.
- The hire form generates the frontmatter itself (typed text cannot add a
  key), refuses ids that change when cleaned and names Windows reserves, and
  writes only into Arsenale's own agent folder unless you confirm another
  tool's file.
- Deliverables: realpath inside the allowed folders, secret-path patterns,
  size and type limits, first-byte checks for images, no SVG or HTML; stored
  copies served with `nosniff` and `Content-Security-Policy: sandbox`; the
  page's `img-src` allows only that path.
- Phone buttons: HMAC-SHA256 over the gate, decision, expiry, a 128-bit nonce
  and a hash of the question; single use; "Sign out all phones" invalidates
  every button sent.

- **The owner's key.** The dashboard opens only with a random key kept in a
  file only your account can read (`launch-key` in the data folder, mode 0600;
  on Windows the launcher limits it to your user with `icacls`). `serve`,
  `demo` and the new `arsenale open` open `/?k=<key>`, which is exchanged for
  an HttpOnly, SameSite=Strict cookie required on every request; `/api/token`
  is gone. SECURITY.md has the threat model.
- Telegram pairs through a one-time `/start <token>` link (128 bits, 10
  minutes, 5 wrong tries), only from a private chat, and checks the sender.
- Phone buttons only for actions whose rule allows phone approval (never a
  payment) and for choices; never for hires or plain approvals.
- Connect keeps the settings file's mode, follows a symlink to the real file,
  and shows only the arsenale entry (other servers' secrets never reach the page).
- Deliverables give one reason for a file outside or missing, resolve Windows
  short names, refuse hard links, and stop at 5 GB.
- MCP: at most 32 HTTP sessions, batch items counted toward the rate limit
  (batches over 20 refused), refused-tool lines rate-limited, 50 open jobs per client.

### Performance
- `/api/state` and `/api/company` are cached until something they are made of
  changes on disk, carry an ETag, answer `304` with no body while nothing
  changed, and are gzip-compressed when the browser accepts it. Measured with
  350 invented runs: an idle tab went from about 1.1 MB per poll every 1.5 s
  (about 2.7 GB an hour, 0.7 s of server time per poll) to empty 304s
  (about 5 ms each); the first load went from 1.1 MB to 39 KB on the wire.

### Installer
- Windows PowerShell 5.1 safe (`install.ps1`) and POSIX (`install.sh`), same
  steps: asks before every change outside the data folder (`-Yes`/`--yes`
  accepts, `-DryRun`/`--dry-run` only prints); adds files next to yours instead
  of moving folders; backs up anything it overwrites; never edits a tool's
  settings file (the dashboard's "Connect your assistant" does, only after
  showing you the change and keeping a backup); `-Uninstall`/`--uninstall`
  removes what it added and puts back what it replaced.
