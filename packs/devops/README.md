# DevOps office pack

Explain red builds, find the cause of a build failure and check a working environment. Works from logs given to it.

The pack adds one office with 4 members of its own. Give the lead (`devops-lead`) a goal in plain words.

## Members

| Id | Title | What they do |
| --- | --- | --- |
| `devops-lead` | DevOps Lead | Leads the devops office: turns a red build or a broken setup into tasks for the team by name and reports the cause |
| `ci-triager` | CI Triager | Reads a failed build log and says which step failed and why |
| `build-fixer` | Build Fixer | Proposes the smallest change that fixes a build failure and the check that proves it |
| `environment-doctor` | Environment Doctor | Compares a machine setup with what the project needs: versions, folders, ports and paths |

## Sample tasks

1. **Explain an invented failed build** (for `ci-triager`): Read the invented build log I name and say which step failed, why, and quote the proving line.
2. **Compare two invented setups** (for `environment-doctor`): Compare the two invented setup listings I name and name the first difference that matters.

## Limits

- Members prepare drafts and reports. They never send, post, pay or publish; Arsenale asks before any such step.
- A pack can only make the rules stricter.
