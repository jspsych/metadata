---
title: Troubleshooting
sidebar_label: Troubleshooting
description: Common problems generating Psych-DS metadata — validation warnings, filename errors, join keys, and file-format issues — and how to fix them.
---

# Troubleshooting

Common issues when generating metadata with the web wizard or the CLI, and how to resolve them. If you hit something not covered here, please [open an issue](https://github.com/jspsych/metadata/issues).

## Validation

**"Missing README" / "Missing CHANGES" warnings.**
The wizard includes a placeholder `README.md` and `CHANGES.md` in the project you download, and validates them along with everything else, so these warnings shouldn't appear there. You will see them if you save only `dataset_description.json`, or if you validate a folder of your own that has no such files — add the two files to clear them.

More generally: warnings never make validation fail. They flag recommended metadata you haven't provided, so they're worth reading, but a dataset with warnings is still valid.

**`JSON_KEY_REQUIRED: … missing required field(s)`.**
Your `dataset_description.json` is missing a field Psych-DS requires — usually `description`. Fill it in on the wizard's Project info step, or, in the CLI, at the prompt that appears before it finishes. Then generate again.

**`CSV_HEADER_MISSING`, or a file fails validation for an empty header.**
One of your CSV files is empty or has no header row. Delete blank and 0-byte CSV files from your data folder, then run again.

## File names

**"These filenames don't follow the Psych-DS pattern."**
Psych-DS expects data files to be named `keyword-value_data.csv` (e.g. `subject-01_data.csv`). Normally the tool offers to rename them for you, showing a preview on your actual filenames first. The exception is a scripted run with no prompts, where a name that doesn't match is a hard error — rename the files yourself before running. See [Data file naming](../reference/cli-reference.md#data-file-naming).

**A validator warning about an "unofficial keyword."**
A name like `group-a_data.csv` is legal, but `group` isn't one of the keywords Psych-DS defines, so the validator mentions it. You can ignore it, let the tool rename the files, or switch to an [official keyword](../reference/cli-reference.md#data-file-naming) such as `subject`, `session`, or `task`.

## Files not picked up

**Some files were ignored.**
Two things to check: only `.csv`, `.json`, and `.jsonl` files are read, and the tool looks in your data folder plus **one** level of subfolders, so anything buried deeper is never seen. See [Folder depth](../reference/cli-reference.md#folder-depth).

**A JSON file wasn't recognized.**
The tool expects a jsPsych trial list: either an array of trials (`[ {…}, {…} ]`) or the `{ "trials": [...] }` wrapper some services export. JSON in any other shape is skipped. See [Accepted formats](../reference/cli-reference.md#accepted-formats).

## Join keys (nested arrays)

**The tool asks you to choose a "join key."**
One of your files stores a list inside a single trial, and the rows extracted from it need a column that points back to the trial they came from. `trial_index` normally does the job, but if you merged several participants into one file it restarts at 0 for each of them.

Tick columns marked **sufficient alone** until every row is unique, then continue. See [Nested arrays and join keys](../reference/cli-reference.md#nested-arrays-and-join-keys).

## File formats and encoding

**A CSV's first column name comes out garbled (e.g. `ï»¿id`).**
Those stray characters are a byte-order mark, an invisible marker some programs write at the start of a file. Current versions remove it automatically, so update if you're on an older one — or re-save the file as UTF-8 without a byte-order mark.

**A blank leading column disappeared.**
That's the unnamed row-number column R and some export tools add. It's dropped on purpose, since it isn't data. Nothing of yours was lost.

## Variable descriptions

**A variable's description is `unknown` or blank.**
Descriptions come from the jsPsych plugin that produced each column, so anything a plugin didn't produce — data you added yourself, or custom fields — has nothing to look up. Write those descriptions on the wizard's Variables step, at the CLI's prompt, or in a [metadata options file](./customizing-output.md).

**Descriptions are missing for plugins you know document them.**
Looking up a description means fetching the plugin's source over the internet. If you were offline, or a firewall blocked the request, nothing comes back. Reconnect and run again, or write those descriptions yourself.

---

**Still stuck?** [Open an issue](https://github.com/jspsych/metadata/issues) with your input files (or a small sample) and the message you saw.
