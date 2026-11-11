---
paths:
  - 'src/**/*.css'
  - 'src/ui/**'
  - 'src/features/**'
---

# Design tokens

- Defined in `src/theme/tokens.css` as CSS custom properties, chosen in Phase 1
  (see `docs/design/`).
- Semantic colour tokens (`--bg`, `--surface`, `--text`, `--accent`, `--success`, `--warning`,
  `--danger`, `--warmup`…) for light and dark; typography, spacing, radii and shadows.
- Theme: `system | light | dark`, applied through `data-theme` on `<html>`; `system` follows
  `prefers-color-scheme` live.
- No-colour mode ("zero dopamine"): `data-mono` on `<html>` plus the two `:root[data-mono]…`
  blocks (light and dark) in `tokens.css`; a device-only switch in Settings. A new colour token
  must be defined in **those blocks too** (`tokens.test.ts` fails otherwise), and a meaning must
  never depend on hue alone: give it a shape or a text as well.
- **Components never hardcode colours or font sizes** — always tokens. Contrast must meet AA.
  Use design tokens; no hardcoded colors or font sizes in components.
