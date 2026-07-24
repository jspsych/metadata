---
name: jsPsych Metadata Generator
description: Guided Psych-DS metadata generator for jsPsych experiments
# Palette is INHERITED from the jsPsych Docusaurus theme (@jspsych/docusaurus-theme,
# css/jspsych.css). The theme is the single source of truth; these values are hardcoded
# into the wizard's --c-* tokens because the iframe does not load the theme CSS. Keep in sync.
# Role: green is the primary CTA color; orange is a <=10% accent (landing "open existing" icon).
colors:
  forest-deep: "#00683e"       # theme --ifm-color-primary
  forest-bright: "#007447"     # theme --ifm-color-primary-light (live/focus green, AA as text)
  cta: "#00683e"               # primary CTA fill (theme --ifm-color-primary)
  cta-hover: "#006037"         # theme --ifm-color-primary-dark
  cta-text: "#ffffff"          # label on the green fill (6.89:1)
  amber: "#f18426"             # theme --jspsych-orange (accent only, NOT primary CTA)
  amber-hover: "#e3770e"       # theme --jspsych-orange-dark
  amber-text: "#b55800"        # theme --jspsych-orange-ink (contrast-safe orange text)
  danger: "#db3424"            # theme --ifm-color-danger
  ink: "#1f2622"               # theme --ifm-color-content
  ink-2: "#5e6561"             # theme --ifm-color-content-secondary
  ink-3: "oklch(52% 0.010 155)"
  ink-4: "#9ab5a8"
  bg: "#f4f8f5"                # theme --ifm-background-surface-color (tinted page)
  bg-sidebar: "oklch(94% 0.03 155)"
  bg-raised: "#fbfefc"         # theme --ifm-background-color (near-white raised)
  bg-input: "#fbfefc"
  border: "#d6e0da"
  border-sub: "#eaf0ed"
  dark-cta: "#32bb64"          # dark primary green (theme --ifm-color-primary, dark)
  dark-cta-text: "#0d1310"     # dark ink label on bright-green fill (7.54:1)
  dark-base: "#151b17"         # theme --ifm-background-surface-color (dark, page)
  dark-sidebar: "#0d1310"      # theme --ifm-background-color (dark, standalone-landing backdrop)
  dark-raised: "#1b2620"       # raised card (lighter than page)
  dark-input: "#131a16"
  dark-border: "#3a4641"
typography:
  display:
    fontFamily: "'Lexend Variable', system-ui, -apple-system, sans-serif"
    fontSize: "2.2rem"
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontFamily: "'Lexend Variable', system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
    color: "forest-deep (via --c-accent)"
  body:
    fontFamily: "'Lexend Variable', system-ui, -apple-system, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Lexend Variable', system-ui, -apple-system, sans-serif"
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
    backgroundColor: "{colors.cta}"        # green (var --c-cta); dark: {colors.dark-cta}
    textColor: "{colors.cta-text}"         # white in light, dark ink (#0d1310) in dark mode
    rounded: "{rounded.md}"
    padding: "0.7em 2em"
    fontSize: "1rem"
    note: "All forward-progress CTAs — Continue, Process, Import, Validate"
  button-primary-hover:
    backgroundColor: "{colors.cta-hover}"  # theme primary-dark; dark: #20aa57
  button-download:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.cta-text}"
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
    boxShadow: "var(--c-focus-glow)"       # forest-bright glow: rgba(0,116,71,.16) light / rgba(50,187,100,.22) dark
  sidebar-active:
    backgroundColor: "var(--c-accent-wash)"       # accent green @10% light / @14% dark — inset rounded pill
    color: "var(--c-accent)"
    fontWeight: 600
---

# Design System: jsPsych Metadata Generator

## 1. Overview

**Creative North Star: "The Quiet Instrument"**

This is a research-grade tool that knows what it is: an instrument for a specific job, used by people who have already decided to be here. It does not welcome visitors. It does not try to convert anyone. It opens, presents the task, and gets out of the way.

