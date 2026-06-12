---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
---

Extend the stress-test regression guards with three more Jest suites covering the CSV ingestion path, generation at scale, and cross-file output-name collisions.

- `@jspsych/metadata` — `csv-input.stress`: pins how `generate(data, {}, "csv")` re-infers types from string cells (numeric coercion incl. whitespace/scientific-notation/`Infinity`/`NaN` rejection, mixed-column downgrade, `"true"`/`"false"` staying categorical, RFC-4180 quoting, unicode, empty/literal-`null` cells, the 50-char level cap, JSON-in-a-cell extraction), and asserts CSV/JSON parity for unambiguously-typed columns.
- `@jspsych/metadata` — `scale.stress`: feeds a 5,000-row dataset and checks exact numeric extremes, categorical dedup, high-cardinality level accumulation, boolean handling, and a throughput ceiling that guards against accidental O(n²) regressions.
- `@jspsych/metadata-cli` — `array-collision.stress`: two same-stem files in different subdirectories sharing a nested array column, asserting `processDirectory` disambiguates every main CSV, sidecar, and preserved raw original (no overwrites, all still Psych-DS compliant) — the cross-file collision gap left by the earlier rename suite.

Test-only change; no library or CLI behavior is modified.
