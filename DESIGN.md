---
name: jsPsych Metadata Generator
description: Guided Psych-DS metadata generator for jsPsych experiments
colors:
  forest-deep: "#006738"
  forest-bright: "#13b24b"
  amber: "#f78f1e"
  amber-hover: "#e07d12"
  danger: "#d93025"
  ink: "#1a2e24"
  ink-2: "oklch(37% 0.012 155)"
  ink-3: "oklch(52% 0.010 155)"
  ink-4: "#9ab5a8"
  bg: "#f4f7f5"
  bg-sidebar: "oklch(94% 0.03 155)"
  bg-raised: "#ffffff"
  bg-input: "#ffffff"
  border: "#d6e0da"
  border-sub: "#eaf0ed"
  dark-base: "#141918"
  dark-sidebar: "#0f1512"
  dark-raised: "#1d2420"
  dark-input: "#161d1a"
  dark-border: "#2c3830"
typography:
  display:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "2.2rem"
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
    color: "forest-deep (via --c-accent)"
  body:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  input: "2px 2px 0 0"
  sm: "4px"
  md: "7px"
  lg: "8px"
  card: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.7em 2em"
    fontSize: "1rem"
    note: "All forward-progress CTAs — Continue, Process, Import"
  button-primary-hover:
    backgroundColor: "{colors.amber-hover}"
  button-download:
    backgroundColor: "{colors.amber}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.7em 2em"
    fontSize: "1rem"
    note: "Review step download — same as button-primary"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.md}"
    padding: "0.5em 1em"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
    border: "1px solid var(--c-danger-border)"
    padding: "0.4em 0.75em"
  input-default:
    backgroundColor: "{colors.bg-raised}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.border}"
    borderBottom: "2px solid {colors.border}"
    rounded: "{rounded.input}"
    padding: "0.6rem 0.75rem"
  input-focus:
    borderBottomColor: "{colors.forest-bright}"
    boxShadow: "0 2px 8px rgba(19, 178, 75, 0.12)"
  sidebar-active:
    borderLeft: "3px solid var(--c-amber-text)"
    backgroundColor: "rgba(247, 143, 30, 0.12)"
    color: "var(--c-amber-text)"
    fontWeight: 600
---

# Design System: jsPsych Metadata Generator

## 1. Overview

**Creative North Star: "The Quiet Instrument"**

This is a research-grade tool that knows what it is: an instrument for a specific job, used by people who have already decided to be here. It does not welcome visitors. It does not try to convert anyone. It opens, presents the task, and gets out of the way.

The jsPsych logo is the color source of truth. It contains four colors in roughly equal visual weight: deep forest green (~50% of dots), warm amber/orange (~40%), lime-bright green (scattered), and coral red (small cluster). The UI expresses all four: forest-deep for structural authority (headings, borders, accent), amber for forward-progress actions, forest-bright for completion and focus states, and coral only for danger/destructive actions.

**Key Characteristics:**
- IBM Plex Sans — technical/academic character suited to a research tool
- Forest-deep for structural elements; forest-bright for interactive/completion states (two distinct greens)
- Amber as the primary CTA color throughout the wizard flow
- Hybrid underline inputs: full border for field definition, thick bottom as the dominant edge, forest-bright focus glow
- Flat elevation: tonal layering, no shadows at rest
- Light-first; dark theme uses forest-tinted neutrals (not generic gray)
- Sidebar active: amber left strip + amber wash (functional nav selection indicator, distinct from content-area side stripes)

## 2. Colors

Every surface color carries a trace of forest green (`hue 155`) in its undertone, so the system reads as coherent across light and dark modes.

### Brand

- **Forest Deep** (`#006738`): Structural authority. Step headings, sidebar borders, focus ring color (base), interactive link color. Token: `--c-forest-deep`. In dark mode this fails as text — use `--c-accent` (adaptive) which maps to forest-bright on dark.
- **Forest Bright** (`#13b24b`): Interactive and completion. Input focus borders, focus glow, completed step checkmarks and labels, success states. Token: `--c-forest-bright`. The "lighter" of the two logo greens — expresses liveness.
- **Amber** (`#f78f1e`, hover `#e07d12`): Forward-progress actions. All Continue/Process/Import/Download buttons. Active sidebar step indicator strip and wash. Token: `--c-amber`, `--c-amber-hover`. In light mode, text-on-light-bg amber uses `--c-amber-text` (`oklch(46% 0.17 55)`) for contrast.
- **Danger** (`#d93025`): Destructive and irreversible only. Start Over, error text, required-field asterisks. Token: `--c-danger`.

