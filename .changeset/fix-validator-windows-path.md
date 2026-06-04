---
"@jspsych/metadata-cli": patch
---

Fix Psych-DS validation always failing on Windows. The relative path passed to the validator contained backslashes on Windows, which the validator could not resolve — causing spurious MISSING_DATAFILE and MISSING_DATASET_DESCRIPTION errors even when the project was generated correctly. Normalize path separators to forward slashes before validation.
