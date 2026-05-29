---
"@jspsych/metadata": patch
---

Fix always-empty columns being silently dropped from variableMeasured. Columns whose values are null or empty across all rows in a dataset now appear in variableMeasured with a minimal `"value": "unknown"` entry, satisfying the Psych-DS requirement that every CSV column header has a corresponding entry.
