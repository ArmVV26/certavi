# History Phase Log

## <a id="seccion8"></a> 8. Claude Code: reglas, agentes y comandos

Contenido que se crea en la Fase 0. Se deja aquí el borrador para que la fase sea mecánica.

### 8.1 `.claude/rules.md` (se importa desde `CLAUDE.md` con `@.claude/rules.md`)

```markdown
# Working rules for Claude Code in Certavi

## Git — the user owns history

- NEVER run `git commit`, `git push`, `git merge`, `git rebase`, `git tag`, `git reset --hard`,
  `git checkout -b`/`git switch -c` or create/delete branches. The user does all of that.
- You MAY run read-only git: `git status`, `git diff`, `git log`, `git branch`.
- At the end of every phase or task, output a commit plan: branch to use, list of commits
  (Conventional Commits, English), the exact files for each commit, and the PR/tag steps.

## Dependencies

- Do NOT install, update or remove packages on your own. When a package is needed, stop and tell
  the user: package name, version, dev or runtime, why it is needed, and the exact command.
  Continue only after the user confirms they ran it.
- Never use global installs.

## Processes and ports (Windows)

- Never leave a server running. If you start one (`vite`, `vite preview`, `netlify dev`,
  the mock sync server, Playwright web server), stop it before finishing the task and
  verify the port is free (`npm run ports:check`). Ports used: 5173, 4173, 8888, 8787.
- Prefer one-shot commands: `vitest run` (not watch), `playwright test` with its own webServer.
- If a port is busy at start, report it instead of picking another one silently.

## Data and secrets

- Never read, copy or commit real user data (exported JSON from the old app) or `.env*`.
- Never print or hardcode `CLAVE_SYNC` or any secret. Tests use synthetic data only.

## Code

- TypeScript strict. No `any` without a comment explaining why.
- Domain logic lives in `src/domain` (pure, no React/Dexie) and must have tests.
- UI text always through i18n keys (es + en). No hardcoded user-facing strings.
- Use design tokens; no hardcoded colors or font sizes in components.
- No `window.confirm/alert/prompt`: use the `Dialog` component.
- Keep the sync contract in `docs/api/sync-v1.md` and `src/domain/sync/contract.ts` in sync.

## Before saying a task is done

- `npm run lint && npm run typecheck && npm run test` pass.
- `npm run build` passes when the task touches build/PWA/functions.
- No server left running. Updated docs if behaviour changed.
- Ask the context-keeper agent to update context.md at the end of a phase.

## Scope

- Do only what the current phase/task asks. If you see something else worth doing,
  list it under "Suggestions" in your final message instead of doing it.
- Do not delete or rewrite tests to make them pass without explaining why.
```

### 8.2 `.claude/settings.json` (refuerza las reglas con permisos)

```json
{
  "permissions": {
    "deny": [
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git merge:*)",
      "Bash(git rebase:*)",
      "Bash(git tag:*)",
      "Bash(git reset --hard:*)",
      "Bash(git checkout -b:*)",
      "Bash(git switch -c:*)",
      "Bash(git branch -d:*)",
      "Bash(git branch -D:*)",
      "Bash(npm install -g:*)",
      "Read(./.env*)",
      "Read(./backups/**)"
    ],
    "ask": [
      "Bash(npm install:*)",
      "Bash(npm i:*)",
      "Bash(npm uninstall:*)",
      "Bash(npm update:*)",
      "Bash(npx netlify:*)"
    ],
    "allow": [
      "Bash(npm run lint:*)",
      "Bash(npm run typecheck:*)",
      "Bash(npm run test:*)",
      "Bash(npm run build:*)",
      "Bash(npm run e2e:*)",
      "Bash(npm run ports:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)"
    ]
  }
}
```

Al terminar la Fase 0, comprueba en VS Code con `/permissions` que Claude Code los ha cargado.

### 8.3 Agentes (`.claude/agents/`)

**`context-keeper.md`**

```markdown
---
name: context-keeper
description: Keeps project memory up to date. Use at the end of every phase or after any decision that changes scope, architecture, data model or workflow.
tools: Read, Edit, Write, Grep, Glob
---

You maintain Certavi's project memory. You never touch src/, tests/ or config.
On each run:

1. Read context.md, CLAUDE.md, CHANGELOG.md and the diff summary the main agent gives you.
2. Update context.md: phase status (✅/🚧/⏳), what was completed, decisions taken (with date),
   open questions, next phase prompt if it changed, and the progress log (section 12).
3. Update CHANGELOG.md (Keep a Changelog, "Unreleased" until the user tags).
4. Update CLAUDE.md only if structure, commands, conventions or architecture changed.
5. Reply with a short list of what you changed. Be factual: never mark something done
   unless the main agent confirmed tests pass.
```

**`blind-tester.md`**

```markdown
---
name: blind-tester
description: Black-box QA. Tests Certavi like a real user using only the functional spec. Use after a feature is implemented and before closing a phase.
tools: Read, Write, Edit, Bash, Glob
---

You are a QA engineer who has NEVER seen the source code.

- You may read ONLY: docs/spec/**, README.md, tests/e2e/**, tests/mocks/**, playwright.config.ts.
- You must NOT read src/** or netlify/**. If you need a selector, use accessible roles,
  labels and visible text (getByRole/getByLabel/getByText) as a user would.
- Write Playwright tests in tests/e2e/ from the acceptance criteria of the phase,
  including edge cases a real user would hit: offline, reload mid-session, 0 kg, undo,
  wrong input, small iPhone viewport (390x844), dark mode, Spanish and English.
- Run them with `npm run e2e`. Playwright starts and stops its own servers; make sure
  no port is left busy (`npm run ports:check`).
- Report: passed / failed tests, and for each failure the steps to reproduce, expected vs
  actual, and a screenshot path. Do not fix application code. Do not weaken tests to pass.
```

### 8.4 Comandos (`.claude/commands/`)

- **`/start-phase N`**: lee `context.md`, la sección de la fase N y `CLAUDE.md`; resume objetivos, entregables y criterios de aceptación; pide confirmación antes de escribir código; y recuerda la rama que debes crear tú (`git switch dev && git switch -c feature/...`).
- **`/close-phase`**:
  1. ejecuta `lint`, `typecheck`, `test` y `build`;
  2. lanza el blind-tester (`npm run e2e`; en la **última rama de la fase**, además `npm run e2e:all` una vez antes del PR `dev → main`, desde el 2026-11-04, 2.5);
  3. lanza el context-keeper;
  4. comprueba que no queda ningún puerto ocupado;
  5. devuelve el **plan de commits**, con este formato:

```
Rama actual: feature/xxx
Commits (en este orden):
1. chore: add vitest config
   git add vitest.config.ts package.json
   git commit -m "chore: add vitest config"
2. ...
Después:
- git push -u origin feature/xxx → PR a dev («feat: …»), merge (squash NO: merge commit para conservar commits)
- Si es fin de fase: PR dev → main, versión X.Y.Z en package.json (commit "chore(release): vX.Y.Z"),
  git tag -a vX.Y.Z -m "…", git push origin vX.Y.Z
```

### 8.5 Scripts de `package.json` (de la Fase 0)

```
dev           vite
build         tsc -b && vite build
preview       vite preview
lint          eslint .
typecheck     tsc -b
test          vitest run
test:watch    vitest
test:coverage vitest run --coverage; umbral 90 % en src/domain (nuevo, 2026-11-03; lo ejecuta CI), en src/data (desde la Fase 3, 2.4) y en server/** (desde la Fase 4)
e2e           playwright test --project=chromium   (desde 2026-11-02; antes: playwright test)
e2e:all       Chromium + WebKit, --global-timeout=600000   (nuevo, 2026-11-02)
format        prettier --write .
format:check  prettier --check .
ports:check   node scripts/ports-check.mjs (dice qué ocupa 5173/4173/8888/8787/9323)
ports:kill    libera 5173 4173 8888 8787 9323
prepare       husky
```

> `e2e`, `e2e:all` y el puerto 9323 cambiaron el 2026-11-02 (sección 2.2, límites de e2e).

> `typecheck` es `tsc -b` y no `tsc --noEmit -p .` (decisión del 2026-11-02, sección 2.1): el `tsconfig.json` raíz solo contiene referencias, así que `-p .` no comprobaría nada.

---

## <a id="seccion9"></a> 9. Preparación antes de la Fase 0

Esto lo haces tú, una vez y a mano.

1. **Exporta tus datos** de `gym_app` (sección 6, punto 1).
2. **Instala Node 22 LTS** (desde nodejs.org o con `nvm-windows`) y comprueba con `node -v` y `npm -v`.
3. **Git en Windows.** Comprueba la identidad con la que firmarás:
   ```powershell
   git config --global user.name
   git config --global user.email      # debe ser el email de tu cuenta de GitHub
   git config --global core.autocrlf false
   git config --global init.defaultBranch main
   ```
4. **Crea el repositorio** en GitHub: `certavi`, **Private**, sin README (lo genera la Fase 0). Clónalo:
   ```powershell
   cd C:\dev            # o tu carpeta de proyectos
   git clone https://github.com/<tu-usuario>/certavi.git
   cd certavi
   ```
5. **Coloca este archivo** en la raíz como `context.md` y haz el primer commit en `main`. Es el único commit que se hace directamente en `main`:
   ```powershell
   git add context.md
   git commit -m "docs: add project context and plan"
   git push -u origin main
   git switch -c dev
   git push -u origin dev
   ```
6. **VS Code**: instala la extensión de Claude Code y abre la carpeta `certavi`.
7. **Netlify**: todavía nada. El proyecto nuevo se crea en la Fase 4, cuando haya backend que desplegar.

> **Nota (2026-11-02, Fase 0):** los hooks de husky solo se activan con un `npm install` / `npm ci` sin argumentos (script `prepare`), no al instalar paquetes concretos. En este repo se activaron con `npm run prepare`. El `core.autocrlf` de git del usuario ya está en `false`.

---

## 10. Hoja de ruta por fases

### <a id="fase0"></a> Fase 0 · Base del proyecto → `v0.1.0` ✅

**Rama**: `chore/project-setup`

**Estado (2026-11-02)**: **cerrada**. El usuario hizo los commits, el PR a `dev`, el PR `dev → main` y el tag `v0.1.0`.

- Hecho: Vite 8 + React 19.3 + TypeScript 6.0.3 strict (`src/app/App.tsx`, `main.tsx`) y estructura de 3.3 con `.gitkeep`; `tsconfig.json` (referencias) + `tsconfig.app.json` + `tsconfig.node.json` + `tsconfig.e2e.json`; ESLint 9 flat (typescript-eslint `strictTypeChecked`, react, react-hooks, react-refresh, jsx-a11y, prettier); Prettier; Vitest 5 + RTL + jsdom 30 (`src/test/setup.ts`, `src/app/App.test.tsx`); Playwright 1.64 (chromium + webkit, 390×844, webServer `vite build` + `vite preview` en 4173 con `strictPort` y `reuseExistingServer: false`; `tests/e2e/smoke.spec.ts`); husky (solo `commit-msg`) + commitlint con los ámbitos de 7.2 más `release` y `deps`; scripts de 8.5 (incluidos `ports:check`, `ports:kill`, `format`, `format:check`); `.gitattributes`, `.editorconfig`, `.nvmrc` (22), `.gitignore`, `LICENSE`; CI `.github/workflows/ci.yml` (PR a `dev`/`main`: `npm ci`, lint, typecheck, test, build; `actions/checkout@v7`, `setup-node@v7`); `.claude/` (rules, settings con reglas deny/ask/allow para Bash **y** PowerShell, agentes y comandos); `CLAUDE.md`, `README.md`, `CHANGELOG.md`; `docs/spec/README.md`, `docs/api/sync-v1.md` (borrador), `docs/adr/0001` y `0002`, `docs/migration.md`, `docs/design/README.md`.
- Verificado en Windows (Node 26.13.0 local): `lint` ✅, `typecheck` ✅, `test` ✅ (2 tests de componente), `build` ✅, `format:check` ✅, `e2e` ✅ (4 pasados: título + encabezado y sin scroll horizontal a 390 px, en chromium y webkit a 390×844), `ports:check` ✅ (todos libres tras e2e).
- Permisos comprobados: `git commit --dry-run` denegado desde las herramientas Bash y PowerShell.
- Decisiones de la fase: sección 2.1.

