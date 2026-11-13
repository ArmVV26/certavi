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
- **Modelling state** (ADR-0006): a lifecycle (a dialog, a form that saves, an import, a sync
  status) is **one discriminated union** (`{ kind: 'idle' } | { kind: 'saving'; … }`), not several
  booleans or nullables that must agree. Walk it with a `switch` that lists every member, with no
  catch-all `else` (`@typescript-eslint/switch-exhaustiveness-check` is on). An async action has an
  in-progress state that blocks sending it twice. A **stored or synced record never changes shape**
  to model state (sync-v1 only allows additive changes): derive a view (`isInProgress` and
  `isWeekFrozen` in `src/domain/rules`, `heroOf` in the Today model) and use that everywhere.
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
