---
"@jspsych/metadata-cli": patch
---

Deduplicate directory traversal logic in data.ts. Extracts a shared `collectDataFiles` helper used by `processDirectory`, `enumerateDataFiles`, and `preAnalyzeDirectory`, replacing three near-identical implementations of the top-level + one-subdir-deep walk. Behavior is preserved: `processDirectory` still sorts `dataset_description.json` first and counts directory read errors as failures. Two side effects from consolidation (flagged for explicit sign-off): the "can only read subdirectories one level deep" warning now also fires in `enumerateDataFiles` and `preAnalyzeDirectory` (previously only in `processDirectory`); and a top-level directory read failure in those two functions now emits `console.error` (previously they returned `null`/`[]` silently).