**Objetivo**: proyecto vacío pero completo en herramientas: compila, testea, tiene CI, documentación y la configuración de Claude Code.

**Entregables**:

- Vite + React + TS strict.
- ESLint, Prettier, Vitest + RTL, Playwright (configurado, con un test de humo).
- husky + commitlint.
- `.gitattributes` (`* text=auto eol=lf`), `.editorconfig`, `.nvmrc`, `.gitignore` (incluye `backups/`, `.env*`, `.netlify/`, `playwright-report/`).
- Scripts de la sección 8.5.
- `.claude/` completo (sección 8).
- `CLAUDE.md`, `README.md` y `CHANGELOG.md`.
- `docs/` con su estructura y **ADR-0001** (backend opción A) y **ADR-0002** (offline-first + LWW).
- CI de GitHub Actions.

**Criterios de aceptación**:

- `npm run lint`, `typecheck`, `test`, `build` y `e2e` pasan en Windows.
- Claude Code no puede hacer commit (probado: lo intenta y se le deniega).
- No queda ningún puerto ocupado tras `e2e`.

**Prompt**:

```text
Lee context.md completo. Vamos a ejecutar la FASE 0 de Certavi.

Crea la base del proyecto en este repositorio (estoy en Windows + VS Code):
1. Vite + React + TypeScript strict. Estructura de carpetas de la sección 3.3 (con archivos .gitkeep donde haga falta).
2. Herramientas: ESLint (flat config, reglas de React y TS), Prettier, Vitest + React Testing Library + jsdom,
   Playwright (solo Chromium y WebKit, viewport iPhone 390x844, webServer que arranca y para solo),
   husky + commitlint (config-conventional). Scripts de la sección 8.5, incluido ports:check y ports:kill.
3. Archivos de repo: .gitattributes (eol=lf), .editorconfig, .nvmrc (22), .gitignore.
4. .claude/: rules.md, settings.json, agents/context-keeper.md, agents/blind-tester.md,
   commands/start-phase.md y commands/close-phase.md, con el contenido de la sección 8 (en inglés).
5. CLAUDE.md (en inglés), muy completo: qué es Certavi, objetivos, stack, arquitectura y capas, estructura de
   carpetas, modelo de dominio resumido, convenciones de código, i18n, tokens de diseño, cómo se testea,
   comandos, flujo de ramas y commits, reparto de papeles (yo hago commits/ramas/tags), cómo usar los dos
   agentes, y que importe las reglas con @.claude/rules.md y remita a context.md para el estado.
6. README.md (en inglés), sólido y de portfolio: descripción, capturas (placeholder), características,
   stack, arquitectura con diagrama, offline-first y sincronización, estructura, requisitos, instalación,
   scripts, tests, despliegue en Netlify, variables de entorno (CLAVE_SYNC, sin valor), flujo de
   contribución (ramas, Conventional Commits, versiones), hoja de ruta y licencia (pregúntame cuál).
7. CHANGELOG.md (Keep a Changelog) con la entrada 0.1.0 en Unreleased.
8. docs/: spec/README.md (índice de la especificación funcional, que iremos llenando), api/sync-v1.md
   (contrato de la sección 3.5 y 3.4, basado en el sync actual), adr/0001-backend-netlify-blobs.md,
   adr/0002-offline-first-lww-sync.md, migration.md (sección 6), design/README.md.
9. GitHub Actions .github/workflows/ci.yml: en PR a dev y main → npm ci, lint, typecheck, test, build.
10. Un test unitario de ejemplo y un e2e de humo (la app carga y muestra el título).

Antes de instalar NADA, dame la lista completa de paquetes (runtime y dev) con el comando exacto para que lo
ejecute yo. Espera a que te confirme. Al terminar, ejecuta /close-phase.
```

---

### <a id="fase1"></a> Fase 1 · Diseño, tema, i18n y navegación → `v0.2.0` ✅

**Ramas**: `feature/design-system` y `feature/app-shell`

