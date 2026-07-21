---
"@jspsych/metadata-cli": patch
---

The CLI and web wizard now preserve the untouched original under `data/raw/` whenever the Psych-DS output is not a verbatim, same-named copy of the input — not just for JSON. This now also covers CSV inputs that were **renamed** to a Psych-DS-compliant name (e.g. `mydata.csv` → `subject-x_data.csv`) and CSV inputs that had to be **re-serialised** (malformed quotes repaired). A clean CSV written byte-for-byte under its own compliant name is the only case with no separate raw form, so nothing is duplicated. The existing flat-directory disambiguation and root `.psychds-ignore` (so the validator skips `data/raw/`) apply to these preserved CSVs too.
