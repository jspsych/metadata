---
"@jspsych/metadata-cli": minor
---

Convert jsPsych JSON data files to CSV and normalize all generated data filenames to the Psych-DS `[keyword-value_]+data.csv` pattern, so generated projects pass the Psych-DS validator.

- Each `.json` data file is converted to a `.csv` in `data/` (nested objects/arrays serialized as JSON strings via `objectsToCSV`, so no data is lost), with the untouched original preserved under `data/raw/`. The project scaffold creates the `data/raw/` directory, and `dataset_description.json` is left untouched.
- Output filenames follow the Psych-DS naming pattern. Already-compliant names are kept; for non-compliant ones the CLI prompts once for a keyword (official keywords offered to avoid validator warnings; custom keywords allowed), with the file's current name becoming the value (camelCased, since Psych-DS values forbid hyphens/underscores). The same normalized base names the converted/copied CSV and its extracted-array CSVs, fixing previously invalid extracted-array names.
- Same-named source files from different subdirectories are kept and disambiguated with a validator-safe counter — both the CSV in `data/` and the original in `data/raw/` — instead of being skipped or silently overwritten. Non-interactive runs fail with a clear message rather than inventing a keyword.
