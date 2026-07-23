---
"frontend": minor
---

The web wizard can now preload an allowlisted sample dataset from a `?sample=` deep link (e.g. `/wizard?sample=serial-reaction-time`). When the docs site forwards a known slug, the wizard skips the landing screen, fetches the bundled sample, and processes it automatically — so a visitor can see the tool run on real jsPsych data with no download-and-re-upload. The slug only ever indexes an internal allowlist (`SAMPLE_DATASETS`), never a raw fetch URL, and an unknown slug is ignored. Backs the new "Serial Reaction Time" before/after example on the documentation site.

The Variables step also now starts with every row collapsed, so the initial view matches the "Expand all" toggle.
