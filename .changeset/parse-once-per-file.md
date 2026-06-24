---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
---

Parse each data file once instead of twice. `JsPsychMetadata.generate()` now accepts data that is already a parsed array of observations (not just a JSON/CSV string); when given an array it skips parsing, and the caller can pass `synthesizedSourceRecordId` so the synthetic-id description is still applied. The CLI's `processDirectory`/`processFile` now parse a file a single time and hand the rows to `generate()` and to the Psych-DS CSV builder, rather than parsing once for metadata and again for conversion. No change to generated metadata or output files; this reduces CPU and peak memory on large datasets (e.g. multi-MB jsPsych/Tobii exports). Spun out of #95.
