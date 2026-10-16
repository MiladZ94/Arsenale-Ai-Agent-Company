# REVIEW.md: <app name>

<!--
Copy this file to the root of the app's git repo as REVIEW.md (dev-docs can do
it). Reviewers and finding-verifier read it BEFORE the diff, so write what
"broken" means in THIS repo. Facts and examples, not wishes. Delete the hint
comments once a section is filled in. Use invented examples in any public repo.
-->

## What "broken" means here

<!-- Ranked, most serious first, one example each. -->
1. Data loss: <e.g. a field that is read but not written back on save>
2. A wrong result: <e.g. a total that differs from the reference sheet>
3. A crash on start or on opening a file
4. A permission bypass: <e.g. a restricted role can read a hidden column through export>
5. A file the previous release cannot open
6. A file missing from the package: <e.g. a new source file not in the build list>

## Never acceptable (always Important)

- <project-specific musts, e.g. "no change to a tax rate without the owner">
- A secret, licence, key or real personal record in a diff or a fixture

## Usually a Nit

- Style, naming, comments, small clarity changes that do not touch behaviour

## Known pre-existing issues

<!-- So reviewers do not report them again. One line each, with the file. -->
- <none known>

## Where to look first

<!-- Paths and risky modules. -->
- <e.g. `src/save/` (file format), `src/calc/` (results)>

## Checks that must show evidence

| Check | Command | A pass looks like |
|---|---|---|
| Tests | <e.g. `npm test`> | <e.g. "pass 120, fail 0"> |
| Build | <e.g. `npm run build`> | <exit 0, output folder exists> |
| Packaging | <e.g. `npm run test:package`> | <every source file is in the package list> |

A claim without this evidence ("should work") is itself a finding.

## Incident log

<!-- Each past slip-through and the test or rule that now catches it. -->
| Date | What slipped through | Caught now by |
|---|---|---|
| <YYYY-MM-DD> | <e.g. files missing from the build list broke the packaged build> | <e.g. a packaging test that fails when a source file is not in the list> |
