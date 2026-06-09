---
"@jspsych/metadata": minor
"@jspsych/metadata-cli": minor
---

Extract plain (non-array) object columns into separate Psych-DS CSV files so their expanded sub-variables resolve to real columns. `expandObjectFields` registers dotted sub-variables for object columns (e.g. `response.cb_1`, `calibration_data.type`), but those names previously had no corresponding CSV column, so Psych-DS validation reported `VARIABLE_MISSING_FROM_CSV_COLUMNS` for every one. Object columns are now accumulated into a new `extractedObjects` map (exposed via `getExtractedObjects()`) as one row per trial, and the CLI writes a per-file sidecar CSV (`{stem}_measure-{col}_data.csv`) — mirroring the existing array-of-objects extraction. The row is threaded through the recursive expansion so a column is recorded for every registered descendant (leaf scalars, intermediate object nodes, and nested-array parents), and it reuses the same configurable `arrayJoinKeys` (one row per trial, no `element_index`).
