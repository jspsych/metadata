---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
---

fix(metadata,cli): strip a leading UTF-8 BOM from CSV input

CSVs exported by Excel (and similar tools) begin with a UTF-8 BOM (U+FEFF).
The shared `parseCSV` previously folded that BOM into the first header,
producing a corrupted variable name like `﻿Participant_ID` that is not valid
Psych-DS. `parseCSV` now passes `bom: true` to `csv-parse` so the first
variable is named exactly as written (e.g. `Participant_ID`).

The CLI also strips a leading BOM from the file content before writing the
data file into the Psych-DS `data/` directory. A clean CSV is written
verbatim, so without this the persisted file would keep a BOM-prefixed first
column that no longer matches the BOM-stripped variable name in the metadata,
failing validation with `CSV_COLUMN_MISSING_FROM_METADATA` and
`VARIABLE_MISSING_FROM_CSV_COLUMNS`. Surfaced by the OSF lip-kinematics
validation dataset (osf.io/9v4t6).