### The Adaptive `--c-accent` Token

`--c-accent` resolves to `forest-deep` in light mode and `forest-bright` in dark mode. Use it wherever a green accent needs to work in both themes (headings, borders, focus rings) — never hardcode `#006738` in a context where it might render on a dark background.

### Neutral (Light Theme)

- **`--c-bg`** (`#f4f7f5`): Main content area background. Slightly green-tinted off-white — not pure white, not cream.
- **`--c-bg-sidebar`** (`oklch(94% 0.03 155)`): Sidebar surface. Visibly greener and slightly darker than `--c-bg`, creating a VS Code-style tonal distinction between navigation and content.
- **`--c-bg-raised`** (`#ffffff`): Elevated surfaces — cards, inputs, dialogs, list panels. Pure white sits visibly above the tinted page backgrounds.
- **`--c-bg-input`** (`#ffffff`): Input field backgrounds. Same as raised.
- **`--c-ink`** (`#1a2e24`): Primary text. Near-black with forest DNA.
- **`--c-ink-2`** (`oklch(37% 0.012 155)`): Secondary text. Form descriptions, card subtitles.
- **`--c-ink-3`** (`oklch(52% 0.010 155)`): Hint text, placeholder text, secondary labels.
- **`--c-ink-4`** (`#9ab5a8`): Disabled and locked states only. Do not use for meaningful text.
- **`--c-border`** (`#d6e0da`): Input borders, card borders, section dividers.
- **`--c-border-sub`** (`#eaf0ed`): Hairline dividers within lists and cards.

### Neutral (Dark Theme)

All dark surfaces carry forest-green DNA (`hue 155`) — never pure gray.

- **`--c-bg`** (`#141918`): Body background.
- **`--c-bg-sidebar`** (`#0f1512`): Sidebar, slightly deeper than content.
- **`--c-bg-raised`** (`#1d2420`): Cards, dialogs.
- **`--c-bg-input`** (`#161d1a`): Input backgrounds.
- **`--c-border`** (`#2c3830`): Borders on dark surfaces.
- In dark mode: `--c-accent` = `#13b24b` (forest-bright), `--c-amber-text` = `#f78f1e`.

### The Two-Green Rule

Forest-deep and forest-bright serve distinct roles:

- **Forest-deep** = structural authority: headings, primary borders, button outlines, sidebar surface tint
- **Forest-bright** = interactive liveness: focus rings, input focus glow, completed step labels, checkmarks, success indicators

Never use forest-bright for structural/static elements. Never use forest-deep for focus rings or live states.

### Named Rules

**The Amber CTA Rule.** Amber (`#f78f1e`) is the primary forward-progress button color throughout the wizard. Every "Continue →", "Process", "Import", and "Download" button uses amber. This is intentional — amber comprises ~40% of the jsPsych logo and should have proportionate presence. Amber also appears on the active sidebar step (left strip + wash) and the "Open existing project" card icon on the landing page.

**The Forest DNA Rule.** Every surface color carries a trace of `hue 155` (forest green). Surface neutrals are tinted green, not warm (no beige/cream/sand). New surface colors must add 0.005–0.015 chroma toward `hue 155`.

## 3. Typography

**Font:** IBM Plex Sans (Google Fonts, weights 400 / 500 / 600)

IBM Plex Sans was designed for scientific and technical documentation — it has more character than Inter while remaining highly legible in dense form-heavy interfaces. The monospace companion (IBM Plex Mono) is available but the current implementation uses Fira Code / Cascadia Code for code elements.

