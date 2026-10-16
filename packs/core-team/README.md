# Core team pack

The 24 core agents of the repo `agents/` as a pack: install, update and remove like any other. Default for a new company. The definitions are read from `agents/`, not copied into the pack; a member that already exists in your agent folders is kept as it is.

`seo-specialist` is not in this pack (the maximum is 24 members); it ships in `content-marketing`.

## Members

| Id | Title | What they do |
| --- | --- | --- |
| `agent-builder` | Agent Builder | Writes a new specialist agent definition, or repairs one that triggers at the wrong times or gives bad instructions |
| `architecture-reviewer` | Architecture Reviewer | Judges the health of a whole app, not one diff |
| `code-reviewer` | Code Reviewer | Reviews uncommitted changes for real defects and for anything that must never be committed, such as keys, licences or personal data |
| `data-migration` | Data Migration | Checks that a change keeps saved data compatible across app versions |
| `dev-docs` | Dev Docs | Brings an app's developer documentation back in line with the code after a change has landed in the working tree |
| `docs-explainer` | Docs Explainer | Writes the plain-language explanation of a finished change for the user, in the user's language, and a short one-off hand-over note for the app's own users |
| `domain-validator` | Domain Validator | Checks that an engineering or calculation app computes the right numbers, by comparing it with a reference workbook, a company report or a standard (for example a loan-interest table, a dosage chart or a structural beam check) |
| `engineering-lead` | Engineering Lead | Head of the Engineering office (the apps and services where correctness is checked against a reference: back ends, calculation engines, data pipelines, file formats) |
| `feature-scout` | Feature Scout | Acts like an experienced product manager who is also a senior user of engineering software |
| `finding-verifier` | Finding Verifier | Re-checks every finding that reviewers reported against the actual code and the diff, and drops false positives |
| `implementer` | Implementer | Builds a change that has already been decided, such as a feature, a fix or a refactor, from a written spec or tech plan |
| `office-lead` | Office Lead | Plans and reviews the work of one office (a group of related projects) for the supervisor |
| `performance` | Performance | Measures how fast the app really is with large data and finds the hotspots with evidence |
| `product-lead` | Product Lead | Head of the Product office (the apps and websites people use directly, where new UI is designed before it is built) |
| `release-builder` | Release Builder | Builds and verifies the Windows installer for an Electron app at a version that has already been decided |
| `release-manager` | Release Manager | Plans and keeps track of a release |
| `research-lead` | Research Lead | Head of the Research office (spikes, trials and experiments: questions to answer before anyone builds) |
| `security-reviewer` | Security Reviewer | Audits an app's security and privacy in depth |
| `spec-writer` | Spec Writer | Turns a short request, a reference screenshot or a forwarded client message into a precise spec that an implementer can build without guessing |
| `tester` | Tester | Writes and runs the automated tests for the app in the current repo |
| `ui-designer` | Ui Designer | Produces two or three genuinely different design directions for a new screen, dialog or flow, as static HTML artboards that the supervisor publishes to a Design canvas for the user to choose from |
| `user-guide` | User Guide | Brings an app's end-user guide (the PDF or HTML manual that office or field users read) up to date with a new version |
| `ux-reviewer` | Ux Reviewer | Judges how hard a feature is to actually use, from the seat of the person using it |
| `visual-qa` | Visual Qa | Launches the REAL app, clicks through it like a user, takes screenshots and compares them with the chosen mockup or the spec |