The wizard's palette is **inherited from the jsPsych Docusaurus theme** (`@jspsych/docusaurus-theme`, `css/jspsych.css`) — the theme is the single source of truth for color. Because the embedded wizard iframe does not load the theme CSS, the theme's values are hardcoded into the wizard's `--c-*` tokens and **must be kept in sync** with it.

The theme derives from the jsPsych logo but follows a clear hierarchy: **green is primary, orange is a ≤10% accent.** The UI expresses this as: green (theme primary) for structural authority (headings, borders) *and* for all forward-progress CTAs; forest-bright green for focus, completion and success states; orange only as a small accent (the landing "open existing project" icon); and danger red only for destructive actions.

**Key Characteristics:**
- Lexend Variable — the shared jsPsych brand font, unifying the wizard with the docs site
- Green is the primary CTA color throughout the wizard flow (matching the theme's `button--primary`)
- Forest-deep for structural elements; forest-bright for interactive/completion states (two distinct greens)
- Orange demoted to a single ≤10% accent: the landing "open existing project" icon
- Hybrid underline inputs: full border for field definition, thick bottom as the dominant edge, forest-bright focus glow
- Flat elevation: tonal layering, no shadows at rest
- Light-first; dark theme uses forest-tinted neutrals (not generic gray)

## 2. Colors

Every value is inherited from the jsPsych Docusaurus theme (see the note at the top of this section) and every surface color carries a trace of forest green (`hue 155`) in its undertone, so the system reads as coherent across light and dark modes.

> **Source of truth.** All colors below are hardcoded from `@jspsych/docusaurus-theme` (`css/jspsych.css`) into the wizard's `--c-*` tokens because the iframe does not load the theme CSS. When the theme's palette changes, update these tokens to match — the theme wins.

### Brand

- **Primary Green / Forest Deep** (`#00683e`, theme `--ifm-color-primary`): Structural authority **and** the primary CTA fill. Sidebar borders, focus ring color (base), interactive link color; the fill of every forward-progress button (via `--c-cta`, hover `--c-cta-hover` `#006037`). Token: `--c-forest-deep` / `--c-cta`. In dark mode deep green fails as text — use `--c-accent` (adaptive) which maps to the dark primary green `#32bb64`.
- **Forest Bright** (`#007447`, theme `--ifm-color-primary-light`; dark `#32bb64`): Interactive and completion. Input focus borders, focus glow, completed step checkmarks and labels, "live" states. Token: `--c-forest-bright`. The lighter/livelier of the two greens; chosen to stay AA as text on the pale sidebar.
- **Orange / Amber** (`#f18426`, theme `--jspsych-orange`; dark `#ff9c3b`): **Accent only, ≤10% of the UI — no longer a button color.** Its sole rendered use is the landing "open existing project" icon, via `--c-amber-text` (`#b55800`, theme `--jspsych-orange-ink`, contrast-safe orange text). The `--c-amber`/`--c-amber-hover`/`--c-amber-wash` tokens remain defined as a documented accent scale but are not applied to any rendered element.
- **Danger** — two-tier, both from the theme:
  - **Danger base** (`#db3424`, theme `--ifm-color-danger`; dark `#f0563f`): fills, borders, required-field asterisks, and destructive-button labels (Start Over, Remove, confirm buttons). Token: `--c-danger`.
  - **Danger text** (`#b3160a`, theme `--ifm-color-danger-contrast-foreground`; dark `#ff9d8c`): error/validation **message copy** only. Token: `--c-danger-text`. The base red is ~4.3:1 as small text on the light page (below AA), so message copy uses the contrast-foreground, which clears AA (≈6.1:1 light / ≈5.9:1 dark). Do not use the base red for running error text.

### The Adaptive `--c-accent` Token

`--c-accent` resolves to `forest-deep` (`#00683e`) in light mode and the dark primary green (`#32bb64`) in dark mode. Use it wherever a green accent needs to work in both themes (headings, borders, focus rings) — never hardcode `#00683e` in a context where it might render on a dark background.

### Neutral (Light Theme)

Elevation runs **page (tinted) < raised (near-white)** — cards/inputs float above the tinted page. Note the theme's names are inverted vs this intent: the theme's near-white `--ifm-background-color` becomes the wizard's *raised* tone, and the theme's tinted `--ifm-background-surface-color` becomes the wizard's *page* tone.

- **`--c-bg`** (`#f4f8f5`, theme `--ifm-background-surface-color`): Main content area background. Slightly green-tinted off-white — the tinted page tone.
- **`--c-bg-sidebar`** (`oklch(94% 0.03 155)`): Backdrop for the standalone Landing screen only. A slightly greener, deeper tint than `--c-bg`. (The embedded app sidebar no longer uses this token — it shares the content surface `--c-bg`.)
- **`--c-bg-raised`** (`#fbfefc`, theme `--ifm-background-color`): Elevated surfaces — cards, inputs, dialogs, list panels. The near-white tone sits visibly above the tinted page.
- **`--c-bg-input`** (`#fbfefc`): Input field backgrounds. Same as raised.
- **`--c-ink`** (`#1f2622`, theme `--ifm-color-content`): Primary text. Near-black with forest DNA.
- **`--c-ink-2`** (`#5e6561`, theme `--ifm-color-content-secondary`): Secondary text. Form descriptions, card subtitles.
- **`--c-ink-3`** (`oklch(52% 0.010 155)`): Hint text, placeholder text, secondary labels.
- **`--c-ink-4`** (`#9ab5a8`): Disabled and locked states only. Do not use for meaningful text.
- **`--c-border`** (`#d6e0da`): Input borders, card borders, section dividers.
- **`--c-border-sub`** (`#eaf0ed`): Hairline dividers within lists and cards.

### Neutral (Dark Theme)

All dark surfaces carry forest-green DNA (`hue 155`) — never pure gray. Elevation is preserved (**sidebar deepest < page < raised**); in dark mode the theme names read normally, so `--ifm-background-color` is the deepest tone and `--ifm-background-surface-color` is lighter.

- **`--c-bg`** (`#151b17`, theme `--ifm-background-surface-color`): Body/page background (mid tone).
- **`--c-bg-sidebar`** (`#0d1310`, theme `--ifm-background-color`): Backdrop for the standalone Landing screen only (the embedded app sidebar shares `--c-bg`).
- **`--c-bg-raised`** (`#1b2620`): Cards, dialogs — a touch lighter than the page so they still read as elevated.
- **`--c-bg-input`** (`#131a16`): Input backgrounds (recessed).
- **`--c-border`** (`#3a4641`): Borders on dark surfaces.
- In dark mode: `--c-accent` = `#32bb64` (dark primary green), `--c-amber-text` = `#ffb866`, primary CTA text = dark ink `#0d1310`.

### The Two-Green Rule

Forest-deep and forest-bright serve distinct roles. Both come from the theme's green ramp:

- **Forest-deep** (`#00683e`) = structural authority **and** primary CTA fill: primary borders, sidebar surface tint, and every forward-progress button.
- **Forest-bright** (`#007447` light / `#32bb64` dark) = interactive liveness: focus rings, input focus glow, completed step labels, checkmarks, success indicators.

Never use forest-bright for structural/static elements. Never use forest-deep for focus rings or live states. (In dark mode the two greens converge on `#32bb64`.)

### Named Rules

**The Green CTA Rule.** The primary forward-progress button color is **green** (the theme primary, `--c-cta` → `#00683e` light / `#32bb64` dark), matching the docs site's `button--primary`. Every "Continue →", "Process", "Import", "Validate", and "Download" button uses it. In dark mode the label is dark ink (`#0d1310`), not white, because white on bright green fails WCAG. This is deliberate: green is the theme's primary, and green CTAs suit "The Quiet Instrument" — forward motion without shouting.

**The Orange Accent Rule.** Orange (`--jspsych-orange`, `#f18426` / `#ff9c3b`) is a **minor accent capped at ≤10% of the UI** — never a button fill. Its one rendered use is the landing "open existing project" icon, tinted with `--c-amber-text` (`--jspsych-orange-ink`) for contrast. Do not reintroduce orange as a CTA color.

**The Forest DNA Rule.** Every surface color carries a trace of `hue 155` (forest green). Surface neutrals are tinted green, not warm (no beige/cream/sand). New surface colors must add 0.005–0.015 chroma toward `hue 155`.

## 3. Typography

**Font:** Lexend Variable (the shared jsPsych brand font)

Lexend Variable is the brand typeface of the shared jsPsych Docusaurus theme; using it in the wizard unifies typography across the docs site and the embedded wizard. It is a humanist sans that stays highly legible in dense, form-heavy interfaces. The monospace companion is Fira Code / Cascadia Code for code elements.

Loaded via the same `@fontsource-variable/lexend` package the theme uses, so the CSS family name (`'Lexend Variable'`) and rendering match exactly and it works offline:
```ts
// packages/frontend/src/main.tsx
import '@fontsource-variable/lexend';
```

### Hierarchy

- **Display** (600, `2.2rem`, lh 1.2): Landing page title. One instance.
- **Headline** (600, `1.5rem`, lh 1.3, color: `var(--c-accent)`): Prominent heading scale. Note: step views no longer render a *visible* page title — the sidebar's highlighted active step supplies that context. Each view keeps a visually-hidden `<h2 class="srOnly">` (its step name) so heading structure and screen readers are preserved; the `.srOnly` clip utility lives in `index.css`.
- **Title** (600, `1rem`, lh 1.4): Card headings, section sub-headings.
- **Body** (400, `0.9rem`, lh 1.6): Form descriptions, field hints, prose. Cap at 65ch.
- **Label** (500, `0.88rem`, lh 1.4): Field labels, sidebar step names.
- **Micro** (400–500, `0.75–0.78rem`): Badge text, helper annotations, supporting UI only.

### Named Rules

**The One Family Rule.** Lexend Variable only for UI shell. Code blocks and monospace contexts use Fira Code / Cascadia Code as fallback chain.

**The No Uppercase Rule.** No `text-transform: uppercase` anywhere. Hierarchy comes from weight and scale, not case.

## 4. Elevation

Flat by default. Depth is conveyed through tonal surface hierarchy (sidebar → content → raised → input) and borders. The hierarchy from darkest to lightest in light mode:

```
bg-sidebar (oklch 94%)         ← slightly deeper/greener
bg (#f4f8f5)                   ← main content area (tinted page)
bg-raised / bg-input (#fbfefc) ← near-white elevated surfaces
```

Inputs and cards appear to "float" above the tinted content area because they are near-white on a tinted background. (Dark mode preserves the same order: sidebar `#0d1310` deepest → page `#151b17` → raised `#1b2620`.)

**Shadows:** Reserved for modal backdrops only (`rgba(0,0,0,0.5)` scrim). No drop shadows on cards, inputs, or buttons at rest. The input focus glow (`--c-focus-glow`, a forest-bright green glow) is the only shadow-like effect in the system — it's directional (below the field only) and communicates interactivity, not elevation.

## 4b. Focus & Motion

**Keyboard focus.** Text inputs, textareas, and selects show focus as the underline + directional glow described above (their `:focus` rule sets `outline: none` and replaces it). Every *other* interactive control — cards, sidebar steps, buttons, the preview pill, links — gets one shared branded ring, defined once globally in `index.css`: `:focus-visible { outline: 2px solid var(--c-forest-bright); outline-offset: 2px }`. Forest-bright is the system's focus/liveness green (the Two-Green Rule). `:focus-visible` keeps the ring off mouse clicks; the outline follows each element's own radius. The higher-specificity input `:focus` rule wins, so the ring never doubles up on fields.

**Reduced motion.** A global `@media (prefers-reduced-motion: reduce)` block collapses all transitions and the preview drawer's slide-in to a near-instant, non-animated state change. Honor it — don't add motion that ignores the preference.

## 5. Components

### Buttons

Matte, no shadow, no transform on hover. Motion is background color only.

- **Primary (Green):** `var(--c-cta)` (`#00683e` light / `#32bb64` dark) background, `var(--c-cta-text)` label (white light / dark-ink `#0d1310` dark), `0.7em 2em` padding, `1rem` font size, `7px` radius. Hover → `var(--c-cta-hover)`. Used for all forward-progress CTAs: Continue, Process, Import, Validate, Download. This is the most common button in the flow, and it matches the docs site's green `button--primary`.
- **Ghost:** Transparent background, `ink-3` text. Hover shows subtle background tint. Used for cancel, collapse toggles, secondary links.
- **Danger:** Transparent, `--c-danger` text, `1px solid var(--c-danger-border)`. Hover adds `--c-danger-bg` tint. "Start Over" only.
- **Add/Dashed:** `1px dashed var(--c-accent)`, transparent bg, `var(--c-accent)` text, `opacity: 0.7` at rest → `1.0` on hover. Used for "Add author".

### Inputs and Textareas

The input style is a hybrid underline: full border for field definition, thick bottom as the dominant edge.

- **Resting:** `border: 1px solid var(--c-border)` (all sides, defines the field shape), `border-bottom: 2px solid var(--c-border)` (overrides bottom to 2px — the primary visual edge), `border-radius: 2px 2px 0 0`, `background: var(--c-bg-input)` (pure white, elevated above tinted page bg).
- **Focus:** `border-bottom-color: var(--c-forest-bright)` (only the bottom activates — sides stay neutral), `box-shadow: var(--c-focus-glow)` (soft directional forest-bright glow below the field). No outline. The forest-bright focus color is intentionally the brighter of the two greens — it signals liveness.
- **Placeholder:** `var(--c-ink-3)` — sufficient contrast on white bg.
- **Disabled:** `var(--c-bg-raised)` background, `var(--c-ink-4)` text.

The `2px 2px 0 0` radius keeps corners mostly sharp (tool-like) while removing the harsh 90° edge.

### Landing / Entry Screen

The entry screen is **embed-aware** (via the `embedded` flag from `useTheme()`, mirroring the theme toggle and sidebar header):

- **Standalone** (direct access, rare): the full hero — logo, `2.2rem` display title, description line, and the "What is Psych-DS?" collapsible — wrapped around the two-card choice. Sits on `var(--c-bg-sidebar)` (the deepest tint).
- **Embedded** (the common case, iframed on the docs site): a lean start screen. The host page already supplies the brand, title, description, and a Psych-DS explainer, so all of that is dropped. Only a compact sentence-case heading ("Start a metadata file", `1.15rem`/600) precedes the two-card choice. Sits on `var(--c-bg)` — the app content background — so entering the wizard is a seamless tonal continuation rather than a jump from the deepest tint.

### Cards (Landing Page)

- **Corner Style:** `12px` radius
- **Background:** `var(--c-bg-raised)` (`#fbfefc`) — near-white on the green-tinted landing background
- **Border:** `1px solid var(--c-border)`
- **Hover:** Border transitions to `var(--c-accent)`, background tints to `var(--c-bg-card-hover)`
- **Shadow:** None

### Sidebar Navigation

The sidebar shares the content surface (`--c-bg`) — there is no separate zone. A `--c-border-sub` hairline divides it from the content on the right edge, and a `--c-border-sub` hairline sits above the footer; the intent is for the nav to feel like part of the same surface, not a walled-off rail.

The steps read as a **vertical flow**, not a list: each step is a 22px circular node on a **vertical connector line** that threads every node, with a `1rem` label (larger than the surrounding UI, to anchor the sidebar). The connector is filled `var(--c-forest-bright)` through completed steps (progress made) and `var(--c-border)` for the road ahead. Nodes are drawn via `.step:not(:last-child)::before`, sized `calc(100% + --step-gap)` so equal-height rows land the line exactly on the next node.

- **Node — upcoming (default):** hollow ring — `2px solid var(--c-border)`, `var(--c-bg)` fill. Label `var(--c-ink-2)`, no background.
- **Node — active:** `var(--c-accent)` ring with a filled `var(--c-accent)` centre dot (`◉`). Label `var(--c-accent)`, 600 weight, on a `var(--c-accent-wash)` rounded highlight (accent green at 10% light / 14% dark) that anchors "you are here."
- **Node — completed:** solid `var(--c-forest-bright)` disc with a `✓` in `var(--c-cta-text)` (white in light, dark ink in dark — legible on the green in both modes). Label `var(--c-ink)` (full strength — done and still clickable to revisit).
- **Node — locked:** hollow muted ring (same as upcoming); label `var(--c-ink-3)` (lifted to oklch 66% in light), `cursor: not-allowed`. WCAG exception for inactive UI components applies.
- **Hover:** `var(--c-ink)` label + `var(--c-bg-raised)` background (subtle neutral lift; excluded from the active step).

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

- **Do** keep the wizard's `--c-*` tokens in sync with `@jspsych/docusaurus-theme` (`css/jspsych.css`) — the theme is the single source of truth for color.
- **Do** use `var(--c-cta)` (green) for all primary forward-progress CTAs: Continue, Process, Import, Validate, Download. In dark mode pair it with `var(--c-cta-text)` (dark ink), never white.
- **Do** use `var(--c-accent)` (adaptive: forest-deep in light, dark primary green in dark) for links and structural green elements.
- **Do** use `var(--c-forest-bright)` for focus states, active input borders, completed step indicators, and success states.
- **Do** use `var(--c-forest-deep)` for structural elements: heading color in light mode, primary borders, sidebar tint.
- **Do** tint all neutral surface colors toward forest green (`hue 155`) by 0.005–0.015 chroma. Never pure neutral gray.
- **Do** give inputs a full 1px border for field definition, with the bottom at 2px — the thick bottom is the underline character, the sides define the shape.
- **Do** use forest-bright for the input focus glow, not forest-deep. The brighter green signals liveness.
- **Do** use the green rounded highlight (`--c-accent-wash` background + `--c-accent` text) for the active sidebar step — a functional navigation selection indicator rendered as an inset rounded pill, not a stripe.
- **Do** center step content with `margin: 0 auto` at the specified max-widths.
- **Do** use Lexend Variable (the shared jsPsych brand font) as the sole UI font.

### Don't:

- **Don't** use amber/orange as a button or primary-CTA color. Orange is a ≤10% accent (the landing "open existing" icon only); green is the primary. Do not reintroduce the old "Amber CTA" pattern.
- **Don't** hardcode brand hexes (greens/oranges/reds) in component CSS. Reference the `--c-*` tokens, which mirror the theme.
- **Don't** use `#646cff` or any blue-purple. It is Vite's scaffold color, not a brand color.
- **Don't** apply `border-left` or `border-right` greater than 1px as a colored accent stripe on **content-area** elements: cards, list items, callouts, alerts. Use background tints instead.
- **Don't** apply `gradient text` (`background-clip: text` with a gradient). Single solid color only.
- **Don't** use `text-transform: uppercase` with `letter-spacing` on labels, nav items, or headings.
- **Don't** add box shadows to cards, inputs, or buttons at rest. The only shadow-like effect is the directional input focus glow.
- **Don't** use warm beige/sand/cream backgrounds. Surface neutrals must tint toward forest green, not warmth.
- **Don't** use pure neutral gray for any surface or text color. Every ink and surface value has a trace of `hue 155`.
- **Don't** use forest-bright for structural/static elements (borders, headings at rest). It is specifically the "live/interactive" green.
- **Don't** use forest-deep as text on dark backgrounds — it fails contrast (~1.7:1 on dark surfaces). Use `var(--c-accent)` which adapts to the dark primary green in dark mode.
- **Don't** put white text on the dark-mode green CTA fill (`#32bb64`) — it fails WCAG (~2.5:1). Use dark ink (`var(--c-cta-text)` = `#0d1310`, ~7.5:1).
- **Don't** design to attract or impress. Every visual decision should reduce friction toward producing the JSON file.