**Estado (2026-11-03)**: **cerrada**. El usuario hizo los commits, el PR de `feature/app-shell` a `dev` (PR #4), el PR `dev → main`, el commit `chore(release): v0.2.0` y el tag `v0.2.0`. Decisiones en la sección 2.2.

- **Hecho — `feature/design-system`** (mergeada en `dev` con el PR #3; ámbito de commit `theme`): selector de paletas `docs/design/selector.html` (generado por `scripts/build-selector.mjs`); decisión paleta «Hierro» + fuente «Archivo» (`docs/design/decision.md`); tokens (`src/theme/tokens.css`, `docs/design/tokens.md`); motor de tema (system/light/dark guardado en `localStorage`, cambios del sistema en vivo, `theme-color`).
- **Hecho — `feature/app-shell`** (mergeada en `dev` con el PR #4):
  - i18n es/en en `src/i18n` (i18next + react-i18next, claves tipadas, formato `Intl` es-ES / en-GB, idioma guardado en el dispositivo);
  - ajustes del dispositivo en `src/data/deviceStorage.ts`;
  - shell con react-router 8 en `src/app`: rutas, `Layout` con título en la cabecera y botón de tema, barra de pestañas inferior en móvil / barra superior desde 768 px, enlace «saltar al contenido», foco al título de la página al navegar, página 404;
  - páginas vacías: Hoy (con la fecha localizada), Calendario, Rutinas, Progreso; Ajustes con tema e idioma;
  - componentes base en `src/ui`: Button, IconButton, Chip, Tag, Card, Dialog, ConfirmDialog, Sheet, Toast, NumberField, Segmented, Switch, EmptyState, Icon; catálogo interno `/dev/ui`;
  - especificación `docs/spec/theme-language-navigation.md`;
  - cambio en el criterio de humo: el encabezado principal de `/` ahora es «Hoy» («Certavi» se queda en el título de la pestaña).
- **Paquetes añadidos en la fase**: `@fontsource-variable/archivo` 5.3.0, `react-router` 8.5.1, `i18next` 26.7.1, `react-i18next` 17.1.11; dev: `@axe-core/playwright` 4.14.0.
- **Verificado en `feature/app-shell` (2026-11-02)**: `lint` ✅, `typecheck` ✅, `test` ✅ (179 tests en 16 archivos), `build` ✅, `format:check` ✅; puertos libres tras las ejecuciones (5173, 4173, 8888, 8787, 9323).
- **Helpers de test**: `src/test/render.tsx` (`renderWithProviders`) y `src/test/renderApp.tsx` (`renderApp(path)`: la app completa con un router en memoria).
- **E2E ✅**: 5 archivos de spec en `tests/e2e`. La suite se **redujo a propósito** (decisión del usuario, sección 2.2) de 111 a **38 tests por navegador**: navegación 12, tema 9, idioma 5, componentes 11, humo 1; axe una vez por pantalla y tema, solo en Chromium; AC-NAV-09 (Tab al enlace «saltar al contenido») es excepción documentada de WebKit.
  - Ejecución válida (blind-tester, `npm run e2e`, una sola ejecución, Chromium, 2 workers): **38 pasados, 0 fallidos, 0 omitidos en 18,2 s** (≈19 s en total).
  - Antes de la reducción, el usuario ejecutó `npm run e2e` con la suite de 111 tests: todo pasó en 33 s.
- **Criterios de aceptación cubiertos** por e2e y tests unitarios/de componente que pasan: el tema sigue al sistema y el botón de la cabecera lo cambia; UI en es/en; Dialog accesible (foco atrapado, Escape, lector de pantalla); tema, idioma y navegación validados a 390×844.
- **Release (hecha por el usuario)**: commits de `feature/app-shell`, PR #4 a `dev`, PR `dev → main`, `chore(release): v0.2.0` y tag `v0.2.0`.

**Objetivo**: decidir el aspecto y dejar el esqueleto navegable.

**Pasos**:

1. **Selector de diseño**:
   - Claude Code genera `docs/design/selector.html`, una página autónoma que abres en el navegador.
   - Muestra **5 paletas** y **4 combinaciones de fuentes** aplicadas a 3 pantallas reales en miniatura: Hoy, sesión activa con una serie de calentamiento y Progreso.
   - Todo en claro y en oscuro, con interruptores para combinarlas.
   - **Tú eliges** y lo apuntas en `docs/design/decision.md`.
2. **Tokens de diseño**:
   - colores semánticos (`--bg`, `--surface`, `--text`, `--accent`, `--success`, `--warning`, `--danger`, `--warmup`…) para claro y oscuro;
   - tipografía, espaciado, radios y sombras;
   - fuentes autoalojadas;
   - contraste AA comprobado.
3. **Tema**:
   - preferencia `system | light | dark` guardada en el dispositivo;
   - **botón sol/luna en la cabecera** (cicla entre automático, claro y oscuro);
   - detección con `prefers-color-scheme` y escucha del cambio del sistema en vivo;
   - `theme-color` del navegador acorde.
4. **i18n**: `es` por defecto y `en`, selector en Ajustes; fechas y números con `Intl` (formato español, coma decimal).
5. **Shell de la app**:
   - layout móvil con barra inferior (Hoy, Calendario, Rutinas, Progreso, Ajustes) y en escritorio arriba;
   - rutas vacías;
   - componentes base de `src/ui`: Button, IconButton, Chip, Tag, Card, Dialog (sustituye a `confirm`), Sheet, Toast, NumberField, Segmented, Switch y EmptyState;
   - página interna `/dev/ui` para verlos.

**Criterios de aceptación**:

- El tema sigue al sistema y el botón lo cambia.
- Toda la UI está en español y en inglés.
- El Dialog es accesible: foco atrapado, Escape y lector de pantalla.
- El tester valida tema, idioma y navegación en 390×844.

**Prompt (paso 1)**:

```text
Lee context.md y CLAUDE.md. FASE 1, paso 1: selector de diseño.
Crea docs/design/selector.html, autónomo (sin CDN; fuentes en base64 o desde node_modules/@fontsource si
ya están instaladas — si hacen falta paquetes, pídemelos), con 5 paletas y 4 combinaciones de fuentes
pensadas para una app de entrenamiento de fuerza que se usa en el gimnasio (legible de un vistazo, números
grandes, estado de serie hecha/calentamiento muy claro). Cada opción aplicada en claro y oscuro a tres
pantallas en miniatura: Hoy, sesión activa (con una serie de calentamiento marcada con su símbolo) y Progreso.
Interruptores para combinar paleta + fuente + tema. Comprueba contraste AA de texto y acentos y muéstralo.
No toques src/. Al terminar, dime cómo abrirlo y para.
```

**Prompt (pasos 2-5)**, tras elegir:

```text
Elegí la paleta <X> y las fuentes <Y> (apuntado en docs/design/decision.md). FASE 1, pasos 2 a 5 de context.md:
tokens de diseño, tema system/light/dark con botón en cabecera y detección en vivo, i18n es/en y shell de
la app con los componentes base de src/ui y la página /dev/ui. Escribe la especificación funcional de
tema, idioma y navegación en docs/spec/ (la usará el blind-tester). Tests de componentes con RTL.
Al terminar, /close-phase.
```

---

### <a id="fase2"></a> Fase 2 · Dominio y catálogo → `v0.3.0` ✅

**Rama**: `feature/domain-model`

**Estado (2026-11-03)**: **cerrada**. El usuario hizo los commits, el PR #6 a `dev`, el PR #7 `dev → main` y el tag `v0.3.0` (sobre el merge del PR #7). No hubo commit `chore(release): v0.3.0`: `package.json` quedó en 0.2.0 y la entrada `[0.3.0]` del `CHANGELOG.md` se añadió después, en `feature/local-db`. Decisiones en la sección 2.3.

- **Implementado — `src/domain`** (TS puro, sin React, Dexie ni `fetch`; mergeado en `dev` con el PR #6):
  - `model/`: esquemas zod + tipos de todas las entidades de 4.1 con la envoltura (`envelope.ts`: `RECORD_TYPES` `exercise`, `routine`, `weekPlan`, `session`, `set`, `note`, `activity`, `bodyWeight`, `block`, `blockLog`, `weeklyMetric`, `settings`; esquema de tombstone; `TextRef` = `{ key }` (clave i18n, datos semilla) | `{ text }` (texto del usuario)); `enums.ts` (tuplas `as const`); `records.ts` con `RECORD_SCHEMAS` y `parseRecord` (valida por tipo; los registros borrados solo necesitan la envoltura). Ids derivados: `week_<lunes>`, `bw_<lunes>`, `note_<sesión>_<ejercicio>`, `blocklog_<bloque>_<fecha>`, `wmetric_<bloque>_<métrica>_<lunes>`, ajustes `settings`.
  - `dates.ts`: fechas locales ISO `YYYY-MM-DD`, semanas desde el lunes.
  - `rules/`: 1RM Epley (ignora calentamiento y aproximación); series efectivas (la aproximación cuenta, el calentamiento no, 0 reps no); back-off (−10 % redondeado al incremento, al menos un escalón por debajo del top); progresión (`progressionAdvice`); referencia «la última vez» (`lastReference`: salta sesiones «no cuenta» y de descarga); series semanales por grupo frente al plan; plan semanal (vivo frente a congelado al cerrar, `closeWeek`, `weeksToClose`); descarga (port de gym_app); semana corta (`WEEK_ROUTINES`); récords (peso máximo, mejor 1RM estimado, mejor volumen, récords por repeticiones con la regla de Hevy, eventos de récord).
  - `seed/`: **45 ejercicios** (todos los ids de gym_app salvo `abdomen`, más el nuevo `hack-banda`); **6 rutinas** de `rutina-actual.md`; bloque «Rehabilitación del tobillo» (8 elementos, métricas de dolor escaleras/pogos 0-10 con umbral 3, métrica semanal test de la pared izquierda/derecha en cm) y bloque «Estiramientos» vacío e inactivo; `legacyAliases.ts` (`abdomen` → `crunch-maquina`, `resolveExerciseId`).
- **i18n**: claves nuevas en `es.json`/`en.json`: `exercises.names.*`, `exercises.groups.*`, `exercises.equipment.*`, `routines.names.*`, `routines.notes.*`, `blocks.*`; el test `src/i18n/seedKeys.test.ts` comprueba que cada clave semilla existe en los dos idiomas.
- **Tests**: Vitest dividido en dos proyectos en `vite.config.ts`: `domain` (entorno node, `src/domain/**/*.test.ts`; cualquier uso del DOM falla, lo vigila `src/domain/environment.test.ts`) y `ui` (jsdom + setup de RTL, el resto). Cobertura v8 sobre `src/domain/**` con umbrales del 90 % (líneas, funciones, ramas, sentencias); script nuevo `npm run test:coverage`. CI (`.github/workflows/ci.yml`) ejecuta `npm run test:coverage` en lugar de `npm run test`. La suite pasó de ~39 s a ~18 s en local.
- **Paquetes añadidos en la fase** (instalados por el usuario): `zod` 4.6.7 (runtime); dev: `@vitest/coverage-v8` 5.1.0.
- **Documentación**: `docs/spec/rules.md` nuevo (las reglas desde el punto de vista del usuario, con ejemplos numéricos); índice `docs/spec/README.md` (enlaza `rules.md` y marca `theme-language-navigation.md` como cubierta por e2e); `docs/migration.md`: sección de ids semilla de la Fase 2 (alias de `abdomen`, ejercicios fuera de rutina, ids de rutina, mapeo de `kind`/`slot` de series: `aprox` → `approach`, `work` → `straight`, slots `w/p/x` → número de slot, `hiking` frente a `size`, `updatedAt` 0 en la semilla).
- **Verificado en `feature/domain-model` (2026-11-03)**: `lint` ✅, `typecheck` ✅, `test` ✅ (**326 tests en 27 archivos**; antes 179 en 16), `build` ✅, `format:check` ✅.
  - `test:coverage` ✅: `src/domain` sentencias 100 %, ramas 96,86 %, funciones 100 %, líneas 100 %. Comprobado que subir el umbral por encima del valor real hace que el comando salga con código 1.
  - Regresión e2e (blind-tester, `npm run e2e`, una sola ejecución, Chromium, 2 workers): **38 pasados, 0 fallidos, 0 omitidos en 46,1 s**. Sin specs e2e nuevas (la fase no tiene pantallas).
  - Puertos 5173, 4173, 8888, 8787 y 9323 libres.
- **Criterios de aceptación** ✅: cobertura ≥ 90 % en `src/domain`; test de que las series planificadas de la semana normal suman **104** y cuadran por grupo (cuádriceps 16, isquios-glúteos 15, espalda 14, pecho 13, hombros 13, tríceps 8, bíceps 8, gemelos 8, core 6, antebrazos 3). Verificado también: semana de 4 sesiones 81, de 3 sesiones 63 y de descarga 62.
- **Aplazado a la Fase 7**: regla del gemelo durante la rehabilitación y revisión del ciclo (ver la Fase 7).
- **Release (hecha por el usuario)**: commits de `feature/domain-model`, PR #6 a `dev`, PR #7 `dev → main` y tag `v0.3.0`.

**Objetivo**: todo el modelo de la sección 4 en `src/domain`, puro y con tests. Sin UI.

**Entregables**:

- Tipos y esquemas zod de todas las entidades.
- Reglas: 1RM, progresión, back-off, recuento semanal, récords, descarga, semana corta y plan semanal.
- **Catálogo semilla** con equipo, straps, banda, grupos, secundarios e incrementos (tabla 4.3).
- **Rutinas semilla** de `rutina-actual.md` y bloque de rehabilitación semilla.

**Antes de empezar**: revisa y corrige la tabla de equipo y straps de la sección 4.3 (las «?»).

**Criterios de aceptación**:

- Cobertura ≥ 90 % en `src/domain`.
- Test de que las series planificadas de la semana normal suman **104** y cuadran por grupo con `rutina-actual.md`.

**Prompt**:

```text
Lee context.md (secciones 4 y 5) y CLAUDE.md. FASE 2: modelo de dominio en src/domain, TypeScript puro sin
React ni Dexie. Tipos + esquemas zod de todas las entidades de 4.1 con la envoltura SyncEnvelope; reglas de
4.2 como funciones puras (y clases solo donde aporten); catálogo semilla con la tabla 4.3 corregida que te
paso aquí: <pega la tabla corregida>; rutinas semilla según la rutina vigente que te paso: <pega
rutina-actual.md>; bloque de rehabilitación semilla. Conserva los ids de ejercicio de gym_app.
Tests exhaustivos (incluido: total semanal 104 y por grupo). Documenta las reglas en docs/spec/rules.md.
Al terminar, /close-phase.
```

---

### <a id="fase3"></a> Fase 3 · Datos locales, importador y exportaciones → `v0.4.0` ✅

**Ramas**: `feature/local-db` y `feature/import-export` (antes `feature/legacy-import`; incluye el importador de gym_app, la importación de JSON propio y las exportaciones JSON/CSV)

**Estado (2026-11-03)**: **cerrada**. Rama 1 (`feature/local-db`) mergeada en `dev` con el **PR #8** (7 commits); rama 2 (`feature/import-export`) mergeada en `dev` con el **PR #9**; el usuario hizo el PR `dev → main`, el commit `chore(release): v0.4.0` en `dev` y el tag `v0.4.0`. Decisiones en la sección 2.4.

- **Implementado — `feature/local-db`** (mergeada en `dev` con el PR #8):
  - `src/data/db.ts` (`openDatabase`, `TABLES`, `tableOf`, `recordTables`, `isLive`; tipos `StoredRecord`, `TombstoneOf`, `PendingEntry`, `MetaEntry`, `CertaviDb`), `clock.ts` (`reserveTimestamps`), `repository.ts` (`createRepository`, `createRepositories`: `get`/`list`/`put`/`putMany`/`remove`), `seed.ts` (`ensureSeed`), `persistence.ts` (`getStorageStatus`, `requestPersistentStorage`), `queries.ts` (`countLiveRecords`, `countPending`), `startup.ts` (`startDatabase`), `DatabaseContext.ts` (`useDatabase`) y `DatabaseProvider.tsx`.
  - `main.tsx` abre la base de datos y ejecuta `startDatabase`; `Providers` recibe ahora una prop `db`; `src/test/render.tsx` añade `openTestDatabase()` y una opción `db` (base de datos nueva y vacía en cada render, sin semilla); `src/test/setup.ts` carga `fake-indexeddb/auto`.
  - Dominio: tipo `RecordOf<K>` en `records.ts`; `OptionalBlock.startDate`/`reviewDate`; métrica `max-pain`; `SEED_SETTINGS` (`src/domain/seed/settings.ts`).
  - Ajustes → tarjeta nueva **«Datos»/«Data»** (`src/features/settings/DataCard.tsx`) entre Apariencia y Desarrollador: recuentos en vivo por tipo de registro (`useLiveQuery`), «Pendientes de sincronizar» y estado de «Almacenamiento». Claves i18n `settings.data.*` (es/en) y `blocks.metrics.maxPain`.
  - Documentación: `docs/spec/data-import-export.md` (parte A definitiva, parte B en borrador), índice `docs/spec/README.md` actualizado, `docs/spec/rules.md` menciona la tercera métrica de dolor, ADR-0003 (`docs/adr/0003-local-storage-dexie.md`).
  - E2E: el blind-tester escribió `tests/e2e/data.spec.ts` (7 tests: AC-DATA-01..05 + caso límite de dos pestañas / sin conexión).
- **Paquetes añadidos en la fase** (instalados por el usuario): runtime `dexie` 4.4.7, `dexie-react-hooks` 4.4.0; dev `fake-indexeddb` 6.2.7.
- **Verificado en `feature/local-db` (2026-11-03)**: `lint` ✅, `typecheck` ✅, `test:coverage` ✅ (**364 tests en 32 archivos**; `src/data` 99,04 % sentencias / 97,56 % ramas / 100 % funciones / 100 % líneas; `src/domain` sigue por encima del 90 %), `build` ✅ (Vite avisa de que el chunk principal pesa 618 kB > 500 kB; informativo), `format:check` ✅.
  - E2E (blind-tester, `npm run e2e`, una sola ejecución, Chromium, 2 workers): **45 pasados, 0 fallidos, 0 omitidos en 34,7 s**.
  - Puertos 5173, 4173, 8888, 8787 y 9323 libres.
- **Implementado — `feature/import-export`** (mergeada en `dev` con el PR #9):
  - Importador de gym_app `src/data/legacy/gymApp.ts` (`readGymAppExport(text)`): esquemas zod tolerantes de las formas reales de gym_app (`t`: `session`, `set`, `note`, `act`, `bw`, `week`, `tpl`, `excfg`, `rec`, `wall`, `cfg`, `mig`), conversión y validación final con `parseRecord`; acepta `{ app: 'winter-arc', records }` o un array suelto; borrados, `cfg_exp_brazos`, `mig_*`, `t` desconocido y plantillas/ejercicios desconocidos → ignorados; mal formados → no válidos. Mapeo completo en la sección 6.
  - `src/data/importFile.ts` (tipo `ImportFile`, `dedupeNewest`: dos registros con el mismo id de Certavi → gana el más reciente).
  - `src/data/importRecords.ts`: `planImport` (vista previa, solo lectura) y `applyImport` (una transacción, LWW con empate a favor de lo local, cola de pendientes, sin `serverSeq`, reloj adelantado con `advanceClock` en `clock.ts`).
  - Copias de Certavi `src/data/backup.ts`: `exportAll` (`certavi-backup-<hoy>.json`), `exportSession` (`certavi-session-<fecha>-<id>.json`), `exportWeek` (`certavi-week-<lunes>.json`), `readBackup`; formato en 2.4. **Exportar sesión y semana aún no tienen UI** (Fases 5 y 7).
  - CSV `src/data/csv.ts`: `toCsv`, `exportSetsCsv` (`certavi-sets-<hoy>.csv`), `exportActivityWeightCsv` (`certavi-activity-weight-<hoy>.csv`); formato Excel en español siempre (2.4); columna de efectiva con `isEffectiveSet`. Tipo `ExportFile` en `src/data/exportFile.ts`.
  - UI `src/features/settings/ImportExport.tsx` dentro de la tarjeta «Datos»: encabezados de nivel 3 «Importar» / «Exportar»; botones «Importar desde la app anterior», «Importar copia de Certavi», «Exportar copia completa (.json)», «Exportar series (.csv)», «Exportar actividad y peso (.csv)»; vista previa en un `alertdialog` «Resumen de la importación» (filas por tipo + sin cambios / ignorados / no válidos, foco en «Cancelar»; «No hay nada nuevo que importar.» + «Cerrar»); toasts de éxito («Registros importados: N») y de error. Ayudas `download.ts` (`downloadFile`), `recordTypes.ts` (`LISTED_TYPES`, `COUNTED_TYPES`) y `src/i18n/text.ts` (`resolveText` para `TextRef`).
  - i18n (es/en): `settings.data.*` (importar/exportar, vista previa, errores, cabeceras CSV), `settings.data.types.settings`, `sets.kinds.*`, `activities.kinds.*`, `routines.free`.
  - Fixtures sintéticos: `tests/fixtures/gym-app-sample.json` (todos los tipos de gym_app; 29 registros escritos, 5 ignorados) y `tests/fixtures/not-a-backup.txt`.
  - Documentación: `docs/spec/data-import-export.md` parte B definitiva (AC-IMPORT-01..06, AC-EXPORT-01..02); `docs/spec/README.md` la marca ✅; `docs/migration.md` corregido con los valores reales de `t`, las formas y el mapeo completo; sección 6 de este documento corregida.
  - E2E: el blind-tester escribió `tests/e2e/import-export.spec.ts` (8 tests).
- **Verificado en `feature/import-export` (2026-11-03)**: `lint` ✅, `typecheck` ✅, `npm run test` ✅ (**417 tests en 39 archivos**, dos ejecuciones sin fallos intermitentes tras corregir un test de exportación que dependía del orden), `test:coverage` ✅ (`src/data` 99,59 % sentencias / 92,68 % ramas / 100 % funciones / 100 % líneas; `src/data/legacy` 100 / 95,34 / 100 / 100; `src/domain` sin cambios, ramas ≥ 96 %), `build` ✅ (chunk principal 638 kB, aviso informativo de Vite > 500 kB), `format:check` ✅.
  - E2E (blind-tester, `npm run e2e`, Chromium, 2 workers): 1.ª ejecución 19 pasados / 3 fallidos y parada por `maxFailures` — problema del test (buscaba el rol `dialog`; la vista previa es `alertdialog`), corregido solo en el test; 2.ª ejecución **53 pasados, 0 fallidos, 0 omitidos en 49,9 s** (45 anteriores + 8 nuevos).
  - Puertos libres y ningún navegador de Playwright abierto.
  - Sin cubrir por e2e (sí por tests unitarios): la fila «No válidos», el mensaje de fallo al guardar y cancelar el selector de archivos del sistema.
- **Criterios de aceptación**:
  - «El importador transforma un JSON sintético con todos los tipos de registro de gym_app (borrados, `abdomen`, `libre`, overrides, `rec`, `wall`) y los números cuadran»: ✅ (tests unitarios con el fixture: 29 escritos, 5 ignorados; e2e importando desde Ajustes).
  - «Recargar la app no pierde nada»: ✅ (test unitario que reabre la base de datos + e2e de recarga / página nueva, también tras importar y sin conexión).
  - Cumplido también: registro + entrada de cola atómicos (test que fuerza el fallo de la escritura en la cola); el borrado lógico oculta el registro y encola el tombstone.
- **Release (hecha por el usuario)**: commits de `feature/import-export`, PR #9 a `dev`, PR `dev → main`, commit `chore(release): v0.4.0` en `dev` y tag `v0.4.0`. Nota: commitlint no tiene el ámbito `e2e`; los commits de tests e2e usan `test:` sin ámbito.

**Entregables**:

- Dexie con esquema y versiones de migración.
- Repositorios por entidad (toda escritura marca `updatedAt` y añade a la cola de pendientes **en la misma transacción**).
- Borrados lógicos.
- **Importador de gym_app** (sección 6) con vista previa y resumen.
- Exportación JSON completa, de sesión y de semana, y CSV para Excel en español.
- Importación de JSON propio.

**Criterios de aceptación**:

- El importador transforma un JSON sintético con todos los tipos de registro de gym_app (incluidos borrados, `abdomen`, `libre`, overrides, `rec` y `wall`) y los números cuadran.
- Recargar la app no pierde nada.

**Prompt**:

```text
Lee context.md (secciones 3, 4 y 6) y CLAUDE.md. FASE 3: capa de datos local con Dexie (src/data):
esquema y migraciones, repositorios por entidad, escritura + cola de pendientes en la misma transacción,
borrados lógicos. Importador de gym_app según la tabla de la sección 6, con validación zod, vista previa
y resumen (componente simple en Ajustes). Exportaciones JSON (completa, sesión, semana) y CSV (series;
actividad y peso) con formato de Excel en español. Tests con fake-indexeddb y un JSON sintético que
cubra todos los tipos de registro. No uses nunca datos reales. Al terminar, /close-phase.
```

---

### <a id="fase4"></a> Fase 4 · Sincronización y backend → `v0.5.0` ✅

**Ramas**: `feature/sync-server` y `feature/sync-client` (en lugar de `feature/sync`, 2.5), más el arreglo `fix/e2e-webkit-sync`

**Estado (2026-11-04)**: **cerrada**. Rama 1 (`feature/sync-server`) mergeada con el **PR #11**; rama 2 (`feature/sync-client`) mergeada con el **PR #12**; commit `chore(release): v0.5.0` en `dev` (95a2833). El primer PR `dev → main` falló en CI (e2e en WebKit); el arreglo `fix/e2e-webkit-sync` se mergeó en `dev` con el **PR #14** (merge 109c3df). Después el usuario hizo el PR `dev → main` (**CI en verde**), el tag **`v0.5.0`** y el **despliegue en Netlify**. Decisiones en la sección 2.5.

- **Implementado — `feature/sync-server`** (mergeada en `dev` con el PR #11; commits: `build(deps)` Netlify Blobs/Functions, `feat(domain)` esquemas del contrato sync v1 y regla de fusión, `feat(api)` servidor sync v1 y función de Netlify, `test(api)` test de contrato, `build` config de Netlify y `robots.txt`, `docs` guía de despliegue):
  - Dominio: `src/domain/sync/contract.ts` (esquemas zod y constantes del contrato, `ERROR_STATUS`) y `src/domain/sync/merge.ts` (`mergeRecords`, `changesSince`, `SyncDocument` con un `Map`, a salvo de `"__proto__"`).
  - `server/sync/`: `handler.ts` (`createSyncHandler`: `Request` → `Response`; autenticación SHA-256 + `timingSafeEqual` con retardo de 400 ms; `500 server-misconfigured` si `CLAVE_SYNC` < 32; 404/405 con `Allow`; 413 por encima de 8 MiB; leer–fusionar–escribir con etag y 5 intentos → 409; copia diaria en hora de Madrid, se guardan 14; un fallo de la copia solo se registra), `store.ts` (interfaz `SyncStore`, `storeNameFor`), `memoryStore.ts`, `netlifyStore.ts`, `auth.ts`, `backups.ts`, `testing.ts`; tests, incluido `contract.test.ts` (comprueba los ejemplos, la tabla de errores y las constantes de `docs/api/sync-v1.md` contra los esquemas y el manejador).
  - `netlify/functions/sync.ts` (adaptador fino: `getStore({ name, consistency: 'strong' })`, `config.path` con las 3 rutas).
  - `netlify.toml` (build, redirección SPA, cabeceras de seguridad/CSP y de caché), `public/robots.txt`, `tsconfig.server.json` (referenciado desde `tsconfig.json`), globales de Node en ESLint para `server/` y `netlify/`, proyecto de Vitest `server` (Node) y umbral de cobertura del 90 % en `server/**`.
  - Documentación: `docs/api/sync-v1.md` con estado «Implemented», código `500 internal-error` nuevo y el ejemplo de archivo de copia corregido a JSON válido; `docs/deploy-netlify.md` (producción `main`, despliegues de rama solo `dev`, sin deploy previews, `CLAVE_SYNC` ≥ 32 como secreto con ámbito Functions, nombre de proyecto difícil de adivinar, comprobaciones con `curl.exe`).
- **Implementado — `feature/sync-client`** (mergeada en `dev` con el PR #12; después `docs: record phase 4 close` y `chore(release): v0.5.0`):
  - `src/data/sync/`: `transport.ts` (`SyncTransport`; `SyncError` con `kind` `fatal`/`retryable`/`bug`; `SyncErrorCode` = códigos del contrato + `network`/`timeout`/`bad-response`/`http`/`client-error`), `httpTransport.ts` (`createHttpTransport`: `fetch` a `/api/v1/*`, `Bearer`, respuestas validadas con zod, timeout de 15 s, `keepalive` con 30 s), `queue.ts` (`nextBatch`, `keepaliveBatch` ≤ 55 KB, `queueEverything`, `readSince`/`advanceSince`, clave meta `since`), `commit.ts` (`commitResponse`: una transacción; desencola solo si `updatedAt` no cambió; aplica solo los registros entrantes estrictamente más nuevos, sin `serverSeq`; quita las entradas pendientes a las que ganan; adelanta el reloj; `since` = máximo; el eco no escribe en ninguna tabla de registros), `restore.ts` (`restoreBackup`, 2.5), `attemptLog.ts` (últimos 40 intentos), `serverBackup.ts` (copia del servidor como copia completa de Certavi importable, `certavi-server-backup-<fecha>.json`), `engine.ts` (`createSyncEngine`, ADR-0004; además: cambio de clave → `since` 0 y se encolan los registros con `updatedAt > 0`; olvidar la clave; listar, descargar y restaurar copias), `browserTriggers.ts` (`online`, `offline`, `focus`, `pageshow`, `visibilitychange`, `pagehide`), `syncKey.ts` (clave solo del dispositivo en `localStorage` `certavi.syncKey`), `SyncContext.ts`/`SyncProvider.tsx` (`useSyncEngine`, `useSyncState`), `testing.ts` (servidor falso sobre la regla de fusión del dominio, planificador manual, `createTestEngine`; excluido de la cobertura).
  - Datos: `db.version(2)` con la tabla `syncLog` (`++id`), v1 intacta, test de migración v1 → v2; `SCHEMAS` exportado desde `db.ts`; `deviceStorage.removeDeviceSetting`; `seedRecordsOf(type)` en `src/data/seed.ts`; `fullBackupFile` exportado desde `src/data/backup.ts`.
  - UI: indicador de sync en la cabecera (`src/features/settings/SyncIndicator.tsx`: enlace a `/settings`, nombre accesible «Sincronización: <estado>» + « · N pendientes», anuncia sin conexión / error); tarjeta **«Sincronización»** la primera de Ajustes (`SyncCard.tsx`: estado, última sync, pendientes, motivo del error, formulario de clave con mostrar/ocultar, guardar/cambiar/olvidar con `ConfirmDialog`, «Sincronizar ahora», enlace «Registro y copias del servidor»); subpágina `/settings/sync` (`SyncPage.tsx`: registro de intentos y copias del servidor: listar, descargar, restaurar con `ConfirmDialog`); iconos nuevos (`cloud`, `cloudOff`, `refresh`, `warning`, `download`, `eye`); claves i18n `settings.sync.*` y `sync.*` (estado, indicador, errores) en es y en; título de ruta `settings.sync.title`.
  - Arranque: `main.tsx` crea el motor (`localKeyStore`, `createHttpTransport`), conecta los disparadores del navegador y lo arranca tras `startDatabase`. `Providers` recibe una prop `sync`; `renderWithProviders` admite una opción `sync` (por defecto: motor de test sin clave y sin arrancar).
  - Servidor falso de e2e `tests/mocks/sync-server.ts` (2.5): API `E2E_SYNC_KEY`, `E2E_WRONG_KEY`, `failNext`, `setDelay`, `requestCount`, `records`, `addBackup`.
  - Documentación: `docs/spec/sync.md` (nueva, AC-SYNC-01..14); `docs/spec/README.md` (sync.md ✅, e2e en `tests/e2e/sync.spec.ts`); ADR-0004 `docs/adr/0004-client-sync-engine.md` (nuevo); `docs/api/sync-v1.md` (referencia al cliente; nota de «clave nueva»: la semilla sin tocar puede quedarse fuera); `docs/deploy-netlify.md` (§4 usa Ajustes → Sincronización de la app; restaurar en el día a día).
  - Test existente cambiado a propósito: `DataCard.test.tsx` espera el nuevo orden de tarjetas de Ajustes (Sincronización, Apariencia, Datos, Desarrollo).
- **Paquetes añadidos en la fase** (instalados por el usuario, en la rama 1): runtime `@netlify/blobs` 11.1.7; dev `@netlify/functions` 6.0.3. Ninguno en la rama 2.
- **Verificado en `feature/sync-client` (2026-11-03)**: `lint` ✅, `typecheck` ✅, `test` ✅ (**621 tests en 58 archivos**; 518 en 44 tras la rama 1), `build` ✅ (chunk principal 666 kB, aviso informativo de Vite > 500 kB), `format:check` ✅.
  - `test:coverage` ✅: todos los archivos 99,38 % sentencias / 96,6 % ramas / 99,01 % funciones / 99,51 % líneas; cada glob ≥ 90 %. Nota: una primera ejecución de `test:coverage` informó de 57/58 archivos sin mostrar ningún fallo; las cinco ejecuciones posteriores (3 con cobertura, 2 sin ella) dieron 58/58. Posible archivo intermitente, no reproducido.
  - E2E (blind-tester, `npm run e2e`, Chromium, 2 workers, una sola ejecución): **69 pasados, 0 fallidos, 0 omitidos en 55,4 s** (53 anteriores + 16 nuevos en `tests/e2e/sync.spec.ts`: AC-SYNC-01..14, con axe en claro/oscuro e inglés).
  - Sin cubrir por e2e (sí por tests unitarios): guardar otra vez la misma clave, más de 300 pendientes, el timeout de 15 s y el modo privado. Una recarga totalmente sin conexión no se prueba (no hay service worker hasta la Fase 8).
  - Puertos 5173, 4173, 8888, 8787 y 9323 libres.
- **Criterios de aceptación**:
  - «Pruebas sin conexión e intermitentes: abortar peticiones, recargar con pendientes, dos dispositivos editando lo mismo»: ✅ (e2e AC-SYNC-05/06/07/09 + tests unitarios).
  - «No se pierde ningún dato»: ✅ (desencolado seguro y commit en la misma transacción; tests unitarios + e2e).
  - «El contrato de `docs/api/sync-v1.md` coincide con la implementación»: ✅ (`server/sync/contract.test.ts` + `server/sync/httpTransport.test.ts`, que ejecuta el transporte del cliente contra el manejador real).
- ~~Pendiente (usuario): commits de `feature/sync-client`, PR a `dev`, PR `dev → main`, commit `chore(release): v0.5.0`~~ Hecho (PR #12 y 95a2833 en `dev`). Siguen pendientes el tag `v0.5.0` y el despliegue (ver abajo).
- **Incidente en CI (2026-11-04)**: el PR `dev → main` de la Fase 4 falló en el job `e2e` (`npm run e2e:all`) tras **14 min 14 s**; el job de checks pasó en 2 min 28 s. Fallaron en **WebKit** AC-SYNC-06 (`tests/e2e/sync.spec.ts:513`, 22,3 s y reintento #1 21,0 s) y AC-SYNC-09 (`:607`, 30,7 s). WebKit no se había ejecutado nunca en la Fase 4 (al cerrar, solo `npm run e2e`, Chromium, 69/69). El usuario lo reprodujo en local (WebKit, 1 worker, sin reintentos, con trazas): 06 esperaba «Error» en L526 y vio «Sincronizando…» y luego «Sincronizado»; 09 seguía con «Cargando…» en la tarjeta Datos en L629 tras 5 s. Causas (de las trazas):
  1. **Bug de la app**: `setKey()` (`src/data/sync/engine.ts`) ponía `status: 'idle'` («Sincronizado») antes de cualquier petición, y el motor arrancaba en `idle` con clave, en contra de `docs/spec/sync.md` §2.1. Invisible en Chromium (primera petición en ms); visible en WebKit, donde los pasos con IndexedDB tardan segundos (vista previa de importación 2–3 s, confirmar 2,7 s, primera lectura de Datos > 7 s). En AC-SYNC-06 la clave se guardó a los 11,27 s, `expectSynced` pasó a los 11,63 s y la primera petición salió a los 15,45 s, así que `failNext('abort')` cayó en la primera sync de la clave y no en la de la importación.
  2. **Tests**: se fiaban del «Sincronizado» visible y esperaban tiempo real (debounce de 2 s, backoff de 4 s, `waitForTimeout` de 1,5/6/3/1 s); `expectCounts` mezclaba timeouts de 5 y 10 s.
  3. **Descartado**: `online`/`offline` sí se disparan en WebKit con `setOffline` (AC-SYNC-05/07 pasan); `visibilitychange`/`keepalive` no intervienen; `route.abort` funciona en WebKit; en 09 los `updatedAt` nunca empatan (A = u+1000, B = u+2000; en empate, `>` estricto en `merge.ts`/`commit.ts`, gana el primero guardado).
  4. **Tiempo de CI**: ~1 min de preparación + `npm ci`, 2–3 min de `playwright install --with-deps` sin caché, otro `vite build` y los tests con 10 min de timeout global, 2 workers y 2 reintentos: lo más probable es que saltara el timeout global (06 mostró 2 de 3 intentos y 09 uno).
- **Arreglo `fix/e2e-webkit-sync`** (mergeado en `dev` con el **PR #14**, merge 109c3df; decisiones en 2.5, 2026-11-04):
  - `docs/spec/sync.md`: «Sincronizando…» también mientras el primer intento no ha terminado; «Sincronizado» solo cuando el servidor ha respondido (al guardar una clave y al abrir la app con clave); AC-SYNC-03 añade esa comprobación.
  - `src/data/sync/engine.ts`: estado inicial con clave = `syncing`; `setKey()` pone `syncing` y ejecuta `trigger('key')` en un `finally`; `idle` solo tras un intento correcto.
  - Tests unitarios: 6 nuevos en `src/data/sync/engine.test.ts` («before the first answer»: `syncing` hasta que responde el servidor, error sin pasar por `idle`, sin conexión sin red, arranque en `syncing`, arranque sin conexión, el intento se ejecuta aunque falle volver a encolar); `src/features/settings/SyncCard.test.tsx`: test nuevo «Sincronizando…» hasta la primera respuesta y dos tests que ahora arrancan el motor como `main.tsx` (el botón está desactivado mientras sincroniza).
  - `tests/e2e/sync.spec.ts` (blind-tester): sin ningún `waitForTimeout`; `page.clock.install()` antes de `goto`, `pauseClock` y un helper `paused()` (avanza el reloj a pasos pequeños con un presupuesto máximo, porque Dexie retrasa las notificaciones con `setTimeout(0)` cuando el reloj está en pausa); `expectSynced(page, server, after)` espera primero al servidor; `syncCount` cuenta solo `/api/v1/sync`; `expectCounts` usa 15 s en los dos pasos; AC-SYNC-03 comprueba «Sincronizando…» con `setDelay(2000)`; AC-SYNC-04 con `runFor(60 s)` (sin reintento ni intervalo de 45 s con clave errónea); AC-SYNC-06 rehecho con el reloj en pausa durante las comprobaciones de «Error»; AC-SYNC-09 espera al servidor para B y para A; `test.slow()` solo en WebKit (quitarlo si la ejecución en WebKit demuestra que sobra).
  - `.github/workflows/ci.yml` (job `e2e`): caché de navegadores por versión, `install-deps` si acierta, sube `playwright-report/` y `test-results/` si falla, `timeout-minutes` 20 → 12 (2.5).
  - `.claude/agents/blind-tester.md` (sección nueva «Time and waits» + `e2e:all` en la última rama de `/close-phase`), `.claude/rules.md` (misma regla + excepción de `e2e:all`), `.claude/commands/close-phase.md` (`e2e:all` una vez en la última rama antes del PR `dev → main`), `CLAUDE.md` §9 (actualizado por el agente principal).
  - **Verificado (2026-11-04)**: `lint` ✅, `typecheck` ✅, `format:check` ✅, `test:coverage` ✅ (**628 tests en 58 archivos**; todos los archivos 99,52 / 96,6 / 99,5 / 99,67 %; `src/data` 99,61 / 92,96 / 100 / 100 %). E2E `npm run e2e` (blind-tester, **solo Chromium**, 2 workers, una ejecución): **69/69 en 1,9 min** (lo más lento, los tests de tema con axe, ~13 s cada uno; los de sync 3–7 s; AC-SYNC-06 3,1 s). Puertos libres. `npm run build` no consta en el resumen (la rama no toca build, PWA ni funciones; `npm run e2e` hace su propio `vite build`).
  - **Verificado en WebKit (2026-11-04, ejecución del usuario)**: `npm run e2e:all` (Chromium + WebKit) → **133 pasados, 5 omitidos, 0 fallidos** (138 = 69 tests × 2 navegadores). **AC-SYNC-06 y AC-SYNC-09 pasan ya en WebKit en local.** Los 5 omitidos son de WebKit, a propósito y ya documentados: AC-NAV-09 (Tab al enlace «saltar al contenido», `tests/e2e/navigation.spec.ts:210`, WebKit no llega con Tab a los enlaces por defecto; excepción desde la Fase 1), AC-THEME-08 axe claro + oscuro (2, `tests/e2e/theme.spec.ts:154`) y AC-SYNC-14 axe claro + oscuro (2, `tests/e2e/sync.spec.ts:1060`): axe solo en Chromium. No consta la duración de la ejecución ni la de AC-SYNC-09 en WebKit, así que sigue abierto si `test.slow()` sobra.
  - **CI (2026-11-04)**: el nuevo PR `dev → main` pasó en verde, incluido el job e2e. **No se ha medido** su duración (objetivo < 5 min, pregunta abierta en la sección 12).
- ~~**Pendiente (usuario)**: commits de `fix/e2e-webkit-sync`, PR a `dev`, nuevo PR `dev → main`, tag `v0.5.0`, despliegue en Netlify con `docs/deploy-netlify.md`~~ **Hecho (2026-11-04)**: PR #14, PR `dev → main` con CI en verde, tag `v0.5.0` y despliegue en Netlify. No consta la comprobación en el iPhone de «Sincronizando…» → «Sincronizado» al guardar la clave.

**Entregables**:

- `netlify/functions/sync.ts`: contrato v1, clave `CLAVE_SYNC`, etag, reintentos, copias diarias (14) y acciones de copias.
- `SyncEngine` en el cliente:
  - cola y reintentos con backoff;
  - `keepalive` al ocultar la app;
  - sincronización al volver, al recuperar la red y cada 45 s si hay pendientes;
  - el eco no repinta;
  - registro de intentos.
- `SyncTransport` intercambiable.
- Servidor falso para tests.
- Indicador de estado en la cabecera.
- Pantalla de clave en Ajustes.
- Copias del servidor: listar, descargar y restaurar.

**Despliegue** (a mano, al cerrar):

1. Netlify → Add new project → importar `certavi`.
2. **Production branch: `main`**.
3. **Branch deploys: solo `dev`**.
4. **Deploy previews: desactivados** (cada despliegue gasta créditos del plan gratuito; las `feature` se prueban en local).
5. Variable `CLAVE_SYNC` nueva (≥ 32 caracteres) y nombre de proyecto difícil de adivinar.

**Criterios de aceptación**:

- Pruebas sin conexión e intermitentes: abortar peticiones, recargar con pendientes, dos dispositivos editando lo mismo.
- No se pierde ningún dato.
- El contrato de `docs/api/sync-v1.md` coincide con la implementación (test de contrato).

**Prompt**:

```text
Lee context.md (3.4, 3.5) y docs/api/sync-v1.md. FASE 4: sincronización. Función de Netlify en TypeScript
que cumpla el contrato v1 (misma lógica que gym_app: LWW por updatedAt, serverSeq, etag condicional con
reintentos, copia diaria hora de Madrid con 14 copias, acciones listar/descargar copia, clave CLAVE_SYNC
comparada en tiempo constante). En el cliente: SyncEngine y SyncTransport (NetlifyTransport) con todo lo
de 3.4. Servidor falso en tests/mocks para e2e. Indicador de estado y pantalla de sync/copias en Ajustes.
Tests unitarios del motor (fusión, reintentos, cola) y test de contrato. Explícame paso a paso cómo
configurar el proyecto nuevo en Netlify (rama de producción main, despliegues de rama solo dev, sin deploy
previews). Al terminar, /close-phase.
```

---

### <a id="fase5"></a> Fase 5 · Hoy y sesión activa → `v0.6.0` ✅

**Ramas** (3, decidido con el usuario el 2026-11-04, 2.6): `feature/today` → `feature/active-session` (registro de series y núcleo de la sesión, borradores) → `feature/session-tools` (temporizador de descanso, reordenar/añadir/quitar ejercicios con filtro, editar fecha/horas/rutina, aviso de cambios remotos, exportar JSON de la sesión, deshacer). La última rama ejecuta `npm run e2e:all` antes del PR `dev → main`. Entre la rama 1 y la 2 va `chore/ci-e2e-shards` (ver «Pendiente: e2e de CI» abajo).

**Estado (2026-11-06)**: **cerrada** (`v0.6.0`). Las tres ramas y `chore/ci-e2e-shards` implementadas y verificadas (lint, typecheck, format, `test:coverage`, `e2e:all` en Chromium y WebKit); code-reviewer y security-reviewer sin bloqueantes. Detalle en `CHANGELOG.md` 0.6.0 y `docs/history.md`; decisiones en la sección 2.6.

- **Rama 2 — `feature/active-session`**:
  - **Hecho:** spec `docs/spec/session.md` (AC-SESSION-01..23); dominio `rules/rows.ts` (filas por ejercicio, «Anterior», validación del ✓, conversión de gym_app) y tipo `dropset`; datos `sessionLog.ts` (registrar, filas, tipo, straps/banda, notas, terminar, eliminar) y `sessionDrafts.ts`; pantalla de sesión (`SetRow` con deslizar para quitar, `ExerciseCard`) y `SelectField`; `session.*` en es/en; ADR-0003 actualizado; `tests/e2e/session.spec.ts` (8 tests, Chromium en verde).
  - **Pendiente (usuario)**: PR `dev → main`, `chore(release): v0.6.0` y tag. Revisiones de code-reviewer no aplicadas: borradores sin guardar que se pierden al quitar un ejercicio, `saveDetails` en dos transacciones, `ISO_DATE` acepta 2026-02-31, toast oculto tras la barra de descanso, constantes de descanso duplicadas. AC-REST-01: se confirma la redacción (fuera de rango, la app guarda el 15 o el 900 más cercano).
  - **Por comprobar a mano (iPhone):** sonido del temporizador con la pantalla bloqueada, flujo sin conexión y deslizar una fila para ver «Quitar» (con ratón en Chromium no se reveló; el botón por teclado sí funciona).
  - **Sin cubrir en e2e:** sin conexión (AC-21); «Lastre» y «Banda» (ninguna rutina semilla tiene dominadas), cubiertos en tests de componente.

- **Implementado — `feature/today`** (sin commits):
  - Spec: `docs/spec/today.md` (nueva, AC-TODAY-01..19); índice `docs/spec/README.md`; `docs/spec/theme-language-navigation.md` (Hoy ya no es una página vacía); `docs/spec/rules.md` (semana de senderismo: 86 series).
  - Dominio: `rules/dayPlan.ts` (`weekSchedule`, `dayPlan`, `routineDays`), `rules/session.ts` (`newSession`), `rules/today.ts` (recordatorio de descarga `needsDeloadReminder`, número de semana del plan, peso corporal), `rules/blocks.ts` (bloques de un día, parches del `BlockLog`), `weekRoutines` en `rules/weekPlan.ts` (`livePlan`/`weekPlanSummary` reciben `hiking`); tests de todo.
  - Datos: `src/data/today.ts` (`readToday`, `updateWeek`, `saveActivity`, `saveBodyWeight`, `updateBlockLog`), `src/data/sessions.ts` (`startSession`, `readSession`), `src/data/ids.ts` (`newId`); tests.
  - UI: pantalla Hoy en `src/features/today/` (hero «La sesión de hoy»; «Esta semana» con tira de 7 días, series efectivas frente al plan, sesiones, tamaño 5/4/3 e interruptores de senderismo y descarga; «Otra sesión u otro día»; «Actividad»; «Peso medio de la semana»; avisos de sin clave y de descarga); `src/features/blocks/DayBlockCard.tsx` (tarjeta de bloques del día); pantalla mínima de sesión `src/features/session/SessionPage.tsx` en `/session/:sessionId` (solo el plan, «Próximamente»; se sustituye en la rama 2); componentes genéricos nuevos en `src/ui`: `TextField`/`TextArea`, `Checkbox`, `ScalePicker`, `Notice`; `formatDateRange` en `src/i18n/format.ts`; claves i18n `today.*`, `plan.*`, `blocksDay.*`, `session.*` (es/en); se quita `pages.today`; título de ruta `session.title`.
  - Tests: `src/test/setup.ts` (RTL `asyncUtilTimeout` 5 s) y `vite.config.ts` (`testTimeout` 15 s en el proyecto `ui`), 2.6.
  - E2E (blind-tester): `tests/e2e/today.spec.ts` nuevo (8 tests de flujo que cubren AC-TODAY-01..19); `tests/e2e/helpers.ts` y `language.spec.ts` (AC-LANG-01) cambiados porque Hoy ya no muestra «Próximamente».
- **Verificado en `feature/today` (2026-11-04)**: `lint` ✅, `typecheck` ✅, `format:check` ✅, `build` ✅ (chunk principal **702 kB**, antes 666 kB; aviso informativo de Vite).
  - `test:coverage` ✅: **731 tests en 67 archivos**; todos los archivos 99,57 / 96,83 / 99,57 / 99,71 %; `src/data` 99,69 / 94,73 / 100 / 100 %; `src/domain/rules` 100 / 96,78 / 100 / 100 %.
  - E2E: 1.ª `npm run e2e` 81/83 (AC-TODAY-12: bug de la app, la etiqueta del día mostraba la rutina planificada en lugar de la actividad — corregido; AC-TODAY-15: problema del test — corregido). Después el usuario ejecutó `npm run e2e` **83/83 en 2,3 min** y `npm run e2e:all` (166 tests, **7,0 min**): 160 pasados, 5 omitidos (las omisiones documentadas de WebKit), 1 fallido — AC-TODAY-12 en WebKit, bug de la app (orden aleatorio de las actividades con el reloj fijo; corregido con el orden de guardado, 2.6). Ejecución final `npm run e2e` (blind-tester, Chromium, una ejecución): **77 pasados, 0 fallidos en 1,1 min** (`today.spec.ts` reducido de 14 a 8 tests, todos los AC siguen cubiertos). **`e2e:all` no se ha vuelto a ejecutar tras los arreglos.** Puertos libres.
- **Pendiente (usuario)**: commits de `feature/today` y PR a `dev`.
- **Pendiente: e2e de CI** (rama siguiente **`chore/ci-e2e-shards`**, después de mergear `feature/today` en `dev`; el usuario está de acuerdo con el enfoque y creará la rama):
  - Análisis: los runners de GitHub en repos privados tienen 2 vCPU; `playwright.config.ts` usa los workers por defecto en CI = 1 worker. `e2e:all` en local con 2 workers tardó 7,0 min para 166 tests → en CI se estima **≥ 14 min**, por encima de `--global-timeout` 10 min y de `timeout-minutes` 12 del job.
  - Arreglo previsto: etiqueta **`@all-engines`** en los tests que tienen que correr en WebKit (sync, data, import-export, today, smoke, AC-NAV-03 cabe en 390 px); el proyecto `webkit` filtra con `grep: /@all-engines/`; el resto de navegación, tema, idioma y componentes solo en Chromium (lógica de UI independiente del motor). WebKit pasa de ~83 a ~45 tests.
  - Job `e2e` de CI como matriz (chromium, webkit), `fail-fast: false`, un navegador instalado/cacheado por job y su propio artefacto de informe; siguiente palanca si WebKit pasa de ~8 min: `--shard=1/2`, `2/2`.
  - Documentación a actualizar en esa rama: comentarios de `playwright.config.ts`, `CLAUDE.md` §9, `blind-tester.md` (cuándo etiquetar `@all-engines`), `docs/spec/README.md` y la sección 2 de este documento.
- **Sugerencias (no hechas, 2026-11-04)**: añadir los componentes nuevos de `src/ui` (`TextField`/`TextArea`, `Checkbox`, `ScalePicker`, `Notice`) a `/dev/ui`; el code-splitting (702 kB) sigue en la Fase 8.

**Entregables**:

- Todo lo de «Hoy» y «Sesión activa» de la sección 5.1.
- Novedades:
  - **sesión libre**;
  - **añadir y quitar series efectivas** (también las de la rutina);
  - **calentamiento con símbolo** («C»/«W»);
  - **diálogos propios**;
  - **filtro** al añadir ejercicio;
  - tarjeta de **bloques del día**.
- Temporizador de descanso.
- Borradores que sobreviven a repintados.
- Aviso de cambios remotos.

**Revisar al empezar** (sugerencias de la Fase 4, 2026-11-03):

- El **aviso de cambios remotos** puede apoyarse en el motor de sync (`src/data/sync/engine.ts`): `commitResponse` (`src/data/sync/commit.ts`) ya devuelve cuántos registros llegaron del servidor (`applied`), y el eco de lo propio no escribe nada. **Decidido (2026-11-04, 2.6)**: banner «Hay cambios de otro dispositivo», refresca lo guardado, nunca toca los borradores, se cierra a mano; se implementa en `feature/session-tools`.
- **Vigilar `test:coverage`**: en la Fase 4 una ejecución informó de 57/58 archivos sin mostrar ningún fallo y no se reprodujo en cinco ejecuciones más. Si vuelve a pasar, guardar la salida completa (`npm run test:coverage > cov.txt 2>&1`), buscar el archivo que no termina (posibles candidatos: los tests con temporizadores o `liveQuery` de `src/data/sync/` y `src/features/settings/Sync*.test.tsx`) y arreglar la causa, no reintentar. **Relacionado (2026-11-04, `feature/today`)**: con `test:coverage` fallaban al azar tests de SyncCard, ImportExport y TodayPage porque una escritura → consulta en vivo → repintado pasaba de 1 s; se subieron los timeouts (RTL 5 s, `ui` 15 s, 2.6). No consta que el caso 57/58 haya vuelto a aparecer.
- **Medir IndexedDB en el iPhone** (sugerencia del 2026-11-04, no hecha; ya es posible porque la app está desplegada): en WebKit de escritorio los pasos con IndexedDB tardaron segundos (vista previa de importación 2–3 s, primera lectura de Datos > 7 s). Antes de optimizar, medir en Safari del iPhone real (duraciones del registro de intentos, vista previa de importación). Si es lento, contar con índices/`getAll` en lugar de cursores con `filter()` (`countLiveRecords`, `queueEverything`). La sesión activa de esta fase depende de que las escrituras sean rápidas.

**Criterios de aceptación**:

- Flujo completo en el iPhone sin conexión: empezar, registrar, recargar, seguir y terminar.
- El blind-tester cubre: 0 kg, ✓ en vacío con referencia, quitar una serie de la rutina, reordenar, sesión libre, calentamiento fuera de estadísticas y modo oscuro.

**Prompt**:

```text
Lee context.md (5.1 y 5.2) y CLAUDE.md. FASE 5: pantalla Hoy y sesión activa. Paridad con gym_app en todo lo
listado en 5.1 para Hoy y Sesión, más las novedades 5.2 números 7, 8, 9 (tarjeta del día), 10 y el filtro
del punto 4 en el selector de añadir ejercicio. Escribe primero la especificación en docs/spec/today.md y
docs/spec/session.md con criterios de aceptación claros; después implementa. Divide en ramas si es grande y
dime cuáles crear. Tests de componentes y de lógica; luego lanza al blind-tester. Al terminar, /close-phase.
```

### <a id="fase6"></a> Fase 6 · Catálogo, ejercicios propios y rutinas → `v0.7.0` ✅

**Ramas** (2, decidido en la planificación): `feature/exercise-catalog` (PR #24, mergeada en `dev`) → `feature/routine-editor` (cierre con `/close-phase final`).

**Estado (2026-11-06)**: **cerrada** (`v0.7.0`, sin publicar). Verificadas: lint, typecheck, `test:coverage`, build, e2e de la rama 2 (`tests/e2e/routines.spec.ts`) y `npm run e2e:all` una vez en Chromium y WebKit. code-reviewer y security-reviewer sin bloqueantes. Sin paquetes nuevos. Decisiones en la sección 2.8 de `context.md`; detalle en `CHANGELOG.md` 0.7.0.

- **Rama 1 — `feature/exercise-catalog`**:
  - **Hecho:** spec `docs/spec/exercises.md`; catálogo en `/exercises` dentro de Rutinas (selector «Rutinas | Ejercicios», la pestaña Rutinas sigue activa en `/exercises*`); filtros combinables (texto, grupo, equipo, tipo, straps, propios, en rutina) con `ExerciseFilters` + `useExerciseFilter`, compartidos con «Añadir ejercicio»; «Mostrar archivados»; ficha `/exercises/:id` (datos, 1RM, peso máximo, mejor volumen, marcas por repeticiones, historial con enlace a la sesión, incremento propio; las semanas de descarga no dan récords); crear, editar y archivar/desarchivar ejercicios propios (`exe_`); «Crear ejercicio» desde la hoja de la sesión; `tests/e2e/exercises.spec.ts`.
  - **Revisión:** los tests e2e del catálogo usan `expect.poll` para la estabilidad en WebKit.
- **Rama 2 — `feature/routine-editor`**:
  - **Hecho:** spec `docs/spec/routines.md` (AC-ROUTINES-01..21); lista `/routines` (seis rutinas en orden de día, «n ejercicios · m series», etiqueta «Editada»); vista `/routines/:id` de solo lectura (nunca crea sesión; «Restaurar original» solo si está editada); editor `/routines/:id/edit` (añadir con la hoja compartida, quitar con «Deshacer», subir/bajar, series por ejercicio con tope de 20, tipo, repeticiones, RIR, nota, opcional, aviso al salir con cambios: `useBlocker` + `beforeunload` + diálogo); dominio `src/domain/rules/routineEdit.ts`; datos `src/data/routines.ts` (`saveRoutine`, `restoreSeedRoutine`); `src/features/routines/*`; `tests/e2e/routines.spec.ts`.
  - **Técnico:** el catálogo de claves i18n tipadas está cerca del límite de profundidad de instanciación de TypeScript (`ExerciseCard.hintText` tipa `t` como `TFunction`); los nombres de los días salen de `Intl`, no de claves i18n; `pages.routines.*` eliminadas.
  - **Aplazado:** la gráfica de evolución de la ficha pasa a la Fase 7; crear y borrar rutinas, al backlog v2.

---

## <a id="seccion12"></a> 12. Registro de progreso

> Lo mantiene el agente **context-keeper**. Una línea por cambio relevante, la más reciente arriba.

| Fecha      | Fase | Qué                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Versión                     |
| ---------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 2026-11-06 | 6    | **Cierre de la Fase 6** (2 ramas): catálogo de ejercicios dentro de Rutinas con filtros combinables, ficha de ejercicio, ejercicios propios (crear, editar, archivar), lista, vista y editor de rutinas con series, restaurar original (`feature/exercise-catalog` mergeada en `dev` como PR #24; `feature/routine-editor`). lint, typecheck, `test:coverage`, build y `e2e:all` (Chromium + WebKit) ✅; code-reviewer y security-reviewer sin bloqueantes. Gráfica de evolución aplazada a la Fase 7. Pendiente: PR `dev → main`, `chore(release): v0.7.0` y tag por el usuario                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `v0.7.0` (sin publicar)     |
| 2026-11-06 | 5    | **Cierre de la Fase 5** (rama final `feature/session-tools`): sesión activa (`feature/active-session`), detalles de la sesión (fecha, horas, rutina), añadir/mover/quitar ejercicios con deshacer, temporizador de descanso con sonido y vibración, tarjeta «Descanso» en Ajustes, aviso de cambios remotos (ADR-0004 decisión 10), JSON de una sesión, `downloadFile` movido a `src/ui`. `lint`, `typecheck`, `format:check`, `test:coverage` (umbrales cumplidos) y `npm run e2e:all` (Chromium + WebKit) ✅; `code-reviewer` y `security-reviewer` sin hallazgos bloqueantes. Pendiente: PR `dev → main`, `chore(release): v0.6.0` y tag por el usuario; comprobaciones manuales en iPhone                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `v0.6.0` (sin publicar)     |
| 2026-11-04 | 5    | **`feature/today` implementada y verificada** (rama 1 de 3 de la Fase 5, **sin commits**): spec `docs/spec/today.md` (AC-TODAY-01..19); plan del día (`dayPlan.ts`), semana de senderismo como en gym_app (`weekRoutines`; normal + senderismo = 86 series en 4 sesiones), `newSession`, recordatorio de descarga (6 semanas), bloques del día; `src/data/today.ts`, `sessions.ts`, `ids.ts`; pantalla Hoy, tarjeta de bloques del día, pantalla mínima de sesión `/session/:sessionId`; `TextField`/`TextArea`, `Checkbox`, `ScalePicker`, `Notice` en `src/ui`; timeouts de tests (RTL 5 s, `ui` 15 s). lint, typecheck, format:check, build (chunk de 702 kB, aviso informativo) y `test:coverage` ✅ (**731 en 67 archivos**; 99,57 / 96,83 / 99,57 / 99,71 %). E2E: 1.ª `npm run e2e` 81/83 (AC-TODAY-12 bug de la app y AC-TODAY-15 del test, corregidos); usuario: `npm run e2e` 83/83 en 2,3 min y `npm run e2e:all` 160 pasados / 5 omitidos / 1 fallido en 7,0 min (AC-TODAY-12 en WebKit, bug de orden de actividades, corregido); final `npm run e2e` (Chromium) **77/77 en 1,1 min** (`today.spec.ts` de 14 a 8 tests). `e2e:all` sin repetir tras los arreglos. Puertos libres. Ramas de la fase: 3 (2.6). Pendiente: commits y PR a `dev` por el usuario; después `chore/ci-e2e-shards` (el e2e de CI no cabe: ≥ 14 min estimados con 1 worker) | `v0.6.0` (en curso)         |
| 2026-11-04 | 4    | **Release de la Fase 4** por el usuario: `fix/e2e-webkit-sync` mergeada en `dev` (**PR #14**, merge 109c3df), PR `dev → main` con **CI en verde**, tag **`v0.5.0`** y **despliegue en Netlify**. Duración del job e2e de CI sin medir                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `v0.5.0`                    |
| 2026-11-04 | 4    | **Arreglo `fix/e2e-webkit-sync`** (sale de `dev`, **sin commits**): estado «Sincronizado» solo tras un intento correcto (`engine.ts`: arranque con clave y `setKey()` en `syncing`, `trigger('key')` en `finally`; `docs/spec/sync.md` §2.1 y AC-SYNC-03), 6 tests nuevos del motor y 1 de `SyncCard`, `tests/e2e/sync.spec.ts` sin `waitForTimeout` (`page.clock`, esperar al servidor falso antes de `failNext`, timeouts de 15 s), caché de navegadores de Playwright en CI con informe y trazas si falla (`timeout-minutes` 12), reglas de esperas en e2e y `e2e:all` en la última rama de `/close-phase`. lint, typecheck, format:check y `test:coverage` ✅ (**628 en 58 archivos**; 99,52 / 96,6 / 99,5 / 99,67 %; `src/data` 99,61 / 92,96 / 100 / 100 %). E2E `npm run e2e` (**solo Chromium**, una ejecución): **69/69 en 1,9 min**. Puertos libres. Después, `npm run e2e:all` del usuario (Chromium + WebKit): **133 pasados, 5 omitidos, 0 fallidos** (69 × 2; los 5 omitidos, de WebKit y a propósito: AC-NAV-09 y axe de AC-THEME-08 y AC-SYNC-14 en claro/oscuro); **AC-SYNC-06 y AC-SYNC-09 pasan en WebKit en local**. CI e2e sin ejecutar. Decisiones en 2.5                                                                                                                                                                                | `v0.5.0` (sin tag)          |
| 2026-11-04 | 4    | **Incidente en CI**: el PR `dev → main` de la Fase 4 (release `chore(release): v0.5.0`, 95a2833 en `dev`, sin tag) falló en el job `e2e` (`npm run e2e:all`, 14 min 14 s): AC-SYNC-06 y AC-SYNC-09 en **WebKit**, que no se había ejecutado nunca en la fase. Reproducido en local por el usuario. Causa: «Sincronizado» antes de la primera respuesta del servidor (bug de la app, contra la spec), visible solo con el IndexedDB lento de WebKit, más tests con esperas de tiempo real; probablemente saltó el timeout global de 10 min. Detalle en la Fase 4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `v0.5.0` (sin tag)          |
| 2026-11-03 | 4    | `feature/sync-client` mergeada en `dev` (**PR #12**), `docs: record phase 4 close` y `chore(release): v0.5.0` (95a2833) en `dev` por el usuario; sin tag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `v0.5.0` (sin tag)          |
| 2026-11-03 | 4    | **`feature/sync-client` implementada y verificada** (rama 2 de 2, **sin commits**): motor de sync del cliente en `src/data/sync/` (ADR-0004: lotes de 300, 413 parte el lote, backoff 4/8/15/30/60 s, 2 s tras crecer la cola, 45 s con pendientes, `keepalive` al salir, commit en una transacción con desencolado seguro, el eco no repinta), `createHttpTransport` genérico para sync-v1, clave solo del dispositivo, registro de intentos (Dexie v2 con `syncLog`), restaurar y descargar copias del servidor, indicador en la cabecera, tarjeta «Sincronización» (la primera en Ajustes) y subpágina `/settings/sync`, servidor falso de e2e con `context.route` (sin puerto), spec `docs/spec/sync.md` (AC-SYNC-01..14). lint, typecheck, test (**621 en 58 archivos**), `test:coverage` (99,38 / 96,6 / 99,01 / 99,51 %; cada glob ≥ 90 %; una ejecución temprana con 57/58 archivos sin fallo visible, no reproducida en 5 ejecuciones más), build (aviso informativo: chunk de 666 kB) y format:check ✅. E2E `npm run e2e` (Chromium, 2 workers, una ejecución): **69/69 en 55,4 s** (16 nuevos en `sync.spec.ts`). Puertos libres. Criterios de aceptación de la Fase 4 ✅. Decisiones en 2.5. Pendiente: commits, PR a `dev`, PR `dev → main`, `chore(release): v0.5.0`, tag y despliegue en Netlify por el usuario                                | `v0.5.0` (pendiente de tag) |
| 2026-11-03 | 4    | `feature/sync-server` mergeada en `dev` por el usuario (**PR #11**): contrato sync v1 en el dominio (`contract.ts`, `merge.ts`), servidor `server/sync/` (manejador `Request → Response`, almacén en memoria / Netlify Blobs, etag con 5 intentos, copias diarias 14, código `500 internal-error`), `netlify/functions/sync.ts`, `netlify.toml`, `robots.txt`, `tsconfig.server.json`, proyecto de Vitest `server` con umbral del 90 %, test de contrato, `docs/deploy-netlify.md`. Verificado antes del merge: 518 tests en 44 archivos. Paquetes: `@netlify/blobs` 11.1.7, `@netlify/functions` 6.0.3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `v0.5.0` (en curso)         |
| 2026-11-03 | 3    | Release de la Fase 3 por el usuario: `feature/import-export` mergeada en `dev` (PR #9), PR `dev → main`, `chore(release): v0.4.0` en `dev` y tag `v0.4.0`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `v0.4.0`                    |
| 2026-11-03 | 3    | **`feature/import-export` implementada y verificada** (rama 2 de 2, **sin commits**): importador de gym_app (`src/data/legacy/gymApp.ts`) con el mapeo corregido (sección 6, `docs/migration.md`), `planImport`/`applyImport` (una transacción, LWW con empate a favor de lo local, cola de pendientes), copias de Certavi (`backup.ts`: completa, sesión y semana; sin tombstones ni `serverSeq`), CSV de series y de actividad y peso en formato Excel en español (`csv.ts`), UI de importar/exportar en la tarjeta «Datos», fixtures sintéticos en `tests/fixtures/`, spec parte B (AC-IMPORT-01..06, AC-EXPORT-01..02). lint, typecheck, test (**417 en 39 archivos**, dos ejecuciones), `test:coverage` (`src/data` 99,59 % / 92,68 % / 100 % / 100 %; `src/data/legacy` 100 / 95,34 / 100 / 100), build (aviso informativo: chunk de 638 kB) y format:check ✅. E2E `npm run e2e` (Chromium): 1.ª ejecución 19/3 parada por `maxFailures` (fallo del test: rol `dialog` en vez de `alertdialog`, corregido solo en el test); 2.ª **53/53 en 49,9 s** (8 nuevos en `import-export.spec.ts`). Puertos libres. Criterios de aceptación de la Fase 3 ✅. Decisiones en 2.4. Pendiente: commits, PR a `dev`, PR `dev → main`, `chore(release): v0.4.0` y tag por el usuario                                                                                   | `v0.4.0` (pendiente de tag) |
| 2026-11-03 | 3    | `feature/local-db` mergeada en `dev` por el usuario (PR #8, 7 commits)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `v0.4.0` (en curso)         |
| 2026-11-03 | 3    | **`feature/local-db` implementada y verificada** (rama 1 de 2 de la Fase 3, **sin commits**): Dexie con una tabla por tipo + `pending` + `meta` (ADR-0003), repositorios con validación zod, reloj monótono y cola en la misma transacción, borrados lógicos, `ensureSeed` al arrancar, `navigator.storage.persist()`, tarjeta «Datos» en Ajustes, métrica `max-pain`, `startDate`/`reviewDate` en bloques, `SEED_SETTINGS`, spec `docs/spec/data-import-export.md` (parte A). lint, typecheck, `test:coverage` (**364 en 32 archivos**; `src/data` 99,04 % / 97,56 % / 100 % / 100 %, umbral 90 % ahora también en `src/data`), build (aviso informativo: chunk de 618 kB) y format:check ✅. E2E `npm run e2e` (Chromium, 2 workers): **45/45 en 34,7 s** (7 nuevos en `data.spec.ts`). Puertos libres. Decisiones en 2.4. Paquetes: `dexie` 4.4.7, `dexie-react-hooks` 4.4.0, `fake-indexeddb` 6.2.7. Rama 2 renombrada a `feature/import-export`, sin empezar                                                                                                                                                                                                                                                                                                                                                                                              | `v0.4.0` (en curso)         |
| 2026-11-03 | 2    | Release de la Fase 2 por el usuario: PR #6 (`feature/domain-model`) a `dev`, PR #7 `dev → main` y tag `v0.3.0`. Sin commit `chore(release)`: `package.json` quedó en 0.2.0; la entrada `[0.3.0]` del `CHANGELOG.md` se añadió en `feature/local-db`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `v0.3.0`                    |
| 2026-11-03 | 2    | **Fase 2 implementada y verificada** en `feature/domain-model`: modelo de dominio (zod), reglas, catálogo semilla (45 ejercicios), 6 rutinas y bloques semilla, claves i18n de la semilla, `docs/spec/rules.md`, proyectos de Vitest node/jsdom y `test:coverage` en CI. lint, typecheck, test (**326 en 27 archivos**), build y format:check ✅; cobertura de `src/domain` 100 % sentencias / 96,86 % ramas / 100 % funciones / 100 % líneas (umbral 90 % comprobado). Criterios de aceptación ✅ (semana normal 104 y por grupo; también 81 / 63 / descarga 62). Regresión e2e `npm run e2e` (Chromium, 2 workers): **38/38 en 46,1 s**. Puertos libres. Decisiones en 2.3; regla del gemelo y revisión del ciclo aplazadas a la Fase 7. Paquetes: `zod` 4.6.7, `@vitest/coverage-v8` 5.1.0. Pendiente: commits, PR a `dev`, PR `dev → main` y tag por el usuario                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `v0.3.0` (pendiente de tag) |
| 2026-11-03 | 1    | Release de la Fase 1 por el usuario: commits de `feature/app-shell`, PR #4 a `dev`, PR `dev → main`, `chore(release): v0.2.0` y tag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `v0.2.0`                    |
| 2026-11-02 | 1    | **Fase 1 implementada y verificada** en `feature/app-shell`: lint, typecheck, test (179 en 16 archivos), build y format:check ✅; puertos libres. Suite e2e reducida por decisión del usuario de 111 a 38 tests por navegador (2.2); ejecución válida `npm run e2e` (Chromium, 2 workers): **38/38 en 18,2 s**. Antes, la suite de 111 pasó entera en 33 s (ejecución del usuario). Todos los criterios de aceptación cubiertos. Pendiente: commits, PR a `dev`, PR `dev → main` y tag por el usuario                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `v0.2.0` (pendiente de tag) |
| 2026-11-02 | 1    | **Incidente e2e** durante `/close-phase` (20:13–20:32 hora local): el blind-tester lanzó la suite de Playwright 3 veces (+1 sonda) en ~18 min. La 1.ª ejecución usó los 8 workers por defecto de Playwright (50 % de 16 CPU lógicas) con Chromium (`deviceScaleFactor` 3) + WebKit, ~36 escaneos de axe y eslint/tsc a la vez: 7,9 min y 62 fallos, todos timeouts de `page.goto` / `ERR_ABORTED` (falta de recursos). La misma suite con 4 workers tardó 52 s con 1 fallo. Parar el agente no paró la última ejecución (siguió ~1 min). El PC del usuario se volvió muy lento, Chrome dejó de responder y se cayó la conexión (registro de Windows: fallo de handshake del adaptador Wi-Fi USB a las 20:20; causa atribuida a la saturación, no confirmada). No intervinieron: descargas de navegadores, servidor del informe HTML, reintentos automáticos ni el Chrome del usuario. **Decisión**: límites de e2e de la sección 2.2 (2 workers en local, `e2e` solo Chromium, `e2e:all`, job e2e en CI solo en PR a `main`, puerto 9323, reglas nuevas para agentes)                                                                                                                                                                                                                                                                                          | —                           |
| 2026-11-02 | 1    | `feature/app-shell` implementada (i18n es/en, shell con react-router 8, páginas vacías, Ajustes, componentes base de `src/ui`, `/dev/ui`, spec de tema/idioma/navegación). lint, typecheck, test (179) y build ✅; axe sin violaciones. **Sin commits** y **sin ejecución e2e válida** todavía                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `v0.2.0` (en curso)         |
| 2026-11-02 | 1    | `feature/design-system` mergeada en `dev` (PR #3): selector, decisión Hierro + Archivo, tokens y motor de tema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `v0.2.0` (en curso)         |
| 2026-11-02 | 0    | Release de la Fase 0 por el usuario: commits, PR a `dev`, PR `dev → main` y tag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `v0.1.0`                    |
| 2026-11-02 | 0    | Base del proyecto implementada y verificada (lint, typecheck, test, build, format:check, e2e en chromium + webkit, puertos libres; commit denegado a Claude). Decisiones en 2.1. Pendiente: commits, PR y tag por el usuario                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `v0.1.0` (pendiente de tag) |
| 2026-11-01 | —    | Plan inicial y decisiones (este documento)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | —                           |
