---
"@jspsych/metadata-cli": minor
---

Convert jsPsych JSON data files to CSV so generated projects pass the Psych-DS validator. When processing a directory, each `.json` data file is now written as a `.csv` in `data/` (nested objects/arrays serialized as JSON strings via `objectsToCSV`, so no data is lost), with the untouched original preserved under `data/raw/`. The project scaffold creates the `data/raw/` directory, `.csv` inputs are copied through unchanged, and `dataset_description.json` is left untouched. Same-named source files are skipped rather than silently overwritten.
