# Design

Visual design decisions for Certavi. Decided in **Phase 1**: palette **Hierro**, font **Archivo**.

## Contents

| File                       | What                                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [decision.md](decision.md) | The chosen palette and fonts, why, and the candidates considered                                                                                                      |
| [tokens.md](tokens.md)     | Reference of the design tokens in `src/theme/tokens.css` and how the theme is applied                                                                                 |
| `selector.html`            | Standalone page (no CDN) that compared 5 palettes × 4 font pairings, light and dark, on three mini screens, with AA contrast checks. Kept as a record of the decision |

`selector.html` is **generated**: edit `scripts/selector/template.html` and run
`node scripts/build-selector.mjs`. Regenerating it needs the candidate `@fontsource*` packages,
which were uninstalled after the choice.

## Principles

- **Readable at a glance in the gym:** large numbers, strong contrast, big touch targets.
- **State must be obvious:** done set, pending set and warm-up set (with its **C** / **W**
  symbol) are distinguishable without reading.
- **Light, dark and automatic** themes, all meeting **WCAG AA** contrast (enforced by
  `src/theme/tokens.test.ts`).
- **Self-hosted fonts** (`@fontsource-variable/archivo`): nothing loaded from third parties,
  works offline.
- **Respect `prefers-reduced-motion`** (durations drop to 0).

Components use tokens only — never raw colours or font sizes.
