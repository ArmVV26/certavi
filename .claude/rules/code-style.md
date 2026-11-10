---
paths:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.js'
  - '**/*.mjs'
  - '**/*.css'
---

# Code conventions

- **TypeScript strict** (+ `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
  `erasableSyntaxOnly`: no enums or namespaces — use union types and `as const` objects).
  No `any` without a comment explaining why.
- **Named exports** for components and modules (no default exports, except where a tool
  requires one, e.g. config files).
- **Files:** components `PascalCase.tsx`, everything else `camelCase.ts`; tests next to the
  code as `*.test.ts(x)`; CSS Modules as `Component.module.css`.
- **Imports:** use `import type` for types (enforced by `verbatimModuleSyntax`).
- **No browser dialogs:** `window.alert/confirm/prompt` are banned (ESLint `no-alert`);
  use the `Dialog` component.
- **Accessibility:** semantic HTML first; `jsx-a11y` rules are on. Every interactive element
  must be reachable and labelled.
- **Formatting:** Prettier (single quotes, 100 columns, trailing commas, LF). Line endings are
  LF everywhere (`.gitattributes`, `.editorconfig`).
