# Design decision

> **Status: decided.** Chosen with `docs/design/selector.html`. Implemented as tokens in
> `src/theme/tokens.css` (reference: [tokens.md](tokens.md)).

Date: 2026-11-02

## Choice

- Palette: **Hierro** (hierro)
- Fonts: **D · Atlética**: text Archivo Variable, numbers Archivo Variable (weight 700, tabular figures)
- Packages: `@fontsource-variable/archivo`
- Warm-up symbol: C (es) / W (en)
- Badge tint: 12 % of the colour over --surface
- Minimum contrast of the checked pairs: 5,29:1 (AA)

### Light

```css
--bg: #f4f5f7;
--surface: #ffffff;
--surface-2: #eceef2;
--border: #d5d9e0;
--text: #111827;
--muted: #4b5563;
--accent: #1d4ed8;
--on-accent: #ffffff;
--success: #166534;
--warning: #a8380a;
--danger: #b91c1c;
--warmup: #8a5300;
```

### Dark

```css
--bg: #0b0f14;
--surface: #151b23;
--surface-2: #1e2630;
--border: #2e3846;
--text: #e6eaf0;
--muted: #9aa4b2;
--accent: #60a5fa;
--on-accent: #0b1220;
--success: #4ade80;
--warning: #fb923c;
--danger: #f87171;
--warmup: #facc15;
```

## Why

- These colors are chosen because they are the most basic and standard, and they're also very pleasing to the eye.
- These fonts are chosen because they are visually appealing and stand out from those used by others.

## Candidates considered

| Palette | Idea                                                     |
| ------- | -------------------------------------------------------- |
| Hierro  | Neutral slate with electric blue; warm-up in ochre       |
| Tiza    | Warm off-white with safety orange; warm-up in blue       |
| Neón    | Lime on near-black, very sporty in dark; warm-up in cyan |
| Marea   | Calm teal; warm-up in violet                             |
| Ciruela | Strong violet; warm-up in sky blue                       |

| Fonts         | Text    | Numbers                  |
| ------------- | ------- | ------------------------ |
| A · Sobria    | Inter   | Inter, tabular figures   |
| B · Deportiva | Barlow  | Barlow Condensed         |
| C · Técnica   | Manrope | JetBrains Mono           |
| D · Atlética  | Archivo | Archivo, tabular figures |

All five palettes pass WCAG AA (≥ 4.5:1) on every colour pair the screens use, in light and dark,
including the tinted badges (12 % of the colour over `--surface`).

## Implementation notes

- In the app the muted text token is named `--text-muted` (the selector called it `--muted`).
- Numbers use the same family with tabular figures: `--font-numeric` + `--numeric-features`.
- The fonts that were not chosen are uninstalled. `selector.html` stays in the repo as the record
  of the comparison; regenerating it needs those font packages installed again.
