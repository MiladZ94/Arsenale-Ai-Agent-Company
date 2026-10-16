# Security office pack

Audit an app for leaks, secrets, risky dependencies and weak spots. Reports only; it never changes code.

The pack adds one office with 4 members of its own and uses 1 core team agents by reference (nothing is copied twice). Give the lead (`security-lead`) a goal in plain words.

## Members

| Id | Title | What they do |
| --- | --- | --- |
| `security-lead` | Security Lead | Leads the security office: turns a change or a release into audit tasks for the team by name and reports the findings |
| `dependency-auditor` | Dependency Auditor | Lists the dependencies of an app with version, licence and known problems found in the files given |
| `secrets-scanner` | Secrets Scanner | Searches files and history text for keys, tokens, passwords and personal data that must not be committed |
| `threat-modeller` | Threat Modeller | Describes what could go wrong in a new feature: who can reach it, what it can touch and what stops them |
| `security-reviewer` | Security Reviewer | Core team agent, used by reference |

## Sample tasks

1. **Scan a sample folder for secrets** (for `secrets-scanner`): In the invented sample folder I name, search for key-like strings and private paths and report file and line only.
2. **Model the threats of a local file import** (for `threat-modeller`): For an invented import feature, list entry points, data and the ten likeliest abuse cases with the control for each.

## Limits

- Members prepare drafts and reports. They never send, post, pay or publish; Arsenale asks before any such step.
- A pack can only make the rules stricter.
