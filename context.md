# Certavi · contexto y plan de desarrollo

> Documento de arranque del proyecto **Certavi**, la reescritura de la app de registro de gimnasio (antes «Winter Arc · registro», repositorio `gym_app`).
> Al crear el repositorio, este archivo se copia como `context.md` en la raíz. Desde ese momento es la **fuente de verdad del estado del proyecto**: qué está decidido, qué está hecho, qué falta y con qué prompt se arranca cada fase. Lo mantiene al día el agente de contexto.
>
> Última actualización: 10 nov 2026 · Estado: **Fases 0 a 8 cerradas (`v0.1.0` a `v0.9.0`; la 4 desplegada en Netlify, el resto sin publicar) · Fase 9 ⏳ planificada (`v0.10.0`, ajustes tras el uso real, decidida el 10 nov) · Fase 10 ⏳ (`v1.0.0`, QA final y migración)**

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
10. [Hoja de ruta por fases con sus prompts](#10-hoja-de-ruta-por-fases) (Fase 9 ajustes y Fase 10 QA/v1.0.0 planificadas)
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
| Límites de e2e | Tras el incidente del 2026-11-02 (sección 12): `playwright.config.ts` con **2 workers** en local (CI: los de por defecto + 1 reintento, desde la Fase 9 rama 5), `retries` 0 y `maxFailures` 3 en local, `timeout` 30 s por test, `globalTimeout` 5 min (`npm run e2e`) y 10 min (`npm run e2e:all`, vía `--global-timeout=600000`), reporter `list` + `html` (`open: 'never'`), webServer con `reuseExistingServer: false` y timeout 60 s, chromium con `deviceScaleFactor` 2 (antes 3), nunca `channel: 'chrome'`. **`npm run e2e` = solo Chromium**; nuevo **`npm run e2e:all`** = Chromium + WebKit. Puerto **9323** (informe de Playwright) añadido a `ports:check` y `ports:kill`. CI (Fase 9 rama 5, sustituye a lo anterior): job `build-e2e` construye `dist-e2e` una vez (artefacto) y 4 jobs e2e corren en **paralelo** (`chromium` y `webkit`, shards 1/2 y 2/2, `E2E_PREBUILT=1`) **solo en PR a `main`**; cada job sube su informe si falla. `.claude/settings.json` deniega `npx playwright install` y `npx playwright show-report` (Bash y PowerShell). Reglas nuevas en `.claude/rules.md`, `.claude/agents/blind-tester.md` y `.claude/commands/close-phase.md`: e2e solo con `npm run e2e`, en primer plano, sin flags extra, sin sondeo en segundo plano y sin nada pesado en paralelo; si pasa de 5 min o se cuelga → parar, `ports:kill`, comprobar puertos e informar; nunca reintentar en bucle (una ejecución + una tras un arreglo); nunca instalar navegadores; los e2e cubren flujos de usuario y criterios de aceptación (las combinaciones exhaustivas van a tests unitarios); axe una vez por pantalla y tema; objetivo `npm run e2e` < 2 min | Evitar que la suite sature el PC del usuario |
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
| Formato real de gym_app (leído del **código fuente**, sin datos reales) | Valores reales de `t`: `session`, `set`, `note`, `act`, `bw`, `week` (id `wk_<lunes>`), `tpl` (id `tpl_<id>`), `rec`, `wall`, `excfg` (id `exc_<ej>`, campo `step`), `cfg` (ids `cfg_recovery`, `cfg_exp_brazos`), `mig`. La copia completa es `{ app: 'winter-arc', version: 2, exportedAt, records[] }` sin borrados (puede llevar `srv`); gym_app también aceptaba un array suelto | La tabla de la sección 6 y `docs/migration.md` tenían nombres que no coincidían; **corregidos** en `feature/import-export` (sección 6, `docs/migration.md` §4) |
| Ramas de la fase | `feature/local-db` y después **`feature/import-export`** (antes `feature/legacy-import`): importador de gym_app + importación de JSON propio + exportaciones JSON/CSV | El nombre refleja todo lo que entra en la segunda rama |
| Importación con LWW | Importar (gym_app o copia de Certavi) escribe un registro **solo si es nuevo o estrictamente más reciente** que la copia local; **en empate gana la local**. Todo en **una transacción**; lo escrito entra en la cola de pendientes; `serverSeq` se descarta; el reloj avanza más allá del registro más reciente (`advanceClock`). Si dos registros de gym_app dan el mismo id de Certavi, gana el más reciente (`dedupeNewest`) | Importar nunca pisa algo igual o más nuevo del dispositivo y lo importado se sincroniza como cualquier cambio local |
| Formato CSV | **Siempre formato Excel en español** (BOM, `;`, coma decimal, CRLF, comillas cuando hace falta), sea cual sea el idioma de la app; columnas de gym_app; cabeceras por i18n (es = las de gym_app, en = snake_case en inglés); e1RM vacío en calentamiento y aproximación | Se abre bien en el Excel del usuario y es comparable con los CSV de gym_app |
| Copias de Certavi | Formato `{ app: 'certavi', format: 1, kind: 'full' \| 'session' \| 'week', exportedAt, records }`, **sin tombstones ni `serverSeq`** | Una copia es una foto de los datos vivos; el servidor asigna su propio `serverSeq` |
| Semanas importadas | `WeekPlan.size` siempre **5** (gym_app no lo tenía; el plan congelado se conserva, así que los números no cambian); `total` se descarta | — |
| Actividades importadas | `min: null` → **0 minutos** | `minutes` es obligatorio en Certavi |

### 2.5 Decisiones de la Fase 4 (2026-11-03)

| Tema | Decisión | Motivo |
|---|---|---|
| Ramas de la fase | **Dos ramas** en lugar de `feature/sync`: `feature/sync-server` (contrato en el dominio, servidor, función de Netlify, `netlify.toml`, guía de despliegue; PR #11) y después `feature/sync-client` (motor de sync, transporte, UI) | Fase grande; el servidor se revisa y mergea por separado |
| Servidor reutilizable | El servidor es un manejador `Request → Response` puro (`server/sync/handler.ts`, `createSyncHandler`) con un `SyncStore` intercambiable (memoria o Netlify Blobs); `netlify/functions/sync.ts` es un adaptador fino | Lo comparten la función de Netlify, los tests unitarios y el servidor falso de e2e |
| Código de error nuevo | **`500 internal-error`** añadido al contrato (`docs/api/sync-v1.md`, `ERROR_STATUS`) | Fallos inesperados del servidor con un código del contrato |
| Nombre del almacén de Blobs | Depende del contexto de despliegue: **`certavi`** en producción y **`certavi-branch-deploy`** en el despliegue de la rama `dev`; se recomienda una `CLAVE_SYNC` distinta por contexto | Probar en `dev` nunca toca los datos reales |
| Transporte HTTP genérico | `createHttpTransport` (`src/data/sync/httpTransport.ts`) en lugar de `NetlifyTransport`: habla con cualquier backend que cumpla sync-v1 | El backend sigue siendo sustituible sin tocar el cliente |
| Servidor falso de e2e | `tests/mocks/sync-server.ts` usa el manejador real + almacén en memoria y se conecta con `context.route('**/api/v1/**')` de Playwright: **sin proceso ni puerto** (el 8787 queda reservado pero sin uso) | Sin servidores que dejar encendidos y probando el servidor de verdad |
| UI de sync | Tarjeta **«Sincronización» la primera** en Ajustes (estado, última sync, pendientes, error, clave, «Sincronizar ahora») + subpágina **`/settings/sync`** (registro de intentos y copias del servidor) + indicador en la cabecera | Lo más consultado arriba; el detalle no satura Ajustes |
| Clave de sync | Solo del dispositivo, en `localStorage` (`certavi.syncKey`), ≥ 32 caracteres, sin espacios a los lados; nunca se sincroniza | Es un secreto propio de cada dispositivo |
| Clave nueva | Al cambiar la clave: `since` vuelve a 0 y se encolan **solo los registros con `updatedAt > 0`** (la semilla sin tocar puede quedarse fuera; anotado en `sync-v1.md`) | No subir la semilla que todos los dispositivos ya tienen |
| Restaurar copia del servidor | Las diferencias se convierten en ediciones nuevas encoladas; los registros que no están en la copia se borran (borrado lógico), **salvo los de la semilla, que vuelven a su versión semilla** | Restaurar se sincroniza como cualquier cambio y nunca deja la app sin catálogo ni rutinas |
| Copia del servidor descargada | Se descarga como **copia completa de Certavi importable** (`certavi-server-backup-<fecha>.json`) | Un solo formato de copia para importar |
| Dexie v2 | `db.version(2)` añade la tabla **`syncLog`** (`++id`, últimos 40 intentos); la v1 no se toca; test de migración v1 → v2 | Regla de ADR-0003: versiones nuevas, nunca editar las publicadas |
| Motor del cliente (**ADR-0004**, `docs/adr/0004-client-sync-engine.md`) | Lotes de 300 hasta vaciar la cola, 413 parte el lote a la mitad, un intento a la vez, backoff 4/8/15/30/60 s, 2 s de espera tras crecer la cola, cada 45 s con pendientes, los errores fatales paran hasta cambiar la clave o pulsar «Sincronizar ahora», sin conexión no hay peticiones, envío final con `keepalive` (≤ 55 KB); la respuesta se aplica en una transacción (se desencola solo si `updatedAt` no cambió; el eco no escribe en las tablas de registros) | Paridad con gym_app sin perder datos |
| Estado «Sincronizado» (**2026-11-04**, `fix/e2e-webkit-sync`) | `idle` («Sincronizado») **solo después de un intento que salió bien**. Con clave, el motor arranca en `syncing` («Sincronizando…»); `setKey()` pone `syncing` y lanza `trigger('key')` en un `finally` (un fallo al volver a encolar nunca lo deja atascado en `syncing`). `docs/spec/sync.md` §2.1 y AC-SYNC-03 lo recogen | Antes `setKey()` y el arranque con clave mostraban «Sincronizado» sin haber hablado con el servidor, contra la spec; en WebKit se veía durante segundos (incidente del 2026-11-04, sección 12) |
| E2E sin esperas de tiempo real (**2026-11-04**) | Nada de `waitForTimeout` ni de esperar a que pase un debounce o un backoff: los temporizadores de la app se mueven con `page.clock` (`install()` antes de `goto`, `runFor`/`pauseAt`); el estado se espera con aserciones web-first o `expect.poll`; antes de inyectar un fallo en el servidor falso (`failNext`) se espera a que haya respondido la petición anterior; timeouts coherentes dentro de un mismo paso. Recogido en `.claude/rules.md`, `.claude/agents/blind-tester.md` («Time and waits») y `CLAUDE.md` §9 | WebKit puede tardar segundos más que Chromium en IndexedDB; las esperas fijas hacían frágiles AC-SYNC-06/09 |
| Caché de navegadores en CI (**2026-11-04**) | Job `e2e`: paso que lee la versión de Playwright, `actions/cache@v6` de `~/.cache/ms-playwright` con clave `playwright-<os>-<versión>`; si falla la caché, `playwright install --with-deps chromium webkit`; si acierta, solo `playwright install-deps chromium webkit`. Sube `playwright-report/` y `test-results/` (trazas, `trace: 'on-first-retry'`) si falla. `timeout-minutes` 20 → **12** (superado en la Fase 9 rama 5: 15 en el job e2e, 10 en `build-e2e`). Objetivo: job e2e < 5 min (**sin medir todavía**) | El job e2e del PR de la Fase 4 tardó 14 min 14 s (2–3 min solo instalando navegadores) y sin trazas para diagnosticar |
| `e2e:all` en `/close-phase` (**2026-11-04**) | En la **última rama de cada fase**, el blind-tester ejecuta `npm run e2e:all` (Chromium + WebKit) **una vez** antes del PR `dev → main` (`.claude/commands/close-phase.md`, `.claude/rules.md`, `.claude/agents/blind-tester.md`, `CLAUDE.md` §9). Fuera de eso, `e2e:all` solo si lo pide el usuario | En la Fase 4 WebKit no se ejecutó nunca antes del PR y lo detectó CI |
| Versión del arreglo (**2026-11-04**) | El arreglo entra en **`v0.5.0`**: `CHANGELOG.md` lo apunta en «Fixed» de 0.5.0. **Confirmado**: el usuario creó el tag `v0.5.0` (no `v0.5.1`) tras el PR `dev → main` con CI en verde | `v0.5.0` no se había publicado |

### 2.6 Decisiones de la Fase 5 (2026-11-04)

| Tema | Decisión | Motivo |
|---|---|---|
| Ramas de la fase | **Tres ramas** en lugar de dos (decidido con el usuario): `feature/today` → `feature/active-session` (registro de series y núcleo de la sesión, borradores) → `feature/session-tools` (temporizador de descanso, reordenar/añadir/quitar ejercicios con filtro, editar fecha/horas/rutina, aviso de cambios remotos, exportar JSON de la sesión, deshacer). La última rama ejecuta `e2e:all` antes del PR `dev → main` | — |
| Tarjeta de bloques del día | En Hoy: checklist + métricas 0–10 + nota del día (guarda `BlockLog`). Configurar bloques, gráficas y test semanal de la pared siguen en la **Fase 7** | — |
| Aviso de cambios remotos (rama 3) | Banner «Hay cambios de otro dispositivo»; los datos guardados se refrescan, **los borradores sin guardar nunca se tocan**; se cierra a mano | — |
| Plan del día | `src/domain/rules/dayPlan.ts` (`weekSchedule`, `dayPlan`, `routineDays`): las rutinas conservan su `weekday`; descansos fijos jueves «Descanso activo» (actividades rápidas natación y movilidad) y sábado «Fútbol» (fútbol y natación); el resto de días libres, «Descanso». Semana de 4 → se cae el Upper (viernes descanso); de 3 → Push, Pull, Lower Full (el Lower Full ocupa el miércoles, el primer día que queda libre) | — |
| Semana de senderismo | **Como en gym_app** (elección del usuario): el domingo es «Senderismo/Monte», se cae el Lower A y el Lower B pasa a Lower Full (`weekRoutines` en `src/domain/rules/weekPlan.ts`; `livePlan`/`weekPlanSummary` reciben `hiking`). Semana normal + senderismo = Push, Pull, Lower Full, Upper = **86 series, 4 sesiones**; 4 + senderismo = 63, 3 sesiones; 3 + senderismo sin cambios. Sustituye al comentario anterior del modelo («Lower A pasa al jueves») | Paridad con gym_app |
| Sesiones nuevas | `newSession` (`src/domain/rules/session.ts`): la sesión de hoy empieza ahora, en curso; otra fecha → terminada 18:00–19:15; la sesión libre no tiene ejercicios; semana de descarga → copia reducida. Empezar una rutina que ya tiene sesión esa fecha abre la existente (con toast). Sin fechas futuras. `startSession`/`readSession` en `src/data/sessions.ts` (una transacción) | — |
| Ids creados en el dispositivo | `newId(prefix)` en `src/data/ids.ts`: `ses_`, `act_`, `set_` + tiempo en base36 + 10 caracteres aleatorios | — |
| Recordatorio de descarga | Tras **6** semanas seguidas sin descarga (`needsDeloadReminder`, `src/domain/rules/today.ts`) | — |
| Peso corporal | Válido entre **20 y 300 kg** | — |
| Orden | Actividades en orden de guardado (`updatedAt`); las sesiones empatadas se ordenan por `updatedAt` | Con el reloj fijo (e2e) el orden era aleatorio (fallo de AC-TODAY-12 en WebKit) |
| Timeouts de tests (aceptado por el usuario) | `src/test/setup.ts`: RTL `asyncUtilTimeout` **5 s**; `vite.config.ts`: `testTimeout` **15 s** en el proyecto `ui` | Con `test:coverage` (v8 + todos los workers ocupados) una escritura → consulta en vivo → repintado pasaba de 1 s y hacía fallar al azar tests viejos y nuevos (SyncCard, ImportExport, TodayPage) |
| e2e en CI (`chore/ci-e2e-shards`) | Etiqueta **`@all-engines`**: el proyecto `webkit` solo ejecuta los tests etiquetados (sync, data, import-export, today, smoke y AC-NAV-03); navegación, tema, idioma y componentes, solo Chromium. El job `e2e` de CI es una **matriz** `fail-fast: false` con 3 jobs: `chromium`, `webkit 1/2`, `webkit 2/2` (navegador instalado y cacheado por job, informe propio, `timeout-minutes` 15), **en serie** (`max-parallel: 1`); **superado** en la Fase 9 rama 5 (4 jobs en paralelo, ver Fase 9). Validación con un PR borrador a `main`. Arreglo tras el primer PR de prueba: `webkit 2/2` fallaba por tiempo (30 s) en AC-SYNC-13 (dos dispositivos, no era un fallo de la app) → `test.slow` en WebKit también en AC-SYNC-12 y 13, como AC-SYNC-09. Segundo arreglo (2026-11-05, segundo PR de prueba): chromium y `webkit 1/2` en verde, pero `webkit 2/2` volvió a agotar los 30 s en AC-SYNC-14 (English) y AC-TODAY-10/11, a 1–4 pasos del final, y otros tests rondaban el límite (AC-TODAY-12 29,3 s) → **`timeout` de 60 s en el proyecto `webkit`** (`WEBKIT_TIMEOUT` en `playwright.config.ts`; Chromium sigue en 30 s) y se quitan los tres `test.slow` de `sync.spec.ts`. Tercer arreglo (2026-11-05, `npm run e2e:all` local en `feature/active-session`: fallaron dos tests, solo en WebKit y por una aserción de 5 s, no por el tiempo del test): **`expect.timeout` de 15 s en el proyecto `webkit`** (`WEBKIT_EXPECT_TIMEOUT`; Chromium sigue en 5 s) porque la primera lectura de IndexedDB con dos pestañas dejaba la tarjeta «Datos» en «Cargando…» (`data.spec.ts` «two tabs»), y el foco al título tras navegar pasa a **`useLayoutEffect`** (`src/app/Layout.tsx`) porque, con un WebKit lento, el efecto llegaba en medio del `fill()` de la clave, le quitaba el foco al campo y «Guardar clave» enviaba vacío (AC-SYNC-14 English); `saveKey()` comprueba ahora `toHaveValue`. Con eso AC-SYNC-14 llegó al registro de intentos y falló por esperar **exactamente 4** intentos (había 5): al guardar la clave el motor vuelve a encolar todo y, si el cambio de la cola llega con el primer intento ya en marcha (IndexedDB lento en WebKit), lanza un intento más justo después (`rerun` de `onQueueCount`, `src/data/sync/engine.ts`); no es un fallo de la app, así que el test pide **al menos 4**, una sola «Clave incorrecta» y los dos últimos en orden. `ci.yml` no cambia: la matriz usa `--project=webkit`, que ya lleva este ajuste. Contenedor oficial de Playwright valorado y descartado por ahora: solo ahorra la instalación del navegador, no acelera WebKit | En CI (2 vCPU, 1 worker) `e2e:all` se estimaba ≥ 14 min, por encima del tope de 10 min |
| Filas de una serie (rama 2, 2026-11-05) | Cada ejercicio de la sesión es una lista de filas, como en Hevy: `WorkoutSession.items[].scheme` incluye también filas de calentamiento, dropset y extra; `SetEntry.slot` es la posición de su fila y `kind` su tipo, que el usuario cambia (Calentamiento / Efectiva / Dropset) sin que la fila se mueva. Tipo nuevo `dropset`: serie efectiva y volumen, no cuenta para 1RM ni récords. «+ Serie extra» añade una fila; quitar una fila (no la última) se hace deslizando a la izquierda, con botón «Quitar» alcanzable por teclado. Las sesiones de gym_app (`w`/`p`/`x`) se convierten con `normalizeLegacySessions` tras importar y al arrancar. Lo escrito sin ✓ se guarda en localStorage (`certavi.draft.<id>`, solo en el dispositivo) y sobrevive a recargas. «Eliminar sesión» entra en esta rama (el «Deshacer» va en la 3) | El usuario eligió que la fila no se mueva al cambiar su tipo; ver ADR-0003 |
| Temporizador de descanso (rama 3, 2026-11-06) | Descanso 180 s (fila básica), 120 s (aislamiento), 60 s (tras calentamiento) y +30 s tras una serie top; ajuste ±15 s; tiempos de 15 a 900 s en Ajustes (sincronizados); sonido y vibración solo en el dispositivo (`certavi.restSound`, `certavi.restVibration`); se cierra con ✕ o al terminar la sesión | — |

### 2.7 Decisiones de configuración de Claude (2026-11-04)

| Tema | Decisión | Motivo |
|---|---|---|
| Modelos | Principal `opusplan` (Opus planifica, Sonnet ejecuta); `blind-tester` y revisores `sonnet`; `context-keeper` `haiku` | Menos coste por sesión |
| Lectura vetada | `Read` denegado en `package-lock.json`, `playwright-report/`, `coverage/`, `dist/` (no `test-results/`: su `error-context.md` es útil) | Archivos grandes sin valor para el agente |
| Cierre en dos niveles | `/close-phase` por rama: checks, e2e solo de los specs de la rama, estado de ≤10 líneas en `context.md` por el agente principal, sin context-keeper. `/close-phase final`: además `e2e:all`, revisores, context-keeper y plan de release | El cierre completo en cada rama era caro |
| e2e | `npm run e2e -- <specs>` permitido; ningún otro flag. blind-tester: máx. 8 tests por pasada y, ante un fallo, solo `error-context.md` | Menos ejecución y lectura |
| Reporters | Vitest `dot` + cobertura `text-summary`; Playwright `dot` + `html` en local (CI sin cambios en Playwright; el `test:coverage` de CI sí usa `dot`) | Menos salida; umbrales del 90 % intactos |
| Revisores | `code-reviewer` y `security-reviewer` de solo lectura, salida ≤30 líneas; el de seguridad se lanza si el diff toca `server/`, `src/data/sync/`, `package.json` o `netlify.toml` | Revisión barata y acotada |
| Hooks | `PostToolUse` Edit\|Write formatea con Prettier; `Stop` avisa al usuario de puertos ocupados (salvo 5173), siempre exit 0 | Menos `format:check` fallidos y procesos olvidados |
| Memoria | `context-keeper`: ≤10 líneas, sin recuentos ni logs; el log va a `docs/history.md` | Mantener `context.md` pequeño |

### 2.8 Decisiones de la Fase 6 (2026-11-06)

| Tema | Decisión | Motivo |
|---|---|---|
| Catálogo (rama 1, `feature/exercise-catalog`) | Dentro de Rutinas (`/exercises`, selector «Rutinas \| Ejercicios»; la barra inferior no cambia). Filtros combinables compartidos con «Añadir ejercicio» (`ExerciseFilters` + `useExerciseFilter`). Propios con id `exe_`: se archivan, nunca se borran; de la semilla solo se edita el incremento; un ejercicio de una rutina no se archiva; nombre repetido se compara sin mayúsculas ni acentos; incremento 0,25–50 kg. Gráfica de evolución → **Fase 7** | Paridad y sin pérdida de datos |
| Editor de rutinas (rama 2, `feature/routine-editor`) | Solo se editan las seis rutinas semilla; nombre y día no (el plan del día depende de ellos); crear/borrar rutinas → backlog v2. Cambios solo en sesiones nuevas (las sesiones conservan su copia del plan). Nada se guarda hasta «Guardar»: validación (sin ejercicios, duplicados, sin series, repeticiones obligatorias salvo aproximación, RIR válido), aviso al salir con cambios, quitar con «Deshacer», máx. 20 series por ejercicio. «Restaurar original» escribe la semilla con `updatedAt` actual (gana en LWW, se sincroniza, `ensureSeed` no la pisa) | Sin sorpresas en sesiones en curso; la restauración llega a otros dispositivos |

### 2.9 Decisiones de la Fase 8 (2026-11-08)

| Tema | Decisión | Motivo |
|---|---|---|
| Ramas | Dos: `feature/pwa` (PR #35) y `chore/polish`, en lugar de una sola `chore/pwa-polish` | Revisar la PWA aparte de la limpieza |
| Carga | Todas las pantallas salvo Hoy y la sesión son `lazy`; los tests de pantallas precargan las rutas | Principal de 890 a 372 kB; Hoy y la sesión son la ruta diaria |
| Service worker | `registerType: 'prompt'`, solo precache; `/api/**` y `/.netlify/**` nunca en caché (ADR-0005) | Datos siempre del servidor; el usuario elige cuándo actualizar |
| Herramientas | `/dev/ui` solo en desarrollo, Vitest y build e2e; knip en CI | Galería fuera de producción; sin código muerto |
| Lighthouse | Escritorio en `dev`: 100 / 100 / 96 / 54 (SEO bajo a propósito: `noindex`); móvil pendiente | Insignias de la Fase 10; la categoría PWA ya no existe |
| Instalabilidad | Comprobada a mano en el iPhone (standalone, cinco pestañas) y en el panel Aplicación | Lighthouse ya no la mide |
| Paquetes | vite-plugin-pwa 2.0.0, workbox-window 7.4.1, @vite-pwa/assets-generator 2.0.0, knip 6.44.2 | Versiones fijadas en `package.json` |

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
│  ├─ BASE_VERSION           # versión de la base de configuración de la que parte
│  ├─ rules/                 # restricciones de trabajo (git, dependencies, e2e, i18n, sync…; unas con `paths:`)
│  ├─ agents/
│  │  ├─ context-keeper.md
│  │  └─ blind-tester.md
│  └─ skills/
│     ├─ start-phase/SKILL.md   # /start-phase N
│     └─ close-phase/SKILL.md   # /close-phase: propone ramas, commits, versión y tag
├─ .github/workflows/ci.yml
├─ docs/
│  ├─ spec/                  # especificación funcional (la única que lee el tester)
│  ├─ api/sync-v1.md         # contrato del backend
│  ├─ adr/                   # decisiones de arquitectura (ADR-0001…0004)
│  ├─ design/                # paleta, tipografía, tokens elegidos
│  ├─ deploy-netlify.md      # guía de despliegue en Netlify (Fase 4)
│  └─ migration.md           # mapeo desde gym_app
├─ netlify/functions/sync.ts # adaptador fino sobre server/sync (Fase 4)
├─ server/sync/              # servidor sync v1: handler Request → Response, SyncStore (memoria / Netlify Blobs), auth, copias, test de contrato (Fase 4)
├─ public/                   # iconos, robots.txt, manifest (generado)
├─ scripts/ports-check.mjs   # qué proceso ocupa 5173/4173/8888/8787/9323
├─ src/
│  ├─ domain/                # TS puro: model/ (zod), rules/, seed/ (catálogo, rutinas, bloques), sync/ (contrato y fusión), testing/, dates.ts. Sin React ni Dexie
│  ├─ data/                  # Dexie, repositorios, sync/ (motor, transporte HTTP, cola, commit, restaurar, clave, registro de intentos), importador
│  ├─ features/              # today, session, calendar, routines, exercises, progress, blocks, settings
│  ├─ ui/                    # componentes comunes: Button, Dialog, Chip, NumberField, Sheet, Toast…
│  ├─ i18n/                  # es.json, en.json
│  ├─ theme/                 # tokens.css, temas, fuentes
│  └─ app/                   # rutas, layout, providers, registro del service worker
├─ tests/
│  ├─ e2e/                   # Playwright (lo escribe el blind-tester)
│  ├─ fixtures/              # datos sintéticos (gym-app-sample.json, not-a-backup.txt; Fase 3)
│  └─ mocks/sync-server.ts   # servidor falso de /api/v1/** para e2e: handler real + memoria vía context.route de Playwright, sin proceso ni puerto
├─ CLAUDE.md
├─ context.md                # este documento
├─ CHANGELOG.md
├─ README.md
├─ netlify.toml              # build, redirección SPA, cabeceras de seguridad/CSP y de caché (Fase 4)
├─ tsconfig.json             # solo referencias: tsconfig.app / .node / .e2e / .server.json
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
- El cliente habla con una interfaz `SyncTransport` (`push/pull`, `listBackups`, `getBackup`). Implementada en la Fase 4 como **`createHttpTransport`** (`src/data/sync/httpTransport.ts`), genérica para cualquier backend que cumpla sync-v1 (Netlify hoy; Java/Spring o Python/FastAPI mañana sin cambios). Un backend distinto (p. ej. `FirebaseTransport`) solo necesitaría otra implementación de la interfaz (2.5).
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
- **Semana de senderismo** (Fase 5, 2.6, como en gym_app): el domingo es senderismo, se cae el Lower A y el Lower B pasa a Lower Full (semana normal 86 series en 4 sesiones; de 4 → 63 en 3; de 3 sin cambios).

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
- **Ejercicios:** ficha con 1RM, peso máximo, mejor volumen, mejores marcas por repeticiones, historial e incremento propio; la evolución con gráfica pasa a la Fase 7.
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
2. Certavi tiene en Ajustes → Datos → **«Importar desde la app anterior»** (implementado en la Fase 3, `src/data/legacy/gymApp.ts` + `src/data/importRecords.ts`): lee ese JSON (`{ app: 'winter-arc', records }` o un array suelto), valida cada registro con esquemas zod tolerantes de gym_app, lo transforma, lo valida con `parseRecord` y muestra una vista previa antes de guardar (filas por tipo + sin cambios / ignorados / no válidos). Guarda en una transacción con «gana el más reciente» (2.4).

**Mapeo de registros** (corregido el 2026-11-03 con los valores reales de `t` leídos del código fuente de gym_app; resumen de `docs/migration.md` §4)

| `t` (id) en gym_app | Certavi | Notas |
|---|---|---|
| `session` (`ses_…`) | `WorkoutSession` (mismo id) | `tpl` → `routineId` (`libre` → `null`); `start`/`end` → `startedAt`/`endedAt`; `ready` → `readiness`; las sesiones sin `items` reciben los de la rutina semilla |
| `set` (`st_<sid>_<ej>_<slot>`) | `SetEntry` (mismo id) | `aprox` → `approach`, `work` → `straight`; slots `p`/`w`/`x` → número; banda vacía → ninguna; `at` → `completedAt` |
| `note` (`nt_<sid>_<ej>`) | `ExerciseNote` (`note_<sid>_<ej>`) | Id rehecho con la regla de Certavi, tras el alias |
| `act` | `Activity` (mismo id) | `futbol`/`natacion`/`senderismo`/`movilidad`/`bici`/`otro` → `football`/`swimming`/`hiking`/`mobility`/`cycling`/`other`; `min: null` → 0 |
| `bw` (`bw_<lunes>`) | `BodyWeight` | — |
| `week` (`wk_<lunes>`) | `WeekPlan` (`week_<lunes>`) | `hiking`, `deload`, `closedAt`; `plan` (claves de grupo en español) → `plannedSetsByGroup`; `size` siempre 5; `total` se descarta |
| `tpl` (`tpl_<id>`) | `Routine` (`<id>`) | El override pasa a ser la rutina semilla con los `items` de gym_app; plantillas desconocidas se ignoran |
| `excfg` (`exc_<ej>`) | `Exercise.increment` | `step` en el ejercicio semilla; ejercicios desconocidos se ignoran |
| `rec` (`rec_<fecha>`) | `BlockLog` del bloque de rehabilitación del tobillo | Claves `mob`/`ecc` → ids de elemento; `stairs`/`maxPain`/`pogos` → métricas `stairs`/`max-pain`/`pogos` (`null` = sin registrar); `note` |
| `wall` (`wall_<lunes>`) | `WeeklyMetric` `wall-test` (izquierda, derecha) | La fecha de medición se descarta |
| `cfg` (`cfg_recovery`) | Bloque de rehabilitación del tobillo | `active`, `startDate`, `reviewDate`; `footballOk` se descarta |
| `cfg` (`cfg_exp_brazos`), `mig` (`mig_*`) | Se ignoran | — |
| `del: true`, `t` desconocido | Se ignoran | Mal formados → «no válidos» |
| Ejercicio `abdomen` | → `crunch-maquina` | En series, notas, items de sesión, rutinas e incrementos |

Un RIR objetivo que Certavi no sabe leer pasa a `''`. Si dos registros de gym_app dan el mismo id de Certavi, gana el más reciente.

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
| `v0.10.0` | Fase 9: ajustes tras el uso real (planificada) |
| **`v1.0.0`** | Fase 10: QA completo, migración real y despliegue definitivo |

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

[Enlace](docs/history.md#seccion8)

---

## 9. Preparación antes de la Fase 0

[Enlace](docs/history.md#seccion9)

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

**Estado (2026-11-02)**: **cerrada**. 

**Log (History)**: [Fase 0](docs/history.md#fase0)

---

### Fase 1 · Diseño, tema, i18n y navegación → `v0.2.0` ✅

**Ramas**: `feature/design-system` y `feature/app-shell`

**Estado (2026-11-03)**: **cerrada**. 

**Log (History)**: [Fase 1](docs/history.md#fase1)

---

### Fase 2 · Dominio y catálogo → `v0.3.0` ✅

**Rama**: `feature/domain-model`

**Estado (2026-11-03)**: **cerrada**.

**Log (History)**: [Fase 2](docs/history.md#fase2)

---

### Fase 3 · Datos locales, importador y exportaciones → `v0.4.0` ✅

**Ramas**: `feature/local-db` y `feature/import-export`

**Estado (2026-11-03)**: **cerrada**. 

**Log (History)**: [Fase 3](docs/history.md#fase3)

---

### Fase 4 · Sincronización y backend → `v0.5.0` ✅

**Ramas**: `feature/sync-server` y `feature/sync-client`, más el arreglo `fix/e2e-webkit-sync`

**Estado (2026-11-04)**: **cerrada**. 

**Log (History)**: [Fase 4](docs/history.md#fase4)

---

### Fase 5 · Hoy y sesión activa → `v0.6.0` ✅

**Ramas** `feature/today`, `feature/active-session` y `feature/session-tools`, más el arreglo de `chore/ci-e2e-shards`

**Estado (2026-11-06)**: **cerrada**

**Log (History)**: [Fase 5](docs/history.md#fase5)

---

### Fase 6 · Catálogo, ejercicios propios y rutinas → `v0.7.0` ✅

**Ramas**: `feature/exercise-catalog` y `feature/routine-editor`, más el añadido de `feature/add-changes-phases`

**Estado (2026-11-06)**: **cerrada** 

**Log (History)**: [Fase 6](docs/history.md#fase6)

---

### Fase 7 · Calendario, progreso y bloques → `v0.8.0` ✅ implementada (release pendiente)

**Ramas**: `feature/calendar`, `feature/progress`, `feature/training-stats` y `feature/optional-blocks`

**Estado (2026-11-07)**: **cerrada** 

**Log (History)**: [Fase 7](docs/history.md#fase7)

---

### Fase 8 · Pulido PWA, accesibilidad y rendimiento → `v0.9.0` ✅

**Ramas**: `feature/pwa` y `chore/polish`.

**Estado (2026-11-08)**: **cerrada** 

**Log (History)**: [Fase 8](docs/history.md#fase8)

---

### Fase 9 · Ajustes tras el uso real → `v0.10.0` ⏳

**Ramas**: `docs/phase-9-polish`, `chore/dependabot`, `fix/ui-polish`, `feature/routine-week-edits`, `feature/machine-setup`, `chore/e2e-speed` y `fix/gym-feedback`.

**Estado (2026-11-11)**: **cerrada** 

**Log (History)**: [Fase 9](docs/history.md#fase9)

---

### Fase 10 · QA final, migración real y v1.0.0 ⏳

**Rama**: `release/1.0.0`, o directamente un PR de `dev` a `main`.

**Pasos**:
1. El blind-tester hace una regresión completa, en español y en inglés, claro y oscuro, sin conexión. Incluye el logo, las transiciones, la edición de semanas cerradas, las tarjetas de rutina, los chips del editor y los ajustes de la máquina (todo de la Fase 9).
2. Tú usas Certavi en paralelo con gym_app durante 1 semana.
3. Exportas por última vez desde gym_app, importas en Certavi y compruebas los recuentos.
4. **Quitar el rastro de gym_app** (añadido el 2026-11-06), solo **después** de la migración real del paso 3, porque hasta entonces hace falta el importador: eliminar «Importar desde la app anterior» (`ImportExport.tsx`, claves i18n `importLegacy`/`notLegacy`…), `src/data/legacy/`, `src/domain/seed/legacyAliases.ts` (los alias solo sirven para datos de gym_app), `docs/migration.md`, la sección 6 de este archivo y las menciones en README, spec y ADR. Decidir si `context.md` y `docs/history.md` (que cuentan el origen del proyecto) se quedan en el repo público o se resumen. Motivo: la intención es que lo usen tú y gente de tu entorno, no que sea «la v2 de otra app». Importar datos de otras apps (Hevy, Strong…) queda en el backlog v2. Requisito previo (añadido el 2026-11-10): la Fase 9 (`chore/e2e-speed`) hace que los e2e carguen sus datos con un fixture sintético de Certavi y no con el importador, para que borrarlo aquí no rompa la suite.
5. Release `v1.0.0`, tag y despliegue a producción.
6. Archivas `gym_app`.
7. **Documentación de portfolio** (añadido el 2026-11-06):
   - README en **español** (`README.es.md`) y en inglés, con enlace cruzado entre ambos.
   - **Banner** arriba en los dos: nombre del proyecto y un visual (un teléfono con Hoy o una gráfica de progreso). Claude puede generar un SVG; si prefieres hacerlo tú, la plantilla es 1280 × 320 px, texto dentro de los 960 px centrales, logo a la izquierda, «Certavi» en Archivo Bold, subtítulo, fondo `--bg` y acento `#1d4ed8`, versión clara y oscura (`banner-light` / `banner-dark` en `docs/assets/`, con `<picture>` y `prefers-color-scheme`).
   - **Capturas** reales (Hoy, sesión activa, progreso, ficha de ejercicio; claro y oscuro) que tú pasas.
   - **Insignias**: estado de CI (GitHub Actions; solo se ve bien con el repo público), cobertura (Codecov o insignia estática de shields.io actualizada en cada release) y notas de Lighthouse de la Fase 8 (rendimiento, accesibilidad, buenas prácticas; la categoría PWA ya no existe).
8. **¿Puede usarlo otra persona?** (añadido el 2026-11-06) Dejar la respuesta en el README: sin sync, sí, todo funciona en el dispositivo; con sync, no tal cual, porque el servidor guarda **un solo conjunto de datos** tras una sola `CLAVE_SYNC` (dos personas con la misma clave mezclarían datos), así que cada persona necesita su propio despliegue en Netlify (guía en `docs/deploy-netlify.md`). La semilla es la tuya (rutinas, catálogo y bloque de rehabilitación del tobillo activo en `src/domain/seed/blocks.ts`): decidir si se deja como «plantilla de ejemplo», se desactiva el bloque por defecto, o ambas. Lo que falta para multiusuario está en el backlog v2.
9. **Antes de hacer público el repo** (añadido el 2026-11-06; haces público cuando quieras y activas la protección de ramas):
   - **Escaneo de secretos** con `gitleaks` sobre **todo el historial** (`gitleaks git`), no solo el estado actual, por si hubo una `CLAVE_SYNC`, un token o un export real. Buscar también a mano exports reales de gym_app (`"app": "winter-arc"`) y datos personales en los documentos (`context.md`, `docs/history.md`, specs). Si algo apareció, rotar la clave primero y después reescribir el historial; reescribir ramas lo haces tú.
   - **Cambiar `LICENSE` a MIT** en ese momento (decisión 2.1) y revisar `package.json` (`license`, `private`).
   - Revisar `.gitignore`, variables de entorno y `netlify.toml` (cabeceras, CSP).

**Prompt**:

```text
Lee context.md. FASE 10: preparación de la v1.0.0. Lanza al blind-tester para una regresión completa
(es/en, claro/oscuro, offline, 390x844). Prepara una checklist de migración real para que la ejecute yo
(exportar de gym_app, importar, verificar recuentos por tipo de registro). Después, quita el rastro de gym_app
(importador, alias, migración) y deja README en español e inglés con banner, capturas reales que yo te pase e
insignias (CI, cobertura, Lighthouse), más la evaluación de si otra persona puede usarlo. Prepara el escaneo
de secretos con gitleaks sobre todo el historial y el cambio de licencia a MIT. Dame el plan de release a main
con versión y tag.
```

---

## 11. Backlog v2

- **Fotos de las máquinas**: hechas con el móvil, comprimidas en el cliente y guardadas en Netlify Blobs, con miniatura en la ficha y en la sesión. (Añadido el 2026-11-10) Se mostrarían junto a los «Ajustes de la máquina» de la Fase 9 (`feature/machine-setup`).
- **Reordenar ejercicios arrastrando** en el editor de rutinas (añadido el 2026-11-10), reutilizando la fila de chips numerados de la Fase 9 (`feature/routine-week-edits`).
- **Renovate en lugar de Dependabot** (añadido el 2026-11-10): si los PR agrupados de Dependabot de la Fase 9 (`chore/dependabot`) no bastan, valorar Renovate con automerge de parches con CI en verde.
- **Backend serio**: Postgres (Neon o Supabase) o un servicio en Java/Spring o Python/FastAPI que cumpla `sync-v1`. Solo si aparece una necesidad real (consultas en servidor, varios usuarios…).
- **Más funciones**:
  - plantillas de ciclos con fechas de inicio y fin;
  - resumen automático de cierre de ciclo exportable en `.md`;
  - comparación entre ciclos;
  - superseries.
- **App nativa**: con Capacitor, si algún día hay Mac y cuenta de desarrollador.
- **Importar desde otras apps (Hevy, Strong…)** (añadido el 2026-11-06): importar su CSV con un paso para asignar cada ejercicio al catálogo de Certavi (o crearlo como ejercicio propio), porque los ids no coinciden. Un menú selector de «app de origen» sustituiría al importador de gym_app, que sale en la Fase 10. Enlazar las apps por API solo si existe una API oficial.
- **Uso por otras personas**: una clave de sync por persona con su propio espacio de datos en el servidor (cambia el contrato `sync-v1`, lleva ADR y revisión de seguridad); primera vez guiada (empezar vacío o con plantillas) y bloques personales desactivados por defecto. Ver Fase 10.
- **Peso levantado por rutina**, si no cabe en la Fase 7.
- **Tests de WebKit: medir en CI real tras la rama 6** (añadido el 2026-11-11): los tiempos locales con 1 worker no son los de CI; con el medidor por test de la rama 6 y el primer PR a `main`, decidir si hace falta recortar más `@all-engines`.
- **Modo básico** (añadido el 2026-11-11, idea del usuario): opción que reduce cada pantalla a lo esencial (menos secciones, tarjetas y datos visibles) para entrenar con el mínimo de distracción. Se construiría sobre el interruptor «Sin color (modo 0 dopamina)» de la Fase 9 (rama 6, `fix/gym-feedback`): mismo sitio en Ajustes → Apariencia y mismo tipo de ajuste (de dispositivo, no sincronizado). Por definir: qué se considera «lo esencial» en Hoy, sesión, Progreso, Calendario y Rutinas. Fuera del alcance de la Fase 9.

---

## 12. Registro de progreso

[Tabla Registro](docs/history.md#seccion12)

**Estado de fases**: 0 ✅ (`v0.1.0`) · 1 ✅ (`v0.2.0`) · 2 ✅ (`v0.3.0`) · 3 ✅ (`v0.4.0`) · 4 ✅ (`v0.5.0`, desplegada en Netlify) · 5 ✅ (`v0.6.0`, sin publicar) · 6 ✅ (`v0.7.0`, sin publicar) · 7 ✅ (`v0.8.0`, sin publicar) · 8 ✅ (`v0.9.0`, sin publicar) · 9 ⏳ (`v0.10.0`, en curso: ramas 5 y 6 🚧) · 10 ⏳ (`v1.0.0`)

**Preguntas abiertas**:
- Qué estiramientos van en el bloque «Estiramientos» (antes de la Fase 7).
- (2026-11-04) ¿Es IndexedDB tan lento en el iPhone real (Safari) como en WebKit de escritorio (segundos por importación o primera lectura)? Medir antes de optimizar (Fase 5, «Revisar al empezar»). Sin medir; ya se puede, porque la app está desplegada.
- ~~(2026-11-04) ¿Hace falta `test.slow()` en WebKit en `tests/e2e/sync.spec.ts`?~~ Resuelto el 2026-11-05: sustituido por el `timeout` de 60 s del proyecto `webkit` (2.6).
- (2026-11-04) ¿Baja el job e2e de CI de 5 min con la caché de navegadores? Sin medir (el PR `dev → main` de la Fase 4 pasó en verde, pero no consta la duración). Con la suite de `feature/today` (166 tests en `e2e:all`) se estima ≥ 14 min con 1 worker: ver `chore/ci-e2e-shards` en la Fase 5. **(2026-11-10)** Rama 5 pasa a 4 jobs en paralelo con `build-e2e`: sin medir en CI real.
- (2026-11-10) Tiempo real del e2e de CI tras la rama 5 (objetivo ≤ 10 min). `reportSlowTests` (Playwright lo aplica por archivo y el reporter `dot` no imprimió tiempos): medir en el primer PR a `main`. **(2026-11-11)** La rama 6 (idea 15) añade el medidor por test (reporter JSON, `npm run e2e:timings`, artefacto por job). La medición local con 1 worker ya está hecha (ver rama 6); los tiempos reales de CI faltan hasta el primer PR a `main`.
- (2026-11-06) Medir en el iPhone real el sonido del temporizador con la pantalla bloqueada y el flujo sin conexión de la sesión (Fase 5, pendiente manual).

**Pendiente para fases futuras**:
- Fase 7: regla del gemelo durante la rehabilitación (60 kg en la semana 1, +5 kg/semana sin dolor al día siguiente hasta 80 kg, y solo si bajar escaleras no duele), con cambios aditivos en el modelo de progresión (ver la Fase 7).
- Fase 7: revisión del ciclo (`sixWeekReview` de gym_app) en las pantallas de progreso.
- Fase 7 (añadido el 2026-11-06): racha semanal; peso levantado, ejercicios y series por semana / mes con selector; peso levantado por rutina (`feature/training-stats`); escala 0-10 en una fila en móvil (`feature/optional-blocks`).
- Fase 10 (añadido el 2026-11-06): quitar el rastro de gym_app tras la migración; README es/en con banner, capturas e insignias; evaluación de uso por otras personas; gitleaks sobre el historial y licencia MIT antes de hacerlo público.
- ~~Fase 3 (`feature/import-export`): corregir la tabla de la sección 6 y `docs/migration.md` con los nombres reales de gym_app (2.4).~~ Hecho el 2026-11-03.
- ~~Fase 5: UI para exportar el JSON de una sesión~~ Hecho el 2026-11-06 (`v0.6.0`). Fase 7: UI para exportar el JSON de una semana (`exportWeek`).
- Sugerencia (no hecha, 2026-11-03) para la Fase 8: con un `Dialog` abierto, la página de fondo sigue en el árbol de accesibilidad (solo `aria-modal`); valorar `inert` en el fondo (afecta al `Dialog` compartido).
- Sugerencia (no hecha, 2026-11-03) para las Fases 5 y 7: resúmenes legibles dentro de los JSON de sesión y de semana.
- Sugerencia (no hecha, 2026-11-03) para la Fase 7: el CSV de recuperación de gym_app.
- Nota (2026-11-03): commitlint no tiene el ámbito `e2e`; los commits de tests e2e usan `test:` sin ámbito.
- ~~Fase 4 (usuario, tras el tag `v0.5.0`): desplegar en Netlify siguiendo `docs/deploy-netlify.md`.~~ Hecho el 2026-11-04.
- **`chore/ci-e2e-shards`** (2026-11-04, después de mergear `feature/today` en `dev`, antes de `feature/active-session`): el e2e de CI no cabe (≥ 14 min estimados con 1 worker frente a 10 min de `--global-timeout` y 12 de `timeout-minutes`). Etiqueta `@all-engines` + `grep` en el proyecto `webkit`, job e2e en matriz (chromium, webkit) con `fail-fast: false`, `--shard` si WebKit pasa de ~8 min, y documentación. Detalle en la Fase 5 («Pendiente: e2e de CI»).
- ~~Fase 5 (`feature/session-tools`): UI para exportar el JSON de la sesión y aviso de cambios remotos (2.6).~~ Hecho el 2026-11-06.
- Sugerencia (no hecha, 2026-11-04): añadir `TextField`/`TextArea`, `Checkbox`, `ScalePicker` y `Notice` a `/dev/ui`.
- ~~Sugerencia (2026-11-03) para la Fase 5: el «aviso de cambios remotos» de la sesión activa puede apoyarse en el motor de sync.~~ Decidido el 2026-11-04 (2.6); se implementa en `feature/session-tools`.
- Sugerencia (no hecha, 2026-11-04) para la Fase 5: medir IndexedDB en el iPhone y, si es lento, contar con índices/`getAll` en lugar de cursores con `filter()` (`countLiveRecords`, `queueEverything`). Detalle en «Revisar al empezar» de la Fase 5.
- Sugerencia (no hecha, 2026-11-04) para CI: usar el contenedor `mcr.microsoft.com/playwright:v1.64.1-noble` en el job e2e (sin instalar navegadores ni dependencias). Valorado el 2026-11-05: no acelera WebKit (no arregla los timeouts); solo recorta el tiempo de instalación y obliga a subir la etiqueta con cada versión de `@playwright/test`.
- Sugerencia (no hecha, 2026-11-04): AC-SYNC-03 en `tests/e2e/sync.spec.ts` depende de que sus comprobaciones terminen dentro de los 2 s que el servidor falso retiene la respuesta (`setDelay(2000)`); puede volverse frágil en una máquina lenta.
- Sugerencia (no hecha, 2026-11-03): si vuelve a aparecer una ejecución de `test:coverage` con 57/58 archivos y sin fallo visible, investigar qué archivo no termina (solo pasó una vez en la Fase 4; no reproducido). Detalle en «Revisar al empezar» de la Fase 5.