---
"frontend": minor
---

Add in-browser Psych-DS validation to the Review step. A "Validate dataset" button runs the official `psychds-validator` web bundle directly in the browser against the generated `dataset_description.json` and the uploaded data files, showing a pass/error/warning report inline instead of only pointing users to the CLI. The validator bundle is code-split and lazy-loaded on first use, and the command-line instructions remain available as a fallback.
