---
"@jspsych/metadata": patch
---

Register jsPsych system variables (`trial_type`, `trial_index`, `time_elapsed`, `extension_type`, `extension_version`) lazily instead of seeding them in the `VariablesMap` constructor. They now appear in `variableMeasured` only when their column is actually present in the data. Previously `time_elapsed` (and the others) were always emitted, so any dataset whose CSVs omit `time_elapsed` — common for processed/aggregated jsPsych exports — failed Psych-DS validation with `VARIABLE_MISSING_FROM_CSV_COLUMNS`. Datasets that do contain these columns are unaffected.
