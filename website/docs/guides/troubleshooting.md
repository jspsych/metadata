---
title: Troubleshooting
sidebar_label: Troubleshooting
description: Common problems generating Psych-DS metadata — validation warnings, filename errors, join keys, and file-format issues — and how to fix them.
---

# Troubleshooting

Common issues when generating metadata with the web wizard or the CLI, and how to resolve them. If you hit something not covered here, please [open an issue](https://github.com/jspsych/metadata/issues).

## Validation

**"Missing README" / "Missing CHANGES" warnings.**
Expected when the wizard validates in the browser — those files aren't part of the in-browser check. The downloaded project includes both, so the warnings clear when you validate the unzipped folder with the [Psych-DS validator](https://psych-ds.github.io/validator/). Warnings do not cause validation to fail, but they may indicate recommended metadata is missing.

**`JSON_KEY_REQUIRED: … missing required field(s)`.**
Your `dataset_description.json` is missing a required field (often `description`). Fill it in on the wizard's Project info step; in the CLI running interactively you'll be prompted to add it before finishing. Add the field and generate again.

**`CSV_HEADER_MISSING`, or a file fails validation for an empty header.**
An empty or header-less CSV in your data folder. Remove blank or 0-byte CSV files before running.

## File names

**"These filenames don't follow the Psych-DS pattern."**
Psych-DS expects `keyword-value_data.csv` (e.g. `subject-01_data.csv`). In **interactive** mode the tool offers renaming strategies with a live preview on your real filenames; in **non-interactive** mode a non-compliant name is a hard error, so rename before running. See [Data file naming](../reference/cli-reference.md#data-file-naming).

**A validator warning about an "unofficial keyword."**
A name like `group-a_data.csv` is technically valid but uses a keyword outside the official set, which draws a warning. The tool offers to rename these too, or you can pick an [official keyword](../reference/cli-reference.md#data-file-naming) (`subject`, `session`, `task`, …).

## Files not picked up

**Some files were ignored.**
Only `.csv`, `.json`, and `.jsonl` files are processed; other types are skipped. The tool also reads the data folder and **one** level of subfolders — anything nested deeper is ignored. See [Folder depth](../reference/cli-reference.md#folder-depth).

**A JSON file wasn't recognized.**
JSON input must be a trial **array** (`[ {…}, {…} ]`) or the `{ "trials": [...] }` wrapper. A JSON object in any other shape is skipped. See [Accepted formats](../reference/cli-reference.md#accepted-formats).

## Join keys (nested arrays)

**The tool asks you to choose a "join key."**
A file contains nested arrays (e.g. a survey trial holding several responses) and `trial_index` doesn't uniquely identify each row — common in merged multi-participant files where `trial_index` resets per person. Pick one or more columns marked **sufficient alone** until every row is unique, then continue. See [Nested arrays and join keys](../reference/cli-reference.md#nested-arrays-and-join-keys).

## File formats and encoding

**A CSV parses with a garbled first column name (e.g. `ï»¿id`).**
A UTF-8 byte-order mark (BOM) at the start of the file. The tools strip the BOM automatically; if you see this on an older version, update — or re-save the file as UTF-8 without a BOM.

**A blank leading column disappeared.**
The unnamed row-index column that some exporters and R prepend is dropped on purpose. This is expected, not data loss.

## Variable descriptions

**A variable's description is `unknown` or blank.**
Descriptions are looked up from the jsPsych plugin that produced each column, so columns the tool doesn't recognize — custom fields, or data not produced by a plugin — have no automatic description. Fill them in on the wizard's Variables step, at the CLI's prompt, or with a [metadata options file](./customizing-output.md).

**Descriptions are missing for plugins you know have them.**
Description lookup fetches plugin source over the network. If you're offline or the request is blocked, descriptions can't be retrieved — reconnect and run again, or add them manually.

---

**Still stuck?** [Open an issue](https://github.com/jspsych/metadata/issues) with your input files (or a small sample) and the message you saw.
