---
"frontend": patch
---

Fix wizard state-loss bugs (existing metadata no longer reloads on revisit, additive vs replace upload flows keep metadata and staged data consistent, navigation locked during processing, picked files survive navigation); bound zip download/upload memory (sequential compression with backpressure, blob-based zip extraction); accessibility pass (aria-live regions, native dialog for JSON preview, label associations); beforeunload guard for unsaved work.
