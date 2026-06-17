---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
"frontend": patch
---

Synthesize a `participant_id` join key for multi-participant JSON-Lines exports. Raw jsPsych exports carry no per-row participant identifier, so once JSONL is flattened (one participant per line) `trial_index` repeats across participants and can't uniquely key the extracted array/object sidecar CSVs — every participant's trial 0 collapsed onto the same `(trial_index, element_index)` key, making the sidecars impossible to join back to a single parent trial.

`parseJsonData` now takes an opt-in `{ tagParticipantId }` flag: in the JSON-Lines path it stamps each line's object rows with a 0-based `participant_id` (a no-op on the single-array fast path; never overwrites an existing value), and reports via an optional `stats` out-param whether it actually synthesized the id. `generate()` enables this for JSON input and promotes `participant_id` to the leading join key (`['participant_id', 'trial_index']`) whenever rows carry one, so the sidecars join unambiguously. CSV inputs are unaffected.

When — and only when — the id was actually synthesized (i.e. absent from the source), it is given an explicit description that makes its synthetic origin unmistakable ("Synthetic participant identifier … NOT a real subject ID from the experiment …") so a downstream user can't mistake it for a real subject ID; this also avoids serializing an empty `{}` description (an object with no `@type`, which trips the validator's `OBJECT_TYPE_MISSING`). A `participant_id` already present in the data is left untouched. The CLI's join-key pre-analysis/prompt and the frontend's pre-flight mirror this promotion so multi-participant JSONL is no longer falsely flagged as having a non-unique join key.

Verified end to end against the raw `.jsonl` exports in `githubpsyche/homophily`: all three files generate metadata, pass the Psych-DS validator, and write sidecars whose `(participant_id, trial_index, element_index)` keys are fully unique (e.g. `view_history` at 385/385 rows, vs. 7 colliding keys without `participant_id`).
