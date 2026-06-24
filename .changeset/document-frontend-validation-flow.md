---
"frontend": patch
---

Document the frontend's in-browser Psych-DS validation flow and the JSON→CSV data-conversion pipeline. Adds "Data conversion pipeline" and "In-browser validation" sections to `docs/dev/frontend-architecture.md` (covering `validatePsychDS`, the `WebFileTree` build, the `schema: 'latest'` choice, `ValidationUnavailableError`, and the zip-resolved README/CHANGES warnings), and notes in the user README explaining that JSON data is converted to Psych-DS CSV (originals kept under `data/raw/`) and what the in-browser validator reports. Documentation only — no behavior change.
