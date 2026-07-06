---
"@jspsych/metadata": minor
---

Correctness and performance fixes: user-edited variable descriptions now survive `getMetadata()` (previously silently replaced by plugin text); `getMetadata()`/`getMetadataFields()`/`getList()` no longer mutate internal state; extension columns no longer crash `generate()` for CSV input or missing `extension_version`; plain-string descriptions in metadata options are accepted instead of being corrupted; `null` rows are skipped instead of crashing; sidecar CSV headers are escaped; numeric coercion only applies to round-trippable values (so `"007"` stays a string); `updateMinMax`/`updateName`/`updateLevels` edge cases fixed; plugin cache keyed by name+version+extension; O(1) levels dedup and per-plugin description memoization; new opt-in `levelsCap` generate option.
