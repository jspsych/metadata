---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
"frontend": patch
---

Don't propose unnamed/whitespace-only-header columns as join keys. R's `write.csv` (default `row.names = TRUE`) prepends an unnamed row-index column (empty-string header) that is unique per row, so `analyzeJoinKeys` would offer it as a join-key candidate — and the headless resolver (`resolveJoinKeysNonInteractive`), picking the lexicographically-first sufficient column, could choose it (logging a confusing `added ""`). But `stripUnnamedColumns` (#114) drops that column from the written output, so the chosen key would then vanish from the extracted sidecar. `analyzeJoinKeys` now excludes empty/whitespace-only-header columns from candidate selection (the same predicate `stripUnnamedColumns` uses), so the resolver, the interactive prompt, and the frontend join-key chooser never propose a column that can't survive to the output. Fixes #117.