Loaded via:
```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

### Hierarchy

- **Display** (600, `2.2rem`, lh 1.2): Landing page title. One instance.
- **Headline** (600, `1.5rem`, lh 1.3, color: `var(--c-accent)`): Step page headings — colored forest-deep in light, forest-bright in dark. One per view.
- **Title** (600, `1rem`, lh 1.4): Card headings, section sub-headings.
- **Body** (400, `0.9rem`, lh 1.6): Form descriptions, field hints, prose. Cap at 65ch.
- **Label** (500, `0.88rem`, lh 1.4): Field labels, sidebar step names.
- **Micro** (400–500, `0.75–0.78rem`): Badge text, helper annotations, supporting UI only.

### Named Rules

**The One Family Rule.** IBM Plex Sans only for UI shell. Code blocks and monospace contexts use Fira Code / Cascadia Code as fallback chain.

**The No Uppercase Rule.** No `text-transform: uppercase` anywhere. Hierarchy comes from weight and scale, not case.

## 4. Elevation

Flat by default. Depth is conveyed through tonal surface hierarchy (sidebar → content → raised → input) and borders. The hierarchy from darkest to lightest in light mode:

```
bg-sidebar (oklch 94%)  ← slightly deeper/greener
bg (f4f7f5)             ← main content area
bg-raised / bg-input (#ffffff) ← white elevated surfaces
```

Inputs and cards appear to "float" above the tinted content area because they are pure white on a tinted background.

**Shadows:** Reserved for modal backdrops only (`rgba(0,0,0,0.5)` scrim). No drop shadows on cards, inputs, or buttons at rest. The input focus glow (`0 2px 8px rgba(19,178,75,0.12)`) is the only shadow-like effect in the system — it's directional (below the field only) and communicates interactivity, not elevation.

## 5. Components

### Buttons

Matte, no shadow, no transform on hover. Motion is background color only.

- **Primary (Amber):** `#f78f1e` background, white text, `0.7em 2em` padding, `1rem` font size, `7px` radius. Hover → `#e07d12`. Used for all forward-progress CTAs: Continue, Process, Import, Download. This is the most common button in the flow.
- **Ghost:** Transparent background, `ink-3` text. Hover shows subtle background tint. Used for cancel, collapse toggles, secondary links.
- **Danger:** Transparent, `--c-danger` text, `1px solid var(--c-danger-border)`. Hover adds `--c-danger-bg` tint. "Start Over" only.
- **Add/Dashed:** `1px dashed var(--c-accent)`, transparent bg, `var(--c-accent)` text, `opacity: 0.7` at rest → `1.0` on hover. Used for "Add author".

### Inputs and Textareas

The input style is a hybrid underline: full border for field definition, thick bottom as the dominant edge.

- **Resting:** `border: 1px solid var(--c-border)` (all sides, defines the field shape), `border-bottom: 2px solid var(--c-border)` (overrides bottom to 2px — the primary visual edge), `border-radius: 2px 2px 0 0`, `background: var(--c-bg-input)` (pure white, elevated above tinted page bg).
- **Focus:** `border-bottom-color: var(--c-forest-bright)` (only the bottom activates — sides stay neutral), `box-shadow: 0 2px 8px rgba(19, 178, 75, 0.12)` (soft directional glow below the field). No outline. The forest-bright focus color is intentionally the brighter of the two greens — it signals liveness.
- **Placeholder:** `var(--c-ink-3)` — sufficient contrast on white bg.
- **Disabled:** `var(--c-bg-raised)` background, `var(--c-ink-4)` text.

The `2px 2px 0 0` radius keeps corners mostly sharp (tool-like) while removing the harsh 90° edge.

### Cards (Landing Page)

- **Corner Style:** `12px` radius
- **Background:** `var(--c-bg-raised)` (`#ffffff`) — white on the green-tinted landing background
- **Border:** `1px solid var(--c-border)`
- **Hover:** Border transitions to `var(--c-accent)`, background tints to `var(--c-bg-card-hover)`
- **Shadow:** None

### Sidebar Navigation

The sidebar surface (`--c-bg-sidebar`) is visibly greener than the content area (`--c-bg`), creating a clear zone distinction like a VS Code-style navigation rail.

- **Step default:** `var(--c-ink-2)` text, no background. `border-left: 3px solid transparent` (space reserved to prevent layout shift on active).
- **Step hover:** `var(--c-ink)` text, `rgba(19, 178, 75, 0.08)` background (forest-bright based — brighter/livelier than forest-deep).
- **Step active:** `3px solid var(--c-amber-text)` left strip + `rgba(247, 143, 30, 0.12)` amber wash + `var(--c-amber-text)` text + 600 weight. The left strip is intentional in the sidebar navigation context — it is a functional selection indicator, not a decorative content-area stripe. This is distinct from the content-area side-stripe prohibition.
- **Step completed:** `var(--c-forest-bright)` text (the bright green, distinct from default ink) + forest-bright `✓` indicator. The two-green system is visible here: completed steps are brighter-green, step headings are deep-green.
- **Step locked:** `var(--c-ink-4)` text, `cursor: not-allowed`. WCAG exception for inactive UI components applies.
- **Dot indicator (default/active):** 5×5px circle. Default: `var(--c-ink-4)`. Active: `var(--c-amber-text)`.
- **Checkmark indicator (completed):** `var(--c-forest-bright)`.

### Content Layout

Step pages are centered within the content area via `margin: 0 auto; width: 100%` on each `.page` container. Max-widths by step:

- Project Info: 720px
- Data Upload: 760px
- Variables: 820px
- Authors: 760px
- Review: 780px

Content area padding: `3rem 2rem`. The minimum 2rem side padding ensures the content never touches the viewport edge on smaller screens.

### Inline Code and Blocks

- **Inline code:** `var(--c-border-sub)` background, 3px radius, `0.8em` size, Fira Code / Cascadia Code / monospace.
- **JSON preview block:** `var(--c-bg-raised)` background, `1px solid var(--c-border)` border, `8px` radius, monospace, horizontal scroll if needed.
- **CLI code blocks:** `var(--c-border-sub)` background, same border treatment. Distinct from JSON preview.

## 6. Do's and Don'ts

### Do:

- **Do** use amber (`#f78f1e`) for all primary forward-progress CTAs: Continue, Process, Import, Download. Amber is proportionate to its presence in the logo (~40%) and should feel present throughout the flow.
- **Do** use `var(--c-accent)` (adaptive: forest-deep in light, forest-bright in dark) for step page headings, links, and structural green elements.
- **Do** use `var(--c-forest-bright)` for focus states, active input borders, completed step indicators, and success states.
- **Do** use `var(--c-forest-deep)` for structural elements: heading color in light mode, primary borders, sidebar tint.
- **Do** tint all neutral surface colors toward forest green (`hue 155`) by 0.005–0.015 chroma. Never pure neutral gray.
- **Do** give inputs a full 1px border for field definition, with the bottom at 2px — the thick bottom is the underline character, the sides define the shape.
- **Do** use forest-bright for the input focus glow, not forest-deep. The brighter green signals liveness.
- **Do** use the amber left-strip + wash for the active sidebar step. This is a functional navigation selection indicator — it is explicitly permitted in the sidebar context.
- **Do** center step content with `margin: 0 auto` at the specified max-widths.
- **Do** use IBM Plex Sans (Google Fonts, weights 400/500/600) as the sole UI font.

### Don't:

- **Don't** use `#646cff` or any blue-purple. It is Vite's scaffold color, not a brand color.
- **Don't** apply `border-left` or `border-right` greater than 1px as a colored accent stripe on **content-area** elements: cards, list items, callouts, alerts. Use background tints instead. (The sidebar nav left-strip is a deliberate exception — it's a selection indicator, not a decorative stripe.)
- **Don't** apply `gradient text` (`background-clip: text` with a gradient). Single solid color only.
- **Don't** use `text-transform: uppercase` with `letter-spacing` on labels, nav items, or headings.
- **Don't** add box shadows to cards, inputs, or buttons at rest. The only shadow-like effect is the directional input focus glow.
- **Don't** use warm beige/sand/cream backgrounds. Surface neutrals must tint toward forest green, not warmth.
- **Don't** use pure neutral gray for any surface or text color. Every ink and surface value has a trace of `hue 155`.
- **Don't** use forest-bright for structural/static elements (borders, headings at rest). It is specifically the "live/interactive" green.
- **Don't** use forest-deep as text on dark backgrounds — it fails contrast (~1.7:1 on dark surfaces). Use `var(--c-accent)` which adapts to forest-bright in dark mode.
- **Don't** design to attract or impress. Every visual decision should reduce friction toward producing the JSON file.
