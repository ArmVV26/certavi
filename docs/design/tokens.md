# Design tokens

Reference for `src/theme/tokens.css`. Palette **Hierro** and font **Archivo** (see
[decision.md](decision.md)). Components use these tokens only: never raw colours, font sizes or
pixel spacing.

## How the theme is applied

| Piece                       | What it does                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `<html data-theme="…">`     | `light` or `dark`: the **resolved** theme. Set by `initTheme()` in `main.tsx` before the first render. |
| No `data-theme` yet         | `@media (prefers-color-scheme: dark)` block: follows the system until the script runs (no flash).      |
| Preference                  | `system` · `light` · `dark`, saved in `localStorage` (`certavi.theme`). Device-only, never synced.     |
| `ThemeProvider`/`useTheme`  | Holds the preference, follows the system live (`matchMedia` change events) and re-applies the theme.   |
| `<meta name="theme-color">` | Browser / status bar colour = `--bg` of the active theme (`THEME_COLOR` in `src/theme/theme.ts`).      |

Header button order: automatic → light → dark → automatic (`nextThemePreference`).

### No-colour mode ("zero dopamine")

A second, independent switch: **Ajustes → Apariencia → "Sin color (modo 0 dopamina)"**. It puts
`data-mono` on `<html>` (set by `initTheme()` before the first render, so there is no flash) and
two blocks in `tokens.css`, `:root[data-mono][data-theme='light']` and `…'dark'`, replace the 12
colour tokens with greys. It is a device-only setting (`certavi.mono`, `'on'` / `'off'`), never
synced, and it does not change the theme preference or the header button.

- Components do not change: they already use tokens only. Everything that was a hue is now a
  brightness, so the meaning that used to live in the hue must also live in a shape or a text
  (the tick of a done set, the **C** of a warm-up, "faltan 4" / "✓" in the group bars).
- Brightness ladder (light / dark): `--accent` is the strongest, `--success` is a mid grey
  (`#6e6e6e` / `#9e9e9e`) so a "plan met" bar and a normal bar differ.
- `theme-color` uses `THEME_COLOR_MONO`; `tokens.test.ts` checks the same 18 AA pairs for both
  mono blocks, that every mono colour is a pure grey and that accent and success stay apart.
- This is the base of the backlog's "basic mode" (fewer sections), which is not built yet.

## Colour

| Token          | Light     | Dark      | Use                                                 |
| -------------- | --------- | --------- | --------------------------------------------------- |
| `--bg`         | `#f4f5f7` | `#0b0f14` | Page background                                     |
| `--surface`    | `#ffffff` | `#151b23` | Cards, sheets, tab bar                              |
| `--surface-2`  | `#eceef2` | `#1e2630` | Fields, secondary buttons, tracks                   |
| `--border`     | `#d5d9e0` | `#2e3846` | Dividers and outlines (decorative)                  |
| `--text`       | `#111827` | `#e6eaf0` | Main text                                           |
| `--text-muted` | `#4b5563` | `#9aa4b2` | Secondary text, suggested values, inactive tabs     |
| `--accent`     | `#1d4ed8` | `#60a5fa` | Primary actions, active tab, focus ring, links      |
| `--on-accent`  | `#ffffff` | `#0b1220` | Text and icons on `--accent`                        |
| `--success`    | `#166534` | `#4ade80` | Done set, improvement, plan met                     |
| `--warning`    | `#a8380a` | `#fb923c` | Warnings: over plan, pending sync, "does not count" |
| `--danger`     | `#b91c1c` | `#f87171` | Destructive actions: remove, delete                 |
| `--warmup`     | `#8a5300` | `#facc15` | Warm-up sets and their **C** / **W** symbol         |

**Tints** (`--accent-tint`, `--success-tint`, `--warning-tint`, `--danger-tint`, `--warmup-tint`):
`color-mix(in srgb, <colour> 12%, var(--surface))`. Backgrounds for chips, badges, done rows and
the rest timer. The colour itself is the text on its tint.

**Other:** `--overlay` (dialog / sheet scrim), `--focus-ring` (= `--accent`), `--shadow-1`
(cards), `--shadow-2` (dialogs, sheets, toasts).

### Contrast

`src/theme/tokens.test.ts` parses `tokens.css` and checks **18 text pairs per theme** (light, dark and the two no-colour themes) against
WCAG AA (≥ 4.5:1), tints included. Minimum today: **5.29:1**. The test fails if a token change
breaks AA, if the two dark blocks drift apart, or if `THEME_COLOR` stops matching `--bg`.

## Typography

| Token                                             | Value                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `--font-sans`                                     | `'Archivo Variable'`, then system fonts                                         |
| `--font-numeric`                                  | same family; use with `font-variant-numeric: var(--numeric-features)` (tabular) |
| `--fw-regular` … `--fw-black`                     | 400 · 500 · 600 · 700 · 800                                                     |
| `--fs-xs` `--fs-sm` `--fs-md` `--fs-lg` `--fs-xl` | 12 · 14 · 16 · 18 · 22 px                                                       |
| `--fs-2xl` `--fs-3xl` `--fs-display`              | 28 · 36 · 44 px                                                                 |
| `--lh-tight` `--lh-snug` `--lh-normal`            | 1.15 · 1.3 · 1.45                                                               |
| `--tracking-tight` `--tracking-caps`              | −0.01em (headings) · 0.06em (uppercase labels)                                  |

Sizes are in `rem`, so they follow the user's text size setting. The font is self-hosted with
`@fontsource-variable/archivo` (`src/theme/fonts.ts`); only the Latin subset is downloaded for
Spanish and English.

## Spacing, radii, sizes, motion

| Token                                                     | Value                                             |
| --------------------------------------------------------- | ------------------------------------------------- |
| `--space-1` … `--space-8`                                 | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 px            |
| `--radius-sm` `--radius-md` `--radius-lg` `--radius-full` | 8 · 12 · 16 px · pill                             |
| `--touch-target`                                          | 44 px (minimum tap size)                          |
| `--border-width` `--focus-ring-width`                     | 1 px · 2 px                                       |
| `--duration-fast` `--duration-normal`                     | 120 ms · 200 ms (0 with `prefers-reduced-motion`) |
| `--ease-standard`                                         | `cubic-bezier(0.2, 0, 0, 1)`                      |
