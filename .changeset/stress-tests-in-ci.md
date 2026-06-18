---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
---

Add stress-test regression guards to the automated suite so previously-fixed nested-data and filename-normalization behavior can't silently regress.

Four Jest suites, ported from the standalone `stress-tests/` harnesses so they run under plain `npm test` (and CI) without a build step:

- `@jspsych/metadata`: `generate()` coherence over a comprehensive nested-data fixture (deep objects, arrays of objects/arrays, mixed-type columns, a `trial_type`-less row, unicode, empties), plus the Psych-DS filename-normalization helper invariants.
- `@jspsych/metadata-cli`: the `processDirectory` conversion end-to-end (compliant main CSV, `data/raw/` preservation, two-way `variableMeasured` ↔ CSV-column cross-check, and a best-effort Psych-DS validation pass), plus the refusal to write a non-compliant filename non-interactively.

Test-only change; no library or CLI behavior is modified. The shared fixture lives at `dev/stress/`.
