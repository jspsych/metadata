---
"@jspsych/metadata-cli": patch
---

Don't block non-interactive runs on the join-key prompt. When `trial_index` isn't unique (the norm for multi-subject data, where it restarts per subject), the CLI previously always opened an interactive checkbox to pick additional join keys — even in a fully-flagged headless run (`--psych-ds-dir` + `--data-dir` + `--metadata-options`, no TTY), which aborted with `✘ User force closed the prompt`. The prompt is now gated on having a terminal; without one, join keys are resolved deterministically via `resolveJoinKeysNonInteractive` (add a sufficient single column, else a minimal sufficient combination, else proceed with a warning that extracted CSVs may contain duplicate rows). Fixes finding #3 of #109.
