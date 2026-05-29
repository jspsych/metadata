---
"@jspsych/metadata": minor
"@jspsych/metadata-cli": minor
---

Detect and expand JSON-serialized nested columns in `generate()`. Flat JSON objects (e.g. `response: {"Q0":4,"Q1":3}`) are expanded into dotted sub-variables (`response.Q0`, `response.Q1`) in `variableMeasured` with correct types and min/max tracking. JSON arrays of objects are extracted into separate Psych-DS compliant CSV files (`{stem}_measure-{col}_data.csv`) with `trial_index` and `element_index` as join keys.
