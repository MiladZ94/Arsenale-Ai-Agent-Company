# Release office pack

Prepare a release: version, notes, build record and an install check. It never pushes, tags or publishes.

The pack adds one office with 3 members of its own and uses 2 core team agents by reference (nothing is copied twice). Give the lead (`release-lead`) a goal in plain words.

## Members

| Id | Title | What they do |
| --- | --- | --- |
| `release-lead` | Release Lead | Leads the release office: turns a ready version into a checklist for the team by name and reports what is left |
| `release-notes-writer` | Release Notes Writer | Writes the changelog entry and release notes from the merged work, in plain words |
| `install-tester` | Install Tester | Writes and checks the install steps of a build on a clean machine from the logs and files given |
| `release-manager` | Release Manager | Core team agent, used by reference |
| `release-builder` | Release Builder | Core team agent, used by reference |

## Sample tasks

1. **Write release notes for a small version** (for `release-notes-writer`): From the invented list of merged requests I name, write the changelog entry and the short release notes.
2. **Write the install check for a new build** (for `install-tester`): For an invented desktop build, list the install, run and uninstall steps with the expected result of each.

## Limits

- Members prepare drafts and reports. They never send, post, pay or publish; Arsenale asks before any such step.
- A pack can only make the rules stricter.
