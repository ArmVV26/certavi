# Design

Visual design decisions for Certavi. Filled in during **Phase 1**.

## Planned contents

| File            | What                                                                                                                                                                                 | Phase |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `selector.html` | Standalone page (no CDN) comparing 5 palettes × 4 font pairings, light and dark, on three mini screens (Today, active session with a warm-up set, Progress), with AA contrast checks | 1     |
| `decision.md`   | The chosen palette and fonts, and why                                                                                                                                                | 1     |
| `tokens.md`     | Reference of the design tokens implemented in `src/theme/tokens.css`                                                                                                                 | 1     |

## Principles

- **Readable at a glance in the gym:** large numbers, strong contrast, big touch targets.
- **State must be obvious:** done set, pending set and warm-up set (with its **C** / **W**
  symbol) are distinguishable without reading.
- **Light, dark and automatic** themes, all meeting **WCAG AA** contrast.
- **Self-hosted fonts** (`@fontsource/*`): nothing loaded from third parties, works offline.
- **Respect `prefers-reduced-motion`.**

## Token naming (to be confirmed in Phase 1)

- Colour (semantic): `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`,
  `--accent`, `--on-accent`, `--success`, `--warning`, `--danger`, `--warmup`.
- Typography: `--font-sans`, `--font-numeric`, `--fs-xs` … `--fs-3xl`, `--fw-regular`,
  `--fw-bold`.
- Spacing: `--space-1` … `--space-8`. Radii: `--radius-sm`, `--radius-md`, `--radius-lg`.
  Shadows: `--shadow-1`, `--shadow-2`.

Components use tokens only — never raw colours or font sizes.
