---
"@jspsych/metadata-cli": patch
---

Deduplicate directory traversal logic in data.ts. Extracts a shared `collectDataFiles` helper used by `processDirectory`, `enumerateDataFiles`, and `preAnalyzeDirectory`, replacing three near-identical implementations of the top-level + one-subdir-deep walk. Behavior is preserved: `processDirectory` still sorts `dataset_description.json` first and counts directory read errors as failures. Diagnostics (the "can only read subdirectories one level deep" warning and directory-read errors) are gated behind a `warn` flag that only `processDirectory` sets, so the silent pre-passes (`enumerateDataFiles`, `preAnalyzeDirectory`) don't duplicate warnings the user already sees once on the same directory in the same run.
