// Shared knowledge about how a Psych-DS dataset is laid out, used by both the
// Review download (zip) and the in-browser validator so the two never drift.
//
// The `data/` payload itself (converted, Psych-DS-named CSVs and preserved raw JSON) is built
// during upload in DataUpload.tsx via @jspsych/metadata's buildPsychDSDataFiles, and its keys
// are already dataset-relative paths — so no path mapping is needed here anymore.

/** Canonical Psych-DS metadata filename. */
export const DATASET_DESCRIPTION_FILENAME = 'dataset_description.json';
