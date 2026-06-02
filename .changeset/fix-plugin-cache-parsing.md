---
"@jspsych/metadata": patch
---

Fix `PluginCache` parsing errors for standard and custom jsPsych plugins. The data block was extracted with a lazy regex that overshot into the rest of the info object; replaced with brace-counting extraction that handles any nesting depth. Non-ok HTTP responses (e.g. 404 for unknown plugins) are now caught before reaching the parser rather than passing HTML error pages as source code. Additionally, JSDoc descriptions for parameters inside a `nested:` sub-object (e.g. `view_history`'s `page_index` and `viewing_time` in `jsPsych-instructions`) are now correctly extracted; previously the first nested parameter was silently consumed by the parent variable's regex match and never added to the cache.
