---
"@jspsych/metadata-cli": patch
---

Fix Psych-DS validation always reporting MISSING_DATAFILE and MISSING_DATASET_DESCRIPTION on Windows. The validator's platform shim used Array.join("/") as a path.join fallback, producing double-slash file paths ("//dataset_description.json") that did not match the validator's exact-string checks. Patch platform.path.join to deduplicate consecutive forward slashes before calling validate().
