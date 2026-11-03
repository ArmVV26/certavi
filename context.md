# Certavi · contexto y plan de desarrollo

> Documento de arranque del proyecto **Certavi**, la reescritura de la app de registro de gimnasio (antes «Winter Arc · registro», repositorio `gym_app`).
> Al crear el repositorio, este archivo se copia como `context.md` en la raíz. Desde ese momento es la **fuente de verdad del estado del proyecto**: qué está decidido, qué está hecho, qué falta y con qué prompt se arranca cada fase. Lo mantiene al día el agente de contexto.
>
> Última actualización: 3 nov 2026 · Estado: **Fase 0 cerrada (`v0.1.0`) · Fase 1 cerrada (`v0.2.0`) · Fase 2 cerrada (`v0.3.0`) · Fase 3 en curso 🚧: rama 1 de 2 (`feature/local-db`) implementada y verificada, sin commits; rama 2 (`feature/import-export`) sin empezar**

---

## Índice

1. [Qué es Certavi y por qué se rehace](#1-qué-es-certavi-y-por-qué-se-rehace)
2. [Decisiones tomadas](#2-decisiones-tomadas)
3. [Arquitectura](#3-arquitectura)
4. [Modelo de dominio](#4-modelo-de-dominio)
5. [Funcionalidades: qué se conserva y qué es nuevo](#5-funcionalidades)
6. [Migración desde la app actual](#6-migración-desde-la-app-actual)
7. [Flujo de trabajo: ramas, commits, versiones y tags](#7-flujo-de-trabajo)
8. [Claude Code: reglas, agentes y comandos](#8-claude-code-reglas-agentes-y-comandos)
9. [Preparación antes de la Fase 0 (manual, en tu PC)](#9-preparación-antes-de-la-fase-0)
10. [Hoja de ruta por fases con sus prompts](#10-hoja-de-ruta-por-fases)
11. [Backlog v2 y más allá](#11-backlog-v2)
12. [Registro de progreso](#12-registro-de-progreso)

---

## 1. Qué es Certavi y por qué se rehace

**Certavi** es una PWA personal para registrar entrenamientos de fuerza: rutinas, sesiones, series (peso, repeticiones, RIR), progreso, peso corporal y bloques de movilidad y rehabilitación. Está pensada para usarse en el iPhone durante el entrenamiento, **también sin cobertura**.

La app actual (`gym_app`, v1.5.1) funciona, pero se ha construido a base de parches:

- JavaScript sin tipos.
- Vistas que montan el HTML a mano.
- Ningún test.
- Commits directos a `main`, algunos con otra cuenta.

Cada cambio cuesta más que el anterior. Certavi se rehace desde cero en un repositorio nuevo, con un modelo de dominio tipado, tests, un flujo de ramas y una documentación que permita a Claude Code trabajar con todo el contexto.

**Objetivos del proyecto**

1. Una app excelente para el uso diario en el gimnasio: rápida, sin conexión y sin perder nunca un dato.
2. Un proyecto presentable en portfolio: arquitectura limpia, tests, CI, documentación y historial de commits ordenado.
3. Un backend sustituible: hoy en Netlify y mañana en Java, Python o Firebase sin tocar el frontend.

**Lo que NO es (por ahora)**: una app nativa de la App Store (sin Mac ni cuenta de pago no es viable), multiusuario ni con red social.

---

## 2. Decisiones tomadas

| Tema | Decisión | Motivo |
|---|---|---|
| Nombre | **Certavi** | — |
| Repositorio | GitHub, **privado** (se hará público al terminar) | Portfolio al final, sin exponer nada antes |
| Lenguaje | **TypeScript** (modo `strict`) | Tipos compartidos entre frontend y backend |
| UI | **React** + **Vite** | — |
| Distribución | **PWA** instalada desde Safari | Sin Mac y sin pagar, la app nativa no es viable |
| Tests | **Vitest** (unitarios y de componentes) + **Playwright** (end-to-end, agente tester) | — |
| Datos locales | **IndexedDB** con **Dexie** | Offline-first: todo se guarda primero en el móvil |
| Sincronización | **Mismo modelo que ahora**: registros con marca de tiempo, gana el más reciente, borrados lógicos, cola de pendientes y reintentos | Probado en el gimnasio |
| Backend v1 | **Netlify Functions (TypeScript) + Netlify Blobs** (opción A) | Simple y gratis |
| Backend futuro | Contrato de API documentado y versionado (`/api/v1/sync`) + capa de transporte intercambiable en el cliente | Poder migrar a Java, Python o Firebase sin tocar la UI |
| Hosting | **Netlify**, proyecto y URL **nuevos**, en paralelo con la app actual hasta igualarla | Cero riesgo para el uso diario |
| Coste | **Todo gratis** | — |
| Idiomas | **Código, commits y documentación en inglés.** App en **español por defecto, con opción de inglés** (i18n) | Estándar de portfolio |
| Tema | **Claro / oscuro / automático** (detecta el ajuste del dispositivo y se actualiza en vivo) | — |
| Estilo | Paleta y fuentes **nuevas**, que se eligen en la Fase 1 sobre pantallas reales | — |
| Ramas | `main` (producción) · `dev` (integración) · `feature/*`, `fix/*`, `chore/*`, `docs/*` | — |
| Commits | **Conventional Commits.** **Los commits y las ramas los hace el usuario a mano**; Claude los propone al final de cada fase | Control total del historial |
| Versiones | SemVer: `0.x` durante el desarrollo, **`1.0.0`** al igualar la app actual | — |
| Agentes | Claude Code (VS Code) orquesta a dos subagentes: **context-keeper** y **blind-tester** | Ver sección 8 |
| SO de trabajo | **Windows** + VS Code | Afecta a finales de línea, puertos y scripts |
| Imágenes de máquinas | **v2** (fotos propias desde el móvil) | Las imágenes de internet dan problemas de licencia y no coinciden con tu gimnasio |

### 2.1 Decisiones de la Fase 0 (2026-11-02)

| Tema | Decisión | Motivo |
|---|---|---|
| Licencia | **«All rights reserved»** mientras el repo sea privado; **MIT** al hacerlo público | Cierra la pregunta abierta de la licencia |
| Versiones fijadas | Versiones exactas en `package.json`. **TypeScript 6.0.x** y **ESLint 9.x** | typescript-eslint exige TS `<6.1` (TS 7 aún no es usable); eslint-plugin-react y jsx-a11y no soportan ESLint 10 todavía |
| Node | El proyecto se queda en **Node 22**: `.nvmrc` 22, CI con 22, `@types/node` 22, `engines` `>=22.22.2` | jsdom 30 exige `>=22.22.2`. El usuario desarrolla en local con Node 26.13.0: aceptado, eligió mantener 22 en el proyecto |
| Script `typecheck` | **`tsc -b`** en lugar de `tsc --noEmit -p .` | El `tsconfig.json` raíz solo tiene referencias (`app`, `node`, `e2e`); con `-p .` no se comprobaría ningún archivo |
| husky | Solo el hook **`commit-msg`** (commitlint); **sin `pre-commit`** | — |
| Contrato sync v1 (borrador) | Cambios respecto a gym_app: campos `type`/`updatedAt`/`deleted`/`serverSeq` (antes `t`/`u`/`del`/`srv`); copias como `GET /api/v1/backups` y `GET /api/v1/backups/{date}`; códigos de error en lugar de frases en español; `CLAVE_SYNC` de mínimo 32 caracteres; la respuesta incluye `rejected` | Contrato limpio y portable a otro backend |
| Archivos aplazados | `netlify.toml`, `public/robots.txt`, `netlify/functions/sync.ts` y `tests/mocks/sync-server.ts` se crean en su fase (4 / 8) | Solo se crea lo que la fase necesita |

### 2.2 Decisiones de la Fase 1 (2026-11-02)

| Tema | Decisión | Motivo |
|---|---|---|
| Paleta y fuente | Paleta **«Hierro»** y fuente **«Archivo»** (`@fontsource-variable/archivo`, autoalojada). Elegidas con `docs/design/selector.html` (generado por `scripts/build-selector.mjs`); registro en `docs/design/decision.md` | Elección del usuario sobre pantallas reales en miniatura |
| Tokens | Variables CSS en `src/theme/tokens.css` (documentadas en `docs/design/tokens.md`); los tintes se calculan con `color-mix` al **12 %** | Un solo origen para claro/oscuro, sin colores sueltos en componentes |
| Tema | `system \| light \| dark` guardado en `localStorage`, **solo en el dispositivo** (no se sincroniza); sigue al sistema en vivo y actualiza `theme-color` | Ajuste propio de cada dispositivo |
| i18n | `i18next` + `react-i18next`, **`es` por defecto** y `en`; claves tipadas; formatos con `Intl`: `es-ES` y **`en-GB`** para inglés; idioma guardado en el dispositivo | Fechas día/mes y sistema métrico también en inglés |
| Router | **react-router 8**, con `RouterProvider` importado de `react-router/dom` | Versión actual; el paquete DOM aporta el provider para el navegador |
| Textos de `src/ui` | `src/ui` puede usar `react-i18next` **solo para sus propias etiquetas genéricas** (claves `ui.*`, p. ej. «Cerrar») | Mantener la regla «todo texto por i18n» sin pasar etiquetas triviales por props |
| Ajustes del dispositivo | Lectura/escritura de preferencias locales (tema, idioma) centralizada en `src/data/deviceStorage.ts` | Un único punto de acceso al almacenamiento del dispositivo |
| Ámbito de commit para diseño | Los documentos de diseño usan el ámbito **`theme`** | `design` no es un ámbito permitido por commitlint |
| Límites de e2e | Tras el incidente del 2026-11-02 (sección 12): `playwright.config.ts` con **2 workers** en local (CI: los de por defecto + 2 reintentos), `retries` 0 y `maxFailures` 3 en local, `timeout` 30 s por test, `globalTimeout` 5 min (`npm run e2e`) y 10 min (`npm run e2e:all`, vía `--global-timeout=600000`), reporter `list` + `html` (`open: 'never'`), webServer con `reuseExistingServer: false` y timeout 60 s, chromium con `deviceScaleFactor` 2 (antes 3), nunca `channel: 'chrome'`. **`npm run e2e` = solo Chromium**; nuevo **`npm run e2e:all`** = Chromium + WebKit. Puerto **9323** (informe de Playwright) añadido a `ports:check` y `ports:kill`. CI: job `e2e` (Chromium + WebKit, `npm run e2e:all`) **solo en PR a `main`**, después del job de checks, que sube el informe si falla. `.claude/settings.json` deniega `npx playwright install` y `npx playwright show-report` (Bash y PowerShell). Reglas nuevas en `.claude/rules.md`, `.claude/agents/blind-tester.md` y `.claude/commands/close-phase.md`: e2e solo con `npm run e2e`, en primer plano, sin flags extra, sin sondeo en segundo plano y sin nada pesado en paralelo; si pasa de 5 min o se cuelga → parar, `ports:kill`, comprobar puertos e informar; nunca reintentar en bucle (una ejecución + una tras un arreglo); nunca instalar navegadores; los e2e cubren flujos de usuario y criterios de aceptación (las combinaciones exhaustivas van a tests unitarios); axe una vez por pantalla y tema; objetivo `npm run e2e` < 2 min | Evitar que la suite sature el PC del usuario |
| Suite e2e reducida | Decisión del usuario (2026-11-02): de **111 a 38 tests por navegador** (navegación 12, tema 9, idioma 5, componentes 11, humo 1). Los e2e cubren flujos de usuario y criterios de aceptación; las combinaciones exhaustivas van a tests unitarios. axe se ejecuta **una vez por pantalla y tema (claro/oscuro), solo en Chromium** (se omite en WebKit). AC-NAV-09 («Tab llega al enlace "saltar al contenido"») es una **excepción documentada de WebKit** (`test.skip` con motivo); se sigue comprobando en Chromium, y el foco + Enter se comprueban en ambos motores | Suite rápida y ligera (~19 s en Chromium) sin perder cobertura de los criterios de aceptación |

### 2.3 Decisiones de la Fase 2 (2026-11-03)

| Tema | Decisión | Motivo |
|---|---|---|
| Serie de aproximación | **Cuenta como serie efectiva** en el recuento semanal (como en gym_app); se ignora en el 1RM y en los récords | Necesario para que la semana normal sume 104 y cuádriceps 16 |
| Incrementos por defecto | Mancuernas **+2 kg**; básicos de pierna y `gemelo-hack` **+5 kg**; todo lo demás (torso y aislamientos de pierna) **+2,5 kg** | Saltos reales del material del gimnasio |
| «No cuenta» | Es **por ejercicio y sesión**: `ExerciseNote.excludeFromProgression` + `reason` (`machine-busy`, `missing-plates`, `other-band`, `other`) | Una máquina ocupada afecta a un ejercicio, no a toda la sesión |
| Ejercicios fuera de rutina | `bilbo-banca` (barra), `bilbo-prensa` (discos) y `hack-squat` (discos) siguen en el catálogo, **sin archivar**, fuera de las rutinas; `dominadas` también fuera de las rutinas; `abdomen` se fusiona por alias (`legacyAliases.ts`: `abdomen` → `crunch-maquina`, `resolveExerciseId`) | Conservar historial sin ensuciar las rutinas |
| Tabla 4.3 | **Confirmada por el usuario** (sin «?»; straps en el peso muerto rumano: **sí**) | Cierra las dos preguntas abiertas de equipo y straps |
| Ids de rutina | Se conservan los ids de plantilla de gym_app: `push`, `pull`, `upper`, `lowerA`, `lowerB`, `lowerFull`; `libre` → `routineId: null`. Días ISO: Push 1, Pull 2, Lower B 3, Upper 5, Lower A 7, Lower Full ninguno | Migración directa desde gym_app |
| Regla del top set | Reps > tope del rango → subir siempre; reps = tope con RIR ≥ 1 o sin RIR → subir; RIR 0 → mantener; por debajo → mantener y buscar +1 rep. Bilbo: > 30 reps → +5 kg fijo. Dominadas: progresan con una banda más fina | Interpretación de `rutina-actual.md` |
| `WeekPlan` | Tiene `size` (5/4/3) además de `hiking` y `deload`. Semana corta: 4 → Push, Pull, Lower A, Lower B (se cae el Upper); 3 → Push, Pull, Lower Full | Representar la semana corta en el plan |
| Ajustes | Se separan: **sincronizados** (`rest` de básicos/aislamientos en segundos, `planStart`) y **solo del dispositivo** (tema, idioma, sonido, vibración, `syncKey`). Paleta y fuente **dejan de ser ajustes** (fijadas en la Fase 1) | Lo propio de cada dispositivo no viaja |
| Datos semilla | Los registros semilla tienen `updatedAt: 0` | Cualquier edición del usuario o copia del servidor gana |
| Tests del dominio | Vitest en dos proyectos (`domain` en node, `ui` en jsdom); umbral de cobertura **90 %** en `src/domain` (líneas, funciones, ramas, sentencias) con `npm run test:coverage`, que CI ejecuta en lugar de `npm run test` | El dominio no puede usar el DOM y la cobertura no puede bajar sin que falle CI; además la suite tarda la mitad (~39 s → ~18 s) |
| Ids derivados | `week_<lunes>`, `bw_<lunes>`, `note_<sesión>_<ejercicio>`, `blocklog_<bloque>_<fecha>`, `wmetric_<bloque>_<métrica>_<lunes>`; ajustes con id `settings`. Fechas ISO locales `YYYY-MM-DD`, semanas desde el lunes | Un registro por clave natural, sin duplicados entre dispositivos |

### 2.4 Decisiones de la Fase 3 (2026-11-03)

| Tema | Decisión | Motivo |
|---|---|---|
| `rec.maxPain` de gym_app | Nueva métrica semilla **`max-pain`** «Dolor máximo en los ejercicios» (0-10, umbral 3) en el bloque de rehabilitación del tobillo, entre `stairs` y `pogos` (orden del CSV de gym_app) | No perder ese dato al importar |
| `cfg_recovery` de gym_app | Campos genéricos opcionales nuevos **`startDate`** y **`reviewDate`** (fechas ISO) en `OptionalBlock`; `footballOk` se descarta | Sirven para cualquier bloque, no solo para el tobillo |
| Cobertura | El umbral del **90 %** se aplica también a **`src/data`**: umbrales por glob en `vite.config.ts` (`src/domain/**` y `src/data/**`, cada uno por separado) | La capa de datos guarda todo lo del usuario; no puede bajar sin que falle CI |
| Almacenamiento local (**ADR-0003**, `docs/adr/0003-local-storage-dexie.md`) | Una tabla de Dexie por tipo de registro + `pending` (una fila por id de registro) + `meta` (reloj monótono). Los borrados son filas solo con la envoltura en la misma tabla. Los repositorios validan con zod, ponen `updatedAt` con el reloj monótono persistido y encolan **en la misma transacción**. La semilla se escribe en la base de datos al arrancar con `ensureSeed` (inserta lo que falta, refresca solo los registros que siguen con `updatedAt` 0, nunca encola). `db.version(1)` no se edita una vez publicada: los cambios posteriores añaden versiones con `.upgrade()` y un test. Se pide `navigator.storage.persist()` al arrancar | Offline-first sin perder datos; esquema migrable |
| Ajustes sincronizados | Registro semilla **`SEED_SETTINGS`** (`src/domain/seed/settings.ts`: id `settings`, `DEFAULT_REST`, `planStart` null, `updatedAt` 0) | Siempre hay un registro de ajustes que cualquier edición sobrescribe |
| Formato real de gym_app (leído del **código fuente**, sin datos reales) | Valores reales de `t`: `session`, `set`, `note`, `act`, `bw`, `week` (id `wk_<lunes>`), `tpl` (id `tpl_<id>`), `rec`, `wall`, `excfg` (id `exc_<ej>`, campo `step`), `cfg` (ids `cfg_recovery`, `cfg_exp_brazos`), `mig`. La copia completa es `{ app: 'winter-arc', version: 2, exportedAt, records[] }` sin borrados (puede llevar `srv`); gym_app también aceptaba un array suelto | La tabla de la sección 6 y `docs/migration.md` tenían nombres que no coinciden; se corrigen en `feature/import-export` |
| Ramas de la fase | `feature/local-db` y después **`feature/import-export`** (antes `feature/legacy-import`): importador de gym_app + importación de JSON propio + exportaciones JSON/CSV | El nombre refleja todo lo que entra en la segunda rama |

---

## 3. Arquitectura

### 3.1 Visión general

```
┌──────────────────────── iPhone (PWA) ─────────────────────────┐
│  React UI ──► hooks ──► Domain (TS puro) ──► Repositories     │
│                                   │               │           │
│                                   ▼               ▼           │
│                          Rules (1RM, progresión,  Dexie       │
│                          recuento de series…)     (IndexedDB) │
│                                                   │           │
│                                         SyncEngine (cola,     │
│                                         reintentos, LWW)      │
│                                                   │           │
│                                     SyncTransport (interfaz)  │
└───────────────────────────────────────────────────┼───────────┘
                                                    │ HTTPS · POST /api/v1/sync
                                                    ▼
                         Netlify Function (TS) ──► Netlify Blobs
                         (mañana: Java / Python / Firebase con el mismo contrato)
```

**El backend es lo más tonto posible.** Solo guarda y devuelve registros, aplica «gana el más reciente» y hace copias diarias. Toda la lógica (progresión, récords, planes, recuentos) vive en el cliente, en `src/domain`. Así la app funciona entera sin conexión y cambiar de backend solo exige reimplementar un contrato pequeño.

### 3.2 Stack

| Capa | Herramienta |
|---|---|
| Build | Vite |
| UI | React 18+, React Router |
| Estado | Dexie como fuente de verdad (`useLiveQuery` de `dexie-react-hooks`) + estado de UI local. Sin Redux |
| Validación | **zod**: esquemas compartidos por cliente y función (contrato de sync, importador) |
| Estilos | Tokens de diseño en variables CSS + CSS Modules. Tema claro/oscuro por `data-theme` |
| Fuentes | Autoalojadas con `@fontsource/*` (nada se carga de fuera; funciona sin conexión) |
| i18n | `i18next` + `react-i18next` (`es` por defecto, `en` opcional) |
| PWA | `vite-plugin-pwa` (Workbox): precache, aviso de versión nueva |
| Gráficas | SVG propio, como ahora (sin dependencias pesadas) |
| Backend | Netlify Functions en TypeScript + `@netlify/blobs` |
| Tests | Vitest + React Testing Library (unitarios y de componentes), Playwright (end-to-end) |
| Calidad | ESLint + Prettier + `tsc -b`; husky + commitlint (valida tus mensajes de commit) |
| CI | GitHub Actions: lint, typecheck, tests con cobertura (`test:coverage`, desde la Fase 2) y build en cada PR a `dev` y `main`; e2e solo en PR a `main` (2.000 minutos/mes gratis en repos privados) |

### 3.3 Estructura del repositorio

```
certavi/
├─ .claude/
│  ├─ settings.json          # permisos: qué puede y no puede ejecutar Claude Code
│  ├─ rules.md               # restricciones de trabajo (importado desde CLAUDE.md)
│  ├─ agents/
│  │  ├─ context-keeper.md
│  │  └─ blind-tester.md
│  └─ commands/
│     ├─ start-phase.md      # /start-phase N
│     └─ close-phase.md      # /close-phase: propone ramas, commits, versión y tag
├─ .github/workflows/ci.yml
├─ docs/
│  ├─ spec/                  # especificación funcional (la única que lee el tester)
│  ├─ api/sync-v1.md         # contrato del backend
│  ├─ adr/                   # decisiones de arquitectura (ADR-0001…)
│  ├─ design/                # paleta, tipografía, tokens elegidos
│  └─ migration.md           # mapeo desde gym_app
├─ netlify/functions/sync.ts
├─ public/                   # iconos, robots.txt, manifest (generado)
├─ scripts/ports-check.mjs   # qué proceso ocupa 5173/4173/8888/8787
├─ src/
│  ├─ domain/                # TS puro: model/ (zod), rules/, seed/ (catálogo, rutinas, bloques), testing/, dates.ts. Sin React ni Dexie
│  ├─ data/                  # Dexie, repositorios, SyncEngine, transporte, importador
│  ├─ features/              # today, session, calendar, routines, exercises, progress, blocks, settings
│  ├─ ui/                    # componentes comunes: Button, Dialog, Chip, NumberField, Sheet, Toast…
│  ├─ i18n/                  # es.json, en.json
│  ├─ theme/                 # tokens.css, temas, fuentes
│  └─ app/                   # rutas, layout, providers, registro del service worker
├─ tests/
│  ├─ e2e/                   # Playwright (lo escribe el blind-tester)
│  └─ mocks/sync-server.ts   # servidor falso de /api/v1/sync para e2e
├─ CLAUDE.md
├─ context.md                # este documento
├─ CHANGELOG.md
├─ README.md
├─ netlify.toml
├─ tsconfig.json             # solo referencias: tsconfig.app / .node / .e2e.json
├─ .gitattributes            # * text=auto eol=lf
├─ .editorconfig
└─ .nvmrc                    # Node 22 LTS
```

### 3.4 Lo que se trae de la app actual

- **Netlify:** `netlify.toml` con las cabeceras de seguridad (CSP sin recursos externos, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`), `robots.txt` que bloquea todo y `Cache-Control: no-cache` para el service worker y `index.html`.
- **Sync:** autenticación con clave secreta `CLAVE_SYNC` (comparación en tiempo constante, retardo ante clave errónea), escritura condicional con etag y reintentos, y **copia diaria** (hora de Madrid) con las 14 últimas, más las acciones de listar, descargar y restaurar.
- **Cliente:** cola de pendientes persistida en la misma transacción que el registro, reintentos con backoff (4, 8, 15, 30 y 60 s), envío con `keepalive` al bloquear el móvil, sincronización al volver a la app y al recuperar la conexión, registro de intentos visible en Ajustes y «el eco de lo que acabo de subir no repinta la pantalla».
- **PWA:** iconos, manifest, `display: standalone`, aviso de «Hay una versión nueva · Recargar» y fuentes autoalojadas.
- **Seguridad de datos:** exportar e importar JSON completo, JSON de una sesión, JSON de una semana y CSV de series, actividad y peso. Formato CSV para Excel en español (punto y coma y coma decimal).

### 3.5 Preparado para migrar el backend

- `docs/api/sync-v1.md` describe el contrato completo: petición, respuesta, errores, autenticación, reglas de fusión, borrados y copias. Es lo único que otro backend tiene que cumplir.
- El cliente habla con una interfaz `SyncTransport` (`push/pull`, `listBackups`, `getBackup`). `NetlifyTransport` es una implementación. Mañana puede haber `HttpTransport` (Java/Spring o Python/FastAPI con el mismo contrato) o `FirebaseTransport`.
- Los esquemas zod del contrato viven en `src/domain/sync/contract.ts`. Para otro lenguaje se pueden exportar a JSON Schema.
- **ADR-0001** documenta la opción A y las condiciones para pasar a otra (por ejemplo: necesidad de consultas en servidor, varios usuarios o un volumen de datos que haga lento el JSON único).

---

## 4. Modelo de dominio

Los datos se guardan y se sincronizan como **JSON plano** (tipos en `src/domain/model`). El comportamiento va en módulos de reglas puras y testeables (`src/domain/rules`), y en clases solo donde aportan (por ejemplo, `ProgressionRule`). Todo registro sincronizable lleva la misma envoltura:

```ts
interface SyncEnvelope {
  id: string;          // estable; los ids de ejercicio de la app vieja se conservan
  type: RecordType;    // 'exercise' | 'routine' | 'session' | 'set' | ...
  updatedAt: number;   // ms; gana el mayor
  deleted?: true;      // borrado lógico, viaja a los demás dispositivos
  serverSeq?: number;  // lo pone el servidor; el cliente nunca lo envía
}
```

### 4.1 Entidades

| Entidad | Campos principales | Notas |
|---|---|---|
| **Exercise** | `id`, `name` (clave i18n o texto si es propio), `primaryGroup`, `secondaryMuscles[]`, `equipment` (`plate-loaded` · `selectorized` · `dumbbell` · `cable` · `barbell` · `bodyweight` · `other`), `kind` (`compound` · `isolation`), `unilateral`, `supportsStraps`, `supportsBand`, `defaultScheme`, `increment` (kg), `custom` (creado por el usuario), `archived` | Catálogo semilla + ejercicios creados desde cero |
| **MuscleGroup** | `chest` · `back` · `shoulders` · `quads` · `hamstrings-glutes` · `triceps` · `biceps` · `calves` · `core` · `forearms` | Para el recuento semanal |
| **SetScheme** | lista de bloques `{ kind: 'approach' \| 'top' \| 'backoff' \| 'straight' \| 'bilbo', reps: '6-8' \| '~10' \| '', count }`, `rir` | «1 aprox + 1 + 2» = tres bloques |
| **Routine** | `id`, `name`, `items[]: { exerciseId, scheme, note, optional }`, `weekday?` | Editable. Ya no hay «plantilla + override»: la rutina es una sola |
| **WeekPlan** | `id` (lunes), `hiking`, `deload`, `size` (5/4/3), `plannedSetsByGroup`, `closedAt` | Al cerrar la semana se congela el plan. `size` añadido en la Fase 2 (2.3) |
| **WorkoutSession** | `id`, `date`, `routineId \| null` (null = **sesión libre**), `startedAt`, `endedAt`, `items[]` (copia de la rutina al empezar, editable: añadir, quitar o reordenar ejercicios y **series**), `note`, `readiness` (1-5) | Cambiar el plan de la sesión **no** toca la rutina |
| **SetEntry** | `id`, `sessionId`, `exerciseId`, `slot`, `kind` (`warmup` · `approach` · `top` · `backoff` · `straight` · `bilbo` · `extra`), `weight`, `reps`, `rir`, `straps?`, `band?`, `completedAt` | El calentamiento se muestra con su símbolo y no cuenta en las estadísticas |
| **ExerciseNote** | `sessionId`, `exerciseId`, `text`, `excludeFromProgression`, `reason` | «No cuenta» por ejercicio y sesión (2.3) |
| **Activity** | `date`, `kind` (fútbol, natación, senderismo…), `minutes`, `note` | — |
| **BodyWeight** | `week` (lunes), `kg` | Editable en cualquier semana, también la anterior |
| **OptionalBlock** | `id`, `name`, `type` (`mobility` · `stretching` · `rehab`), `items[]: { id, name, dose, description }`, `days[]` (días de la semana), `metrics[]` (por ejemplo, «dolor al bajar escaleras 0-10», «pogos 0-10»), `active`, `startDate?`, `reviewDate?` (fechas ISO, Fase 3, 2.4) | Generaliza la recuperación del tobillo: movilidad, estiramientos y rehabilitación configurables |
| **BlockLog** | `date`, `blockId`, `done: { itemId: boolean }`, `metrics: { metricId: number }`, `note` | Checklist del día y métricas |
| **WeeklyMetric** | `week`, `metricId`, `values` (por ejemplo, test de la pared izquierda/derecha en cm) | — |
| **Settings** | Sincronizados: `rest` (básicos/aislamientos, s), `planStart`. Solo del dispositivo: `theme` (`system` · `light` · `dark`), `locale` (`es` · `en`), sonido, vibración, `syncKey` | Lo que es de este dispositivo no se sincroniza. Paleta y fuente ya no son ajustes (2.3) |

### 4.2 Reglas de dominio (todas con tests)

- **1RM estimado** (Epley sobre la mejor serie; se ignoran las de calentamiento y aproximación).
- **Progresión** según `rutina-actual.md`:
  - **Top set:** al tocar el tope del rango a RIR 1-2 se sube en la siguiente sesión. Si se supera el rango, se sube sí o sí.
  - **Incrementos:** +2,5 kg en torso y +5 kg en pierna, salvo que el ejercicio tenga su propio incremento. Concretado en la Fase 2 (2.3): mancuernas +2 kg; básicos de pierna y `gemelo-hack` +5 kg; el resto +2,5 kg.
  - **Back-off:** ≈ −10 % del top, redondeado al incremento.
  - **Aislamientos:** cuando todas las series llegan al tope, se sube la mínima carga.
  - **Excepción:** las sesiones marcadas «no cuenta» (máquina ocupada, faltan discos, otra banda) no deciden subidas.
- **Series efectivas por grupo y semana** frente al plan, con el plan congelado en las semanas cerradas. La aproximación cuenta; el calentamiento y las series de 0 reps no (2.3).
- Reglas implementadas en la Fase 2 y descritas para el usuario en `docs/spec/rules.md`.
- **Récords** (peso máximo, 1RM estimado, mejores marcas por repeticiones); excluyen las semanas de descarga.
- **Descarga:** mitad de series (redondeando hacia arriba), sin opcionales ni Bilbo, RIR 3-4.
- **Semana corta:** con 4 sesiones se cae el Upper, nunca la pierna. Con 3, Push, Pull y Lower Full.

### 4.3 Catálogo semilla

- Se conservan **todos los ids** de `gym_app`, para no perder historial. Los renombres no pierden progreso.
- `abdomen` se fusiona en `crunch-maquina` (era el mismo ejercicio).

**Renombres y altas decididos**

| id | Nombre (es) | Estado |
|---|---|---|
| `jalon-pecho` | Jalón de pecho · agarre abierto neutro | **Renombrado** (mismo historial) |
| `jalon-cerrado` | Jalón de pecho · agarre cerrado prono | Renombrado |
| `hack-banda` | Sentadilla hack con banda | **Nuevo** (historial propio, banda morada por defecto) |
| `dominadas` | Dominadas | Se queda en el catálogo, fuera de las rutinas |

**Equipo y straps (confirmada por el usuario en la Fase 2, 2026-11-03)**

Leyenda: D = discos · P = placas · M = mancuernas · Po = polea · C = peso corporal.

| Ejercicio | Equipo | Straps |
|---|---|---|
| Press inclinado con mancuernas | M | — |
| Press de pecho máquina vertical | P | — |
| Press de pecho en máquina vertical de pie | D | — |
| Press de pecho inclinado en máquina | D | — |
| Aperturas en máquina | P | — |
| Press de hombro inclinado máquina | D | — |
| Press militar en máquina de discos | D | — |
| Elevaciones laterales máquina | D | — |
| Elevaciones laterales en máquina de placas | P | — |
| Elevaciones laterales en polea | Po | — |
| Tríceps en V · overhead · katana · polea unilateral | Po | — |
| Jalón abierto neutro / cerrado prono | P | **Sí** |
| Remo en T | D | **Sí** |
| Remo bajo en máquina de placas | P | **Sí** |
| Remo bajo en máquina de discos | D | **Sí** |
| Remo alto Iso-Lateral | D | **Sí** |
| Vuelos posteriores máquina | P | — |
| Curl inclinado con mancuernas | M | — |
| Curl martillo en polea | Po | — |
| Curl predicador en máquina | D | — |
| Curl de muñeca por detrás | P | — |
| Crunch en máquina | P | — |
| Peso muerto rumano en máquina (Technogym Pure) | D | **Sí** (agarre) |
| Hip thrust en máquina de discos | D | — |
| Hip thrust en máquina | D | — |
| Abducción / aducción | P | — |
| Curl femoral de pie / tumbado / sentado | D | — |
| Prensa · prensa pendular unilateral · hack · hack con banda | D | — |
| Extensión de pierna (discos) / (placas) | D / P | — |
| Gemelo en hack · gemelo sentado en discos | D | — |
| Dominadas | C | — |

### 4.4 Rutinas semilla

Las de `rutina-actual.md` (ciclo 2 nov – 20 dic 2026): Push, Pull, Upper, Lower A, Lower B y Lower Full, con los ids de la tabla anterior.

**Bloque opcional semilla «Rehabilitación del tobillo»**:
- Movilidad diaria: rodillo, pared, sentado sobre el tobillo, goma y bajada de cajón.
- Fuerza 3-5 días por semana: talón con bajada lenta, zancada y pogos.
- Métricas: dolor al bajar escaleras (0-10), dolor máximo en los ejercicios (`max-pain`, 0-10, añadida en la Fase 3, 2.4) y pogos (0-10).
- Métrica semanal: test de la pared, izquierda y derecha (cm).

Se crea vacío un bloque «Estiramientos» para rellenarlo.

---

## 5. Funcionalidades

### 5.1 Se conserva (paridad con `gym_app` 1.5.1 = condición para la v1.0.0)

- **Hoy:**
  - sesión propuesta por día de la semana;
  - empezar rutina u otra rutina;
  - registrar en otra fecha;
  - **sesión libre**;
  - semana de senderismo y de descarga;
  - actividad;
  - peso medio (esta semana y la anterior);
  - tarjeta de bloques del día.
- **Sesión activa:**
  - lo de la última vez como referencia (pulsar ✓ en vacío guarda eso);
  - 0 kg válido;
  - calentamientos;
  - serie extra;
  - back-off sugerido;
  - straps y banda (corregibles en series ya guardadas);
  - notas por ejercicio y de sesión;
  - «¿cómo llegas?» (1-5);
  - temporizador de descanso (pitido y vibración, solo en sesiones de hoy);
  - reordenar ejercicios;
  - quitar y añadir ejercicios;
  - editar fecha, horas y rutina;
  - lo escrito sin guardar sobrevive a cualquier repintado;
  - aviso de cambios de otro dispositivo.
- **Calendario:** mes con sesiones, actividades y semanas especiales; detalle del día; registrar en ese día; semana cerrada con su plan; JSON de la semana.
- **Rutinas:** ver sin empezar, editor (añadir, quitar, ordenar y esquema de series) y restaurar original.
- **Ejercicios:** ficha con 1RM, peso máximo, mejor volumen, evolución con métricas, mejores marcas por repeticiones, historial e incremento propio.
- **Progreso:** series por grupo frente al plan (esta semana, la pasada, media de 4), series por semana, por ejercicio, récords, peso corporal, revisión del ciclo y «cómo llegas» por semana.
- **Ajustes:** clave de sync, registro de intentos, copias del servidor (ver, descargar, restaurar), exportar e importar, descansos, sonido, vibración y tema.

### 5.2 Nuevo en Certavi

1. **Nuevo estilo:** paleta y fuentes elegidas por ti en la Fase 1.
2. **Tema claro / oscuro / automático:** botón visible en la cabecera y detección del ajuste del dispositivo, con cambio en vivo si el sistema cambia.
3. **Idioma:** español e inglés, en Ajustes.
4. **Filtros de ejercicios**, en la lista del catálogo **y** al añadir un ejercicio a una sesión o rutina:
   - búsqueda por texto;
   - grupo muscular;
   - equipo (discos, placas, mancuernas, polea, peso corporal, otro);
   - tipo (básico o aislamiento);
   - straps;
   - creados por mí;
   - en alguna rutina.
5. **Etiqueta de equipo** visible en cada ejercicio.
6. **Straps** en todos los ejercicios de espalda y en el peso muerto rumano (confirmado en la Fase 2).
7. **Añadir y quitar series efectivas** en la sesión activa (incluidas las que vienen de la rutina) y en el editor de rutinas.
8. **Calentamientos con símbolo** propio, como la «W» de Hevy («C» en español, «W» en inglés), visualmente distintos y fuera de las estadísticas.
9. **Bloques opcionales del día:** movilidad, estiramientos y rehabilitación configurables, con checklist y métricas.
10. **Diálogos propios** de confirmación en lugar del `confirm()` del navegador (eliminar ejercicio, serie, sesión…), accesibles y con «Deshacer» cuando tenga sentido.
11. **Crear un ejercicio desde cero:** nombre, grupo, secundarios, equipo, tipo, unilateral, straps, banda, esquema por defecto e incremento.
12. **Renombres del catálogo** (sección 4.3).

---

## 6. Migración desde la app actual

1. **Antes de nada**, en `gym_app`, ve a Ajustes → «Copia completa (.json)» y guárdala fuera del repositorio, por ejemplo en `D:\backups\certavi\`. **Nunca en el repo.**
2. Certavi tendrá en Ajustes → **«Importar desde la app anterior»**: lee ese JSON, lo valida con zod, lo transforma y muestra un resumen antes de guardar («27 sesiones, 553 series…»).

**Mapeo de registros**

| `t` en gym_app | Certavi | Notas |
|---|---|---|
| `session` | `WorkoutSession` | `tpl` → `routineId` (`libre` → `null`), `items` se conservan |
| `set` | `SetEntry` | `w/r/rir/straps/band/kind/slot` |
| `note` | `ExerciseNote` | — |
| `act` | `Activity` | — |
| `bw` | `BodyWeight` | — |
| `wk` | `WeekPlan` | `hiking`, `deload` y el plan congelado |
| `tpl` | `Routine` | El override pasa a ser la rutina |
| `rec` | `BlockLog` del bloque de rehabilitación | `mob`, `ecc`, `stairs`, `pogos`, `maxPain`, `note` |
| `wall` | `WeeklyMetric` (test de la pared) | — |
| `exc` | `Exercise.increment` | — |
| `cfg_recovery` | Bloque de rehabilitación (activo, fecha del fisio) | — |
| `cfg_exp_brazos`, `mig_*` | Se ignoran | — |
| `del: true` | Se ignoran | — |
| Ejercicio `abdomen` | → `crunch-maquina` | — |

> **Corrección pendiente (2026-11-03, Fase 3):** al leer el **código fuente** de gym_app (sin datos reales) se vio que algunos nombres de esta tabla no son los reales: `wk` es `week` (id `wk_<lunes>`), `tpl` tiene id `tpl_<id>`, `exc` es `excfg` (id `exc_<ej>`, campo `step`), `cfg_recovery` y `cfg_exp_brazos` son registros `t: 'cfg'`, `mig_*` es `t: 'mig'`. La copia completa es `{ app: 'winter-arc', version: 2, exportedAt, records[] }` **sin borrados** (puede llevar `srv`); gym_app también aceptaba un array suelto. `rec.maxPain` → métrica `max-pain`; `cfg_recovery` → `startDate`/`reviewDate` del bloque (sin `footballOk`). Ver 2.4. Esta tabla y `docs/migration.md` se corrigen en `feature/import-export`.

3. Los tests del importador usan un **JSON sintético**, nunca tus datos reales.
4. Durante el desarrollo, `gym_app` sigue siendo la app del día a día. Cuando Certavi llegue a la v1.0.0, haces la última exportación, la importas, usas Certavi y **archivas** `gym_app` en GitHub (Settings → Archive).

---

## 7. Flujo de trabajo

### 7.1 Ramas

```
main ─────●──────────────────────●──────────►  producción (Netlify despliega)
           \                    / (PR release)
dev ────────●───●───●───●──────●────────────►  integración (despliegue de rama, opcional)
             \     / \     /
feature/x     ●───●   ●───●                     una por funcionalidad, sale de dev y vuelve a dev
```

- Las ramas `feature/<tema>`, `fix/<tema>`, `chore/<tema>` y `docs/<tema>` salen de `dev` y vuelven a `dev` por Pull Request.
- **Release**: PR de `dev` a `main` + tag `vX.Y.Z` sobre `main`.
- Aviso: en repos **privados** con GitHub Free no hay protección de ramas, así que nadie impide un push directo a `main`. Lo garantiza la disciplina más la regla de Claude Code. Al hacer público el repo, activa la protección de `main` y `dev`.

### 7.2 Conventional Commits

Formato: `tipo(ámbito): descripción en inglés, imperativo, minúsculas`.

| Tipo | Uso | Ejemplo |
|---|---|---|
| `feat` | Funcionalidad nueva | `feat(session): allow removing planned sets` |
| `fix` | Corrección | `fix(sync): keep pending queue after failed push` |
| `refactor` | Cambio sin efecto visible | `refactor(domain): extract progression rule` |
| `test` | Tests | `test(domain): cover epley 1rm edge cases` |
| `docs` | Documentación | `docs(api): describe sync v1 contract` |
| `style` | Formato (no CSS de la app) | `style: apply prettier` |
| `chore` | Herramientas, dependencias | `chore: add vitest and testing library` |
| `ci` | GitHub Actions | `ci: run lint, typecheck and tests on pr` |
| `build` | Vite, PWA, Netlify | `build(pwa): configure workbox precache` |
| `perf` | Rendimiento | `perf(progress): memoize weekly totals` |

- **Ámbitos**: `domain`, `data`, `sync`, `api`, `session`, `today`, `calendar`, `routines`, `exercises`, `progress`, `blocks`, `settings`, `ui`, `theme`, `i18n`, `pwa`, `claude`, `release` (commit de versión) y `deps` (dependencias). El ámbito es opcional.
- **Cambios incompatibles**: `feat!:` o el pie `BREAKING CHANGE:`.
- **Commits pequeños** y que compilen. Uno por idea.
- commitlint rechaza los mensajes que no cumplen el formato.

### 7.3 Versiones y tags

| Versión | Contenido (fin de fase) |
|---|---|
| `v0.1.0` | Fase 0: proyecto base, herramientas, documentación y agentes |
| `v0.2.0` | Fase 1: diseño, tema, i18n y esqueleto de navegación |
| `v0.3.0` | Fase 2: dominio y catálogo |
| `v0.4.0` | Fase 3: datos locales, importador y exportaciones |
| `v0.5.0` | Fase 4: sincronización y backend |
| `v0.6.0` | Fase 5: Hoy y sesión activa |
| `v0.7.0` | Fase 6: catálogo con filtros, ejercicios propios y editor de rutinas |
| `v0.8.0` | Fase 7: calendario, progreso, fichas y bloques opcionales |
| `v0.9.0` | Fase 8: pulido PWA, accesibilidad y rendimiento |
| **`v1.0.0`** | Fase 9: QA completo, migración real y despliegue definitivo |

- **Tag anotado**, por ejemplo: `git tag -a v0.3.0 -m "v0.3.0 · domain model and catalog"` y `git push origin v0.3.0`.
- `CHANGELOG.md` en formato *Keep a Changelog*, mantenido por el agente de contexto.
- La versión de `package.json` se sube en el commit de release.

### 7.4 Reparto de papeles

| Quién | Hace |
|---|---|
| **Tú** | Crear ramas, revisar el código, probar a mano en el móvil, hacer los commits, abrir y mergear los PR, crear los tags y desplegar |
| **Claude Code** | Escribir código, tests y documentación; ejecutar lint, tests y build; al cerrar la fase, proponer **qué commits hacer, con qué archivos y con qué mensaje**, la rama, el PR, la versión y el tag |
| **context-keeper** | Actualizar `context.md`, `CLAUDE.md` (si cambia algo estructural) y `CHANGELOG.md` al cerrar cada fase |
| **blind-tester** | Probar la app como usuario a partir de `docs/spec/` y escribir y ejecutar tests end-to-end con Playwright. **No lee `src/`** |

---

## 8. Claude Code: reglas, agentes y comandos

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
      "Bash(git commit:*)", "Bash(git push:*)", "Bash(git merge:*)", "Bash(git rebase:*)",
      "Bash(git tag:*)", "Bash(git reset --hard:*)", "Bash(git checkout -b:*)", "Bash(git switch -c:*)",
      "Bash(git branch -d:*)", "Bash(git branch -D:*)",
      "Bash(npm install -g:*)", "Read(./.env*)", "Read(./backups/**)"
    ],
    "ask": [
      "Bash(npm install:*)", "Bash(npm i:*)", "Bash(npm uninstall:*)", "Bash(npm update:*)",
      "Bash(npx netlify:*)"
    ],
    "allow": [
      "Bash(npm run lint:*)", "Bash(npm run typecheck:*)", "Bash(npm run test:*)",
      "Bash(npm run build:*)", "Bash(npm run e2e:*)", "Bash(npm run ports:*)",
      "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)"
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
  2. lanza el blind-tester;
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
test:coverage vitest run --coverage; umbral 90 % en src/domain (nuevo, 2026-11-03; lo ejecuta CI) y en src/data (desde la Fase 3, 2.4)
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

## 9. Preparación antes de la Fase 0

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

Cada fase sigue el mismo ciclo:

1. **Tú** creas la rama desde `dev`.
2. Lanzas `/start-phase N` o pegas el prompt.
3. Claude Code implementa.
4. Ejecutas `/close-phase`.
5. **Tú** revisas, pruebas en el móvil, haces los commits propuestos, abres el PR a `dev` y lo mergeas.
6. Al cerrar la fase: PR de `dev` a `main` y tag.

> Si una fase es grande, divídela en varias ramas `feature/*` (Claude Code te lo propondrá) y cierra la fase cuando estén todas en `dev`.

---

### Fase 0 · Base del proyecto → `v0.1.0` ✅

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

### Fase 1 · Diseño, tema, i18n y navegación → `v0.2.0` ✅

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

### Fase 2 · Dominio y catálogo → `v0.3.0` ✅

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

### Fase 3 · Datos locales, importador y exportaciones → `v0.4.0` 🚧

**Ramas**: `feature/local-db` y `feature/import-export` (antes `feature/legacy-import`; incluye el importador de gym_app, la importación de JSON propio y las exportaciones JSON/CSV)

**Estado (2026-11-03)**: **en curso**. Rama 1 de 2 (`feature/local-db`) **implementada y verificada, sin commits todavía**; rama 2 (`feature/import-export`) **sin empezar**. Decisiones en la sección 2.4.

- **Implementado — `feature/local-db`** (sin commits):
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
- **Criterios de aceptación**:
  - «Recargar la app no pierde nada»: ✅ para la parte A (test unitario que reabre la base de datos + e2e de recarga / página nueva).
  - «El importador transforma un JSON sintético…»: ⏳ pendiente (rama 2, `feature/import-export`).
  - Cumplido también: registro + entrada de cola atómicos (test que fuerza el fallo de la escritura en la cola); el borrado lógico oculta el registro y encola el tombstone.
- **Pendiente**:
  1. (usuario) commits de `feature/local-db` y PR a `dev`;
  2. (usuario) crear `feature/import-export` desde `dev`; después, implementarla: importador de gym_app (con la corrección de la sección 6 y de `docs/migration.md`), importación de JSON propio, exportaciones JSON (completa, sesión, semana) y CSV, y la parte B de `docs/spec/data-import-export.md`.

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

### Fase 4 · Sincronización y backend → `v0.5.0` ⏳

**Rama**: `feature/sync`

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

### Fase 5 · Hoy y sesión activa → `v0.6.0` ⏳

**Ramas**: `feature/today` y `feature/active-session`

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

---

### Fase 6 · Catálogo, ejercicios propios y rutinas → `v0.7.0` ⏳

**Ramas**: `feature/exercise-catalog` y `feature/routine-editor`

**Entregables**:
- Lista de ejercicios con **filtros**, **etiqueta de equipo**, straps visibles y **crear ejercicio desde cero** (editar y archivar los propios).
- Ficha de ejercicio completa.
- Editor de rutinas: añadir, quitar y ordenar ejercicios, **añadir y quitar series**, esquema y RIR; restaurar la rutina semilla.

**Prompt**:

```text
Lee context.md y CLAUDE.md. FASE 6: catálogo de ejercicios con filtros combinables (texto, grupo, equipo,
tipo, straps, propios, en rutina), etiqueta de equipo, creación/edición/archivado de ejercicios propios,
ficha de ejercicio (paridad con gym_app) y editor de rutinas con edición de series. Especificación primero
en docs/spec/, luego implementación y tests; blind-tester al final. /close-phase.
```

---

### Fase 7 · Calendario, progreso y bloques → `v0.8.0` ⏳

**Ramas**: `feature/calendar`, `feature/progress` y `feature/optional-blocks`

**Entregables**:
- Calendario completo con semanas especiales y cierre de semana.
- Progreso completo (sección 5.1).
- **Bloques opcionales**: configuración de movilidad, estiramientos y rehabilitación (ejercicios, días, métricas), checklist diario, métricas, gráfica con línea de 3/10 y métrica semanal (test de la pared).
- Peso corporal de cualquier semana.
- **Revisión del ciclo** (el `sixWeekReview` de gym_app) en las pantallas de progreso. Aplazada desde la Fase 2.
- **Regla del gemelo durante la rehabilitación** (aplazada desde la Fase 2, 2026-11-03). `rutina-actual.md` §5, «Lower A», nota «Gemelo»: 60 kg en la semana 1; desde la semana 2, +5 kg por semana si no hay dolor al día siguiente, siempre con pausa abajo y sin rebote, hasta volver a 80 kg; y la regla de gym_app: solo se sube si bajar escaleras no duele. Depende del bloque de rehabilitación del tobillo y de sus métricas, por eso va en esta fase. El modelo de progresión actual lo permite sin reescribirlo, con cambios aditivos:
  - un `context` opcional en `ProgressionInput` (bloques activos + últimas métricas de los bloques);
  - el id del ejercicio en la entrada;
  - un motivo nuevo para mantener el peso (p. ej. `'rehab-gate'`);
  - una guarda antes de la regla general.
  - Si aparecen más reglas especiales, convertir la cascada de `if` en una lista ordenada de reglas (aplica / aconseja).

**Prompt**:

```text
Lee context.md y CLAUDE.md. FASE 7: calendario, progreso (gráficas SVG propias, accesibles, claro/oscuro),
bloques opcionales configurables (movilidad, estiramientos, rehabilitación) con checklist diario, métricas
0-10 con línea de referencia y métrica semanal, y peso corporal editable en cualquier semana. Paridad con
gym_app según 5.1. Especificación, implementación, tests y blind-tester. /close-phase.
```

---

### Fase 8 · Pulido PWA, accesibilidad y rendimiento → `v0.9.0` ⏳

**Rama**: `chore/pwa-polish`

**Entregables**:
- Manifest e iconos definitivos y pantalla de inicio en iOS.
- Aviso de nueva versión.
- Auditoría Lighthouse (PWA, rendimiento y accesibilidad ≥ 90).
- Revisión de i18n en inglés.
- Estados vacíos y de error.
- Mensajes revisados (tono, claridad).
- Animaciones con `prefers-reduced-motion`.

**Prompt**:

```text
Lee context.md y CLAUDE.md. FASE 8: pulido. Manifest/iconos/iOS, aviso de versión nueva, auditoría Lighthouse
(dame el informe y corrige hasta ≥ 90 en PWA, rendimiento y accesibilidad), revisión completa de textos en
es y en (lista de cambios propuestos antes de aplicarlos), estados vacíos y de error, reduced motion.
blind-tester con una pasada completa de toda la app. /close-phase.
```

---

### Fase 9 · QA final, migración real y v1.0.0 ⏳

**Rama**: `release/1.0.0`, o directamente un PR de `dev` a `main`.

**Pasos**:
1. El blind-tester hace una regresión completa, en español y en inglés, claro y oscuro, sin conexión.
2. Tú usas Certavi en paralelo con gym_app durante 1 semana.
3. Exportas por última vez desde gym_app, importas en Certavi y compruebas los recuentos.
4. Release `v1.0.0`, tag y despliegue a producción.
5. Archivas `gym_app`.
6. Cuando quieras, haces público el repo y activas la protección de ramas.

**Prompt**:

```text
Lee context.md. FASE 9: preparación de la v1.0.0. Lanza al blind-tester para una regresión completa
(es/en, claro/oscuro, offline, 390x844). Prepara una checklist de migración real para que la ejecute yo
(exportar de gym_app, importar, verificar recuentos por tipo de registro). Revisa README y docs para
dejarlos de portfolio (capturas reales que yo te pase). Dame el plan de release a main con versión y tag.
```

---

## 11. Backlog v2

- **Fotos de las máquinas**: hechas con el móvil, comprimidas en el cliente y guardadas en Netlify Blobs, con miniatura en la ficha y en la sesión.
- **Backend serio**: Postgres (Neon o Supabase) o un servicio en Java/Spring o Python/FastAPI que cumpla `sync-v1`. Solo si aparece una necesidad real (consultas en servidor, varios usuarios…).
- **Más funciones**:
  - plantillas de ciclos con fechas de inicio y fin;
  - resumen automático de cierre de ciclo exportable en `.md`;
  - comparación entre ciclos;
  - superseries.
- **App nativa**: con Capacitor, si algún día hay Mac y cuenta de desarrollador.

---

## 12. Registro de progreso

> Lo mantiene el agente **context-keeper**. Una línea por cambio relevante, la más reciente arriba.

| Fecha | Fase | Qué | Versión |
|---|---|---|---|
| 2026-11-03 | 3 | **`feature/local-db` implementada y verificada** (rama 1 de 2 de la Fase 3, **sin commits**): Dexie con una tabla por tipo + `pending` + `meta` (ADR-0003), repositorios con validación zod, reloj monótono y cola en la misma transacción, borrados lógicos, `ensureSeed` al arrancar, `navigator.storage.persist()`, tarjeta «Datos» en Ajustes, métrica `max-pain`, `startDate`/`reviewDate` en bloques, `SEED_SETTINGS`, spec `docs/spec/data-import-export.md` (parte A). lint, typecheck, `test:coverage` (**364 en 32 archivos**; `src/data` 99,04 % / 97,56 % / 100 % / 100 %, umbral 90 % ahora también en `src/data`), build (aviso informativo: chunk de 618 kB) y format:check ✅. E2E `npm run e2e` (Chromium, 2 workers): **45/45 en 34,7 s** (7 nuevos en `data.spec.ts`). Puertos libres. Decisiones en 2.4. Paquetes: `dexie` 4.4.7, `dexie-react-hooks` 4.4.0, `fake-indexeddb` 6.2.7. Rama 2 renombrada a `feature/import-export`, sin empezar | `v0.4.0` (en curso) |
| 2026-11-03 | 2 | Release de la Fase 2 por el usuario: PR #6 (`feature/domain-model`) a `dev`, PR #7 `dev → main` y tag `v0.3.0`. Sin commit `chore(release)`: `package.json` quedó en 0.2.0; la entrada `[0.3.0]` del `CHANGELOG.md` se añadió en `feature/local-db` | `v0.3.0` |
| 2026-11-03 | 2 | **Fase 2 implementada y verificada** en `feature/domain-model`: modelo de dominio (zod), reglas, catálogo semilla (45 ejercicios), 6 rutinas y bloques semilla, claves i18n de la semilla, `docs/spec/rules.md`, proyectos de Vitest node/jsdom y `test:coverage` en CI. lint, typecheck, test (**326 en 27 archivos**), build y format:check ✅; cobertura de `src/domain` 100 % sentencias / 96,86 % ramas / 100 % funciones / 100 % líneas (umbral 90 % comprobado). Criterios de aceptación ✅ (semana normal 104 y por grupo; también 81 / 63 / descarga 62). Regresión e2e `npm run e2e` (Chromium, 2 workers): **38/38 en 46,1 s**. Puertos libres. Decisiones en 2.3; regla del gemelo y revisión del ciclo aplazadas a la Fase 7. Paquetes: `zod` 4.6.7, `@vitest/coverage-v8` 5.1.0. Pendiente: commits, PR a `dev`, PR `dev → main` y tag por el usuario | `v0.3.0` (pendiente de tag) |
| 2026-11-03 | 1 | Release de la Fase 1 por el usuario: commits de `feature/app-shell`, PR #4 a `dev`, PR `dev → main`, `chore(release): v0.2.0` y tag | `v0.2.0` |
| 2026-11-02 | 1 | **Fase 1 implementada y verificada** en `feature/app-shell`: lint, typecheck, test (179 en 16 archivos), build y format:check ✅; puertos libres. Suite e2e reducida por decisión del usuario de 111 a 38 tests por navegador (2.2); ejecución válida `npm run e2e` (Chromium, 2 workers): **38/38 en 18,2 s**. Antes, la suite de 111 pasó entera en 33 s (ejecución del usuario). Todos los criterios de aceptación cubiertos. Pendiente: commits, PR a `dev`, PR `dev → main` y tag por el usuario | `v0.2.0` (pendiente de tag) |
| 2026-11-02 | 1 | **Incidente e2e** durante `/close-phase` (20:13–20:32 hora local): el blind-tester lanzó la suite de Playwright 3 veces (+1 sonda) en ~18 min. La 1.ª ejecución usó los 8 workers por defecto de Playwright (50 % de 16 CPU lógicas) con Chromium (`deviceScaleFactor` 3) + WebKit, ~36 escaneos de axe y eslint/tsc a la vez: 7,9 min y 62 fallos, todos timeouts de `page.goto` / `ERR_ABORTED` (falta de recursos). La misma suite con 4 workers tardó 52 s con 1 fallo. Parar el agente no paró la última ejecución (siguió ~1 min). El PC del usuario se volvió muy lento, Chrome dejó de responder y se cayó la conexión (registro de Windows: fallo de handshake del adaptador Wi-Fi USB a las 20:20; causa atribuida a la saturación, no confirmada). No intervinieron: descargas de navegadores, servidor del informe HTML, reintentos automáticos ni el Chrome del usuario. **Decisión**: límites de e2e de la sección 2.2 (2 workers en local, `e2e` solo Chromium, `e2e:all`, job e2e en CI solo en PR a `main`, puerto 9323, reglas nuevas para agentes) | — |
| 2026-11-02 | 1 | `feature/app-shell` implementada (i18n es/en, shell con react-router 8, páginas vacías, Ajustes, componentes base de `src/ui`, `/dev/ui`, spec de tema/idioma/navegación). lint, typecheck, test (179) y build ✅; axe sin violaciones. **Sin commits** y **sin ejecución e2e válida** todavía | `v0.2.0` (en curso) |
| 2026-11-02 | 1 | `feature/design-system` mergeada en `dev` (PR #3): selector, decisión Hierro + Archivo, tokens y motor de tema | `v0.2.0` (en curso) |
| 2026-11-02 | 0 | Release de la Fase 0 por el usuario: commits, PR a `dev`, PR `dev → main` y tag | `v0.1.0` |
| 2026-11-02 | 0 | Base del proyecto implementada y verificada (lint, typecheck, test, build, format:check, e2e en chromium + webkit, puertos libres; commit denegado a Claude). Decisiones en 2.1. Pendiente: commits, PR y tag por el usuario | `v0.1.0` (pendiente de tag) |
| 2026-11-01 | — | Plan inicial y decisiones (este documento) | — |

**Estado de fases**: 0 ✅ (`v0.1.0`) · 1 ✅ (`v0.2.0`) · 2 ✅ (`v0.3.0`) · 3 🚧 (`feature/local-db` implementada y verificada, sin commits; `feature/import-export` sin empezar) · 4 ⏳ · 5 ⏳ · 6 ⏳ · 7 ⏳ · 8 ⏳ · 9 ⏳

**Preguntas abiertas**:
- Qué estiramientos van en el bloque «Estiramientos» (antes de la Fase 7).

**Pendiente para fases futuras**:
- Fase 7: regla del gemelo durante la rehabilitación (60 kg en la semana 1, +5 kg/semana sin dolor al día siguiente hasta 80 kg, y solo si bajar escaleras no duele), con cambios aditivos en el modelo de progresión (ver la Fase 7).
- Fase 7: revisión del ciclo (`sixWeekReview` de gym_app) en las pantallas de progreso.
- Fase 3 (`feature/import-export`): corregir la tabla de la sección 6 y `docs/migration.md` con los nombres reales de gym_app (2.4).
- Sugerencia (no hecha, 2026-11-03) para la Fase 8: dividir el bundle (code-splitting); el chunk principal pesa 618 kB.
- Sugerencia (no hecha, 2026-11-03) para la Fase 8 (estados de error): mostrar un error visible si la base de datos local no se puede abrir.