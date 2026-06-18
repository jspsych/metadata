---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
"frontend": patch
---

Synthesize a `source_record_id` join key for multi-record JSON-Lines exports. Raw jsPsych exports carry no per-row identifier, so once JSONL is flattened (one record per line) `trial_index` repeats across records and can't uniquely key the extracted array/object sidecar CSVs — every record's trial 0 collapsed onto the same `(trial_index, element_index)` key, making the sidecars impossible to join back to a single parent trial.

The synthesized column is named `source_record_id` rather than `participant_id` because a JSON-Lines line is only guaranteed to be one *source record* — usually, but not always, one participant. The honest name avoids overclaiming for exports where a line isn't a single subject.

`parseJsonData` now takes an opt-in `{ tagSourceRecordId }` flag: in the JSON-Lines path it stamps each line's object rows with a 0-based `source_record_id` (a no-op on the single-array fast path), and reports via an optional `stats` out-param whether it actually synthesized the id. A line that already carries a `source_record_id` or a real `participant_id` is left untouched — the experiment's own identifier already groups those rows. `generate()` enables this for JSON input and promotes the identifier to the leading join key, preferring the synthesized `source_record_id` and falling back to a real `participant_id` already present in the export (`['source_record_id', 'trial_index']` or `['participant_id', 'trial_index']`), so the sidecars join unambiguously. CSV inputs are unaffected.

When — and only when — the id was actually synthesized (i.e. absent from the source), it is given an explicit description that makes its synthetic origin unmistakable ("Synthetic source-record identifier … NOT a real subject ID from the experiment …") so a downstream user can't mistake it for a real subject ID; this also avoids serializing an empty `{}` description (an object with no `@type`, which trips the validator's `OBJECT_TYPE_MISSING`). The CLI's join-key pre-analysis/prompt and the frontend's pre-flight mirror this promotion so multi-record JSONL is no longer falsely flagged as having a non-unique join key.

Verified end to end against the raw `.jsonl` exports in `vucml/online_experiments` (`block_cat`): the combined 30-record export generates metadata, passes the Psych-DS validator (0 errors), synthesizes `source_record_id` 0–29, and writes sidecars whose `(source_record_id, trial_index, element_index)` keys are fully unique — including the doubly-nested `recall_responses` case. Notably `subjectId` collides across the two merged datasets (two records share `601`), which `source_record_id` correctly keeps distinct.
