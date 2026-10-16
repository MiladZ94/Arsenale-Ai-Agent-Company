# Arsenale

**Run a company of AI agents you can watch at work.**

A local dashboard and run log for AI assistants (Claude Desktop, Claude Code,
Cursor, Codex, Gemini CLI, Aider, your own scripts). The assistant logs what it
does; Arsenale draws it as an office, a campus, an org chart and a list of the
questions waiting for you. It watches; it never runs agents.

[![Walkthrough](docs/media/arsenale-walkthrough.gif)](docs/media/arsenale-walkthrough.mp4)

[Watch the walkthrough](docs/media/arsenale-walkthrough.mp4) (MP4, no sound)

![Org chart](docs/screenshots/org-chart.png)

![The campus](docs/screenshots/campus-en.png)

## Quick start

Needs [Node.js](https://nodejs.org) 20 or newer and git.

```
git clone https://github.com/emadbarandan/Arsenale.git
cd Arsenale
node bin/arsenale.cjs demo
```

`demo` shows an invented company in a temporary folder and never touches your
data. `demo --shop` shows a small shop with office packs.

To install it, run the installer (it asks before every change; `--dry-run`
shows the plan):

| | Command |
|---|---|
| Windows | `powershell -ExecutionPolicy Bypass -File .\install.ps1` |
| macOS, Linux, Git Bash | `./install.sh` |

Then:

```
arsenale serve      # http://localhost:4310, opens your browser with your key
arsenale open       # open the running dashboard again
```

## Connect your assistant

Open **Settings, Assistants** on the dashboard: each tool has a card with the
exact command and a **Test** button. Adapters for each tool are in
[adapters/](adapters/).

## Good to know

- Local only: JSON files in `~/.arsenale`, a server on `127.0.0.1`, no
  accounts, no telemetry.
- Safety rules (`policy.json`) are advisory: your assistant is asked to check
  before an outside action, and you approve on the dashboard.
- `arsenale --help` lists every command.
- Uninstall: `install.ps1 -Uninstall` or `./install.sh --uninstall`.

More: [full reference](docs/reference.md), [CONTRIBUTING](CONTRIBUTING.md),
[SECURITY](SECURITY.md). Version 1.0.0. License: [MIT](LICENSE).
