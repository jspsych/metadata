---
"@jspsych/metadata": minor
"@jspsych/metadata-cli": minor
---

Register array-of-objects element fields in `variableMeasured` so extracted sidecar CSVs have no undeclared columns. Previously `accumulateArrayColumn` wrote each element's fields as bare columns (e.g. `x`, `y`) plus `element_index` into the extracted-array CSV, but never added them to `variableMeasured`, so Psych-DS validation reported `CSV_COLUMN_MISSING_FROM_METADATA`. Element fields are now emitted under dotted names (`tobii_data.x`, `validation_data.pointData.point`) — avoiding collisions between same-named fields of different array columns — and each is registered with its correct type and min/max/levels tracking. `element_index` is registered once. Object- and array-valued element fields are recorded one level deep (a single dotted JSON column, `value:"object"`/`"array"`); they are not further expanded or extracted. This is the array-side counterpart to the plain-object sidecar fix and completes Psych-DS column/variable round-tripping for nested data.
