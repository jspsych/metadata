---
"frontend": patch
---

In-browser validation now checks the dataset the user actually downloads. The zip has always shipped placeholder `README.md` and `CHANGES.md`, but the validator never saw them, so every run reported `MISSING_README_DOC` / `MISSING_CHANGES_DOC` for documents the download does contain — and the Review step carried a note explaining the false alarm away. The validator is now handed the same two files (both Psych-DS rules are presence-only, so this is an honest check, not a suppression), the warnings no longer appear, and the note is gone. Their content lives once in `datasetLayout.ts`, shared with the zip builder so the two can't drift. Saving only `dataset_description.json` produces no such files, so those warnings correctly still appear there.

Review also no longer points at `npx @jspsych/cli validate` — a package that does not exist on npm, with a subcommand the metadata CLI never had. Since validation now covers the whole downloaded project, the re-validation block was removed rather than corrected.

Wizard copy was rewritten throughout for researchers rather than developers: plainer field hints (`URL or SPDX identifier` → `A standard license name like CC-BY-4.0, or a link to the license text`), `@type` relabelled **Author type** and `Privacy policy` **Sharing restrictions** (both still naming the underlying JSON key), errors that say what to do next, no raw exception text in the file list, and a processing summary that reports outcomes (`Finished. 3 files read, 1 skipped.`) instead of counting skipped and failed files as processed. Destructive confirmations now state that files on disk are untouched.
