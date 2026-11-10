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
- **Components never hardcode colours or font sizes** — always tokens. Contrast must meet AA.
  Use design tokens; no hardcoded colors or font sizes in components.
