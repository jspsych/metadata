---
"@jspsych/metadata-cli": patch
---

fix(cli): don't print a spurious validation failure for existing projects

When opening an existing project, validation ran before the data files were
copied into the project, so it always failed with `MISSING_DATA_DIRECTORY` and
printed a misleading `✘ Psych-DS validation failed` to stderr even when the final
output was valid. Removed that pre-write call; the post-write validation that
actually gates the result is unchanged.
