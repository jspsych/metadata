---
"@jspsych/metadata": patch
---

Strip JSDoc continuation `*` markers when parsing multi-line plugin/extension variable descriptions, so descriptions like the webgazer extension's `webgazer_data` no longer contain stray asterisks. Adds a regression test for webgazer-shaped multi-line JSDoc.
