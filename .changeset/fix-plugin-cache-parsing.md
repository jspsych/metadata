---
"@jspsych/metadata": patch
---

Fix `PluginCache` incorrectly throwing "Error parsing" for standard jsPsych plugins and custom plugins. The data block was extracted with a lazy regex that overshot into the rest of the info object; replaced with brace-counting extraction that handles any nesting depth. Non-ok HTTP responses (e.g. 404 for unknown plugins) are now caught before reaching the parser rather than passing HTML error pages as source code. The catch block now logs the actual error for diagnosability.
