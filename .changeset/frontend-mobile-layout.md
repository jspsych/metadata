---
"frontend": patch
---

The wizard now fits a phone screen. It previously had no width breakpoints at all, so the fixed 210px step rail left roughly 165px of usable content on a 375px device. Below 700px the rail becomes a horizontal top bar — the same nodes and connector rotated a quarter turn, each label under its node — so every step stays visible without hiding navigation behind a menu. The remaining layouts follow: the landing cards stack and scroll from the top instead of centering and clipping on a short screen, the JSON preview drawer takes the full width now that there is no side rail to sit beside, the Variables description/type pair and the Authors paired fields drop to one column, picker and action rows wrap, and the JSON viewer's per-level indent tightens so deep nesting no longer runs off the screen.

Form controls are also held at 16px on small screens: iOS Safari auto-zooms whenever a focused control is smaller than that, and every field here was around 14px, so tapping one zoomed the page in and left it scrolled sideways.
