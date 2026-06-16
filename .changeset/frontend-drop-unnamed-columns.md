---
"frontend": patch
---

Drop unnamed columns from uploaded CSVs so the dev UI produces a validating dataset. R-style CSV exports (write.csv with the default row.names=TRUE) prepend an unnamed row-index column, which the metadata library drops from `variableMeasured`. The frontend previously kept the original file content for both the in-browser validator and the download zip, so a dataset that generated fine still failed validation with `CSV_COLUMN_MISSING_FROM_METADATA` and the zip shipped an invalid CSV. Uploaded CSV content is now normalized once (via a shared `normalizeDataContent` helper that reuses the library's `stripUnnamedColumns`) before it is generated, validated, and zipped, so all three agree. Well-formed CSVs are passed through unchanged. Completes finding #2 of #109 on the frontend side.
