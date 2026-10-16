# Planning checklist

Ask these before a run starts. Batch the questions, give each its options and a
recommended default, and record every answer as a decision.

1. Scope: which requests are in this version, and which are explicitly out?
2. Users and roles: who uses the changed parts; are there restricted roles?
3. Stored data and compatibility: does anything saved change; must older
   releases still open new files?
4. Security surface: keys, licences, permissions, IPC, imports, exports.
5. UI needing mockups: list every new screen so the owner picks in one sitting.
6. Owner gates: confirm the list in PROJECT.md "Owner gates (autonomous mode)".
7. Test suites and baseline: which suite runs when; what already fails.
8. Budget: show the estimate per phase plus the fix-round reserve; the owner
   may change it.
9. Release steps: what happens after the run (always an owner decision).
10. Run authorisation: the owner says in his own message that the run may start.
