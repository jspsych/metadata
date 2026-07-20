---
"frontend": patch
---

The web wizard can now be embedded in an iframe (used by the new metadata documentation site). When it detects it's framed it hides its own theme toggle and duplicate brand header, and follows the host page's light/dark theme via `postMessage`. Its Vite base path is configurable through `VITE_BASE`, and its "Learn more" / "What is Psych-DS?" links now point at the docs Introduction page.
