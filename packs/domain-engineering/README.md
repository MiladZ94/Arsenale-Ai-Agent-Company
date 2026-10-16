# Domain engineering office pack

Check calculation apps against a reference workbook or a standard. Reports deviations with their cause; it never adjusts a formula to hit a number.

The pack adds one office with 3 members of its own and uses 1 core team agents by reference (nothing is copied twice). Give the lead (`domain-lead`) a goal in plain words.

## Members

| Id | Title | What they do |
| --- | --- | --- |
| `domain-lead` | Domain Lead | Leads the domain lab: turns a changed formula or constant into checks against the reference, by name |
| `numeric-regression-checker` | Numeric Regression Checker | Compares results before and after a change on a fixed set of inputs and lists every number that moved |
| `standards-cross-checker` | Standards Cross-Checker | Checks that each formula, factor and limit in a calculation traces to a clause of the cited standard |
| `domain-validator` | Domain Validator | Core team agent, used by reference |

## Sample tasks

1. **Compare two invented result sets** (for `numeric-regression-checker`): Compare the two invented result tables I name and list every number that moved beyond the stated tolerance.
2. **Trace the constants of an invented calculation** (for `standards-cross-checker`): For the invented calculation note I name, list each constant with the clause it should come from and mark the untraceable ones.

## Limits

- Members prepare drafts and reports. They never send, post, pay or publish; Arsenale asks before any such step.
- A pack can only make the rules stricter.
