# Certavi · contexto del proyecto

> Estado actual y decisiones vigentes de **Certavi**, la reescritura de la app de registro de gimnasio `gym_app`. Es la **fuente de verdad de qué está hecho y qué viene**; cómo está construido el proyecto está en `CLAUDE.md`. Lo cerrado y lo superado vive en `docs/history.md`; las ideas y los pendientes, solo en `docs/backlog.md`. Lo mantiene al día el agente de contexto.
>
> Última actualización: 14 nov 2026 · Estado: **Fases 0 a 10 cerradas (`v0.1.0` a `v0.10.1`; Fase 10 con `v0.11.0` pendiente de release; todo lo fusionado en `main` se despliega en Netlify) · Siguiente: Fase 11 (`v0.12.0`)**

---

## Índice

1. [Qué es Certavi y por qué se rehace](#1-qué-es-certavi-y-por-qué-se-rehace)
2. [Decisiones vigentes](#2-decisiones-vigentes)
3. [Arquitectura](#3-arquitectura) · 5. [Funcionalidades](#5-funcionalidades) · 6. [Migración](#6-migración-desde-la-app-actual) · 7. [Flujo de trabajo](#7-flujo-de-trabajo) · 8-9 (antiguos; ver `docs/history.md`)
4. [Modelo de dominio](#4-modelo-de-dominio)
10. [Hoja de ruta por fases](#10-hoja-de-ruta-por-fases) (estado de las fases 0 a 13 y prompts de las abiertas)
11. [Backlog](#11-backlog) · 12. [Registro de progreso](#12-registro-de-progreso)

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

**Lo que NO es (por ahora)**: una app nativa de la App Store (sin Mac ni cuenta de pago no es viable) ni una red social. El **multiusuario y las tiendas (Android primero, iOS después) son la v2** (`docs/backlog.md`, sección 4).

---
## 2. Decisiones vigentes

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
| Agentes | Claude Code (VS Code) orquesta cuatro subagentes del plugin `armando-base`: **context-keeper**, **qa-tester**, **code-reviewer** y **security-reviewer** | Ver sección 8 |
| SO de trabajo | **Windows** + VS Code | Afecta a finales de línea, puertos y scripts |
| Imágenes de máquinas | **v2** (fotos propias desde el móvil) | Las imágenes de internet dan problemas de licencia y no coinciden con tu gimnasio |


### Decisiones vigentes por tema

Una línea por decisión. El detalle, los motivos y las decisiones ya superadas están en `docs/history.md` («Decisiones por fase, 2.1 a 2.10»).

**Proyecto y herramientas**
- Licencia: «All rights reserved» mientras el repo sea privado; **MIT** al hacerlo público (Fase 13).
- Versiones exactas en `package.json`; **TypeScript 6.0.x** y **ESLint 9.x** (límites en `CLAUDE.md` §2). **Node 22** en el proyecto (`.nvmrc`, CI, `@types/node` 22, `engines` `>=22.22.2`); en local se usa Node 26 y está aceptado.
- `typecheck` es `tsc -b`. husky solo con `commit-msg` (commitlint), sin `pre-commit`. Los documentos de diseño usan el ámbito de commit `theme`.
- Claude Code: reglas, agentes, skills y permisos en `.claude/`, el plugin `armando-base` y `CLAUDE.md` §8. El cierre es en dos niveles: `/armando-base:close-phase` por rama y `/armando-base:close-phase final` en la última de la fase.

**Diseño, interfaz y PWA**
- Paleta «Hierro» y fuente «Archivo» autoalojada; tokens CSS en `src/theme/tokens.css` (`docs/design/`). Tema `system | light | dark` y modo sin color («0 dopamina»): ajustes **solo del dispositivo**, nunca se sincronizan.
- i18n con `i18next`: `es` por defecto, `en` opcional, claves tipadas, formatos con `Intl` (`es-ES` y `en-GB`). `src/ui` solo usa `react-i18next` para sus claves `ui.*`.
- react-router 8 con `RouterProvider` de `react-router/dom`. Todas las pantallas son `lazy` salvo Hoy y la sesión.
- Service worker con `registerType: 'prompt'`, solo precache; `/api/**` y `/.netlify/**` nunca en caché (ADR-0005). La instalabilidad se comprueba a mano.
- Estados explícitos (ADR-0006): ciclos de vida como uniones discriminadas con `switch` exhaustivo; los registros guardados y sincronizados no cambian de forma.

**Datos y sincronización**
- Dexie (ADR-0003): una tabla por tipo de registro + `pending` + `meta`; los repositorios validan con zod y encolan en la misma transacción; `db.version(n)` publicada no se edita, se añade una versión con `.upgrade()` y un test. La semilla (`ensureSeed`) tiene `updatedAt: 0`: cualquier edición o copia del servidor gana.
- Contrato sync v1 (`docs/api/sync-v1.md`): campos `type`/`updatedAt`/`deleted`/`serverSeq`, códigos de error, `CLAVE_SYNC` de 32 caracteres como mínimo. Solo se admiten cambios aditivos.
- Servidor: manejador `Request → Response` puro con un `SyncStore` intercambiable (memoria o Netlify Blobs); `netlify/functions/sync.ts` es un adaptador fino. Almacén `certavi` en producción y `certavi-branch-deploy` en `dev`, con claves distintas. `server/` y `netlify/` se sustituyen en la v2.
- Cliente (ADR-0004): transporte HTTP genérico, un intento a la vez, lotes de 300, backoff, envío final con `keepalive`. El estado «Sincronizado» solo aparece tras un intento que salió bien. La clave de sync vive en `localStorage` del dispositivo.
- Clave nueva: `since` vuelve a 0 y se encolan los registros con `updatedAt > 0`. Restaurar una copia del servidor encola las diferencias como ediciones nuevas (la semilla vuelve a su versión semilla).
- Importar (gym_app o copia de Certavi) escribe un registro solo si es nuevo o estrictamente más reciente (empate: gana lo local), en una transacción. Copias de Certavi: `{ app: 'certavi', format: 1, kind, exportedAt, records }`, sin borrados ni `serverSeq`. CSV siempre en formato Excel en español.
- Ajustes: `rest` y `planStart` se sincronizan; tema, idioma, sonido, vibración, sin color, diagnóstico y `syncKey`, no. El diagnóstico (mediciones con `performance.now()`, últimas 20 de cada una en `localStorage`) nunca se sincroniza. Ids de registros creados en el dispositivo con `newId(prefix)`; ids derivados (`week_<lunes>`, `bw_<lunes>`…) y fechas ISO locales con semanas desde el lunes.

**Dominio y reglas** (tabla completa en §4 y `.claude/rules/domain.md`)
- La serie de aproximación cuenta como serie efectiva en el recuento semanal, no en el 1RM ni en los récords; el dropset cuenta como efectiva y volumen. «No cuenta» es por ejercicio y sesión.
- Regla del top set, incrementos por defecto (mancuernas +2 kg, básicos de pierna y `gemelo-hack` +5 kg, resto +2,5 kg), `WeekPlan.size` (5/4/3) y semana de senderismo como en gym_app (86 series con 4 sesiones).
- Peso corporal válido entre 20 y 300 kg; recordatorio de descarga tras 6 semanas seguidas sin ella.
- Cada ejercicio de la sesión es una lista de filas (`SetEntry.slot` y `kind`); los borradores sin ✓ se guardan en `localStorage` del dispositivo.
- Ejercicios propios con id `exe_`: se archivan, nunca se borran. Solo se editan las seis rutinas semilla; «Restaurar original» escribe la semilla con `updatedAt` actual.

**Tests y e2e** (reglas en `.claude/rules/testing.md` y `.claude/rules/e2e-discipline.md`)
- Cobertura v8 ≥ 90 % en `src/domain/**`, `src/data/**` y `server/**` (`npm run test:coverage`, la que ejecuta CI).
- `npm run e2e` solo Chromium; `npm run e2e:all` (Chromium + WebKit; `@all-engines` marca solo los tests que dependen del motor, decisión del 2026-11-14; lo del iPhone se comprueba a mano con `docs/device-checklist.md`) lo ejecuta el qa-tester una vez en la última rama de cada fase y CI en los PR a `main`. Sin esperas de tiempo real (`page.clock`). Los datos de e2e salen de `tests/fixtures/certavi-backup-sample.json`, sintético; el servidor falso usa el manejador real vía `context.route` (el puerto 8787 queda reservado sin uso).
- Los datos de prueba son siempre sintéticos; nunca se leen exportaciones reales de gym_app.

---


## 3. Arquitectura

Capas, reglas de dependencia, stack y estructura del repositorio: `CLAUDE.md` §2 a §4. El texto original de esta sección está en `docs/history.md` («Secciones archivadas»).

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
| **WeekPlan** | `id` (lunes), `hiking`, `deload`, `size` (5/4/3), `plannedSetsByGroup`, `closedAt` | Al cerrar la semana se congela el plan. `size` añadido en la Fase 2 (`docs/history.md`, 2.3) |
| **WorkoutSession** | `id`, `date`, `routineId \| null` (null = **sesión libre**), `startedAt`, `endedAt`, `items[]` (copia de la rutina al empezar, editable: añadir, quitar o reordenar ejercicios y **series**), `note`, `readiness` (1-5) | Cambiar el plan de la sesión **no** toca la rutina |
| **SetEntry** | `id`, `sessionId`, `exerciseId`, `slot`, `kind` (`warmup` · `approach` · `top` · `backoff` · `straight` · `bilbo` · `extra`), `weight`, `reps`, `rir`, `straps?`, `band?`, `completedAt` | El calentamiento se muestra con su símbolo y no cuenta en las estadísticas |
| **ExerciseNote** | `sessionId`, `exerciseId`, `text`, `excludeFromProgression`, `reason` | «No cuenta» por ejercicio y sesión (`docs/history.md`, 2.3) |
| **Activity** | `date`, `kind` (fútbol, natación, senderismo…), `minutes`, `note` | — |
| **BodyWeight** | `week` (lunes), `kg` | Editable en cualquier semana, también la anterior |
| **OptionalBlock** | `id`, `name`, `type` (`mobility` · `stretching` · `rehab`), `items[]: { id, name, dose, description }`, `days[]` (días de la semana), `metrics[]` (por ejemplo, «dolor al bajar escaleras 0-10», «pogos 0-10»), `active`, `startDate?`, `reviewDate?` (fechas ISO, Fase 3, 2.4) | Generaliza la recuperación del tobillo: movilidad, estiramientos y rehabilitación configurables |
| **BlockLog** | `date`, `blockId`, `done: { itemId: boolean }`, `metrics: { metricId: number }`, `note` | Checklist del día y métricas |
| **WeeklyMetric** | `week`, `metricId`, `values` (por ejemplo, test de la pared izquierda/derecha en cm) | — |
| **Settings** | Sincronizados: `rest` (básicos/aislamientos, s), `planStart`. Solo del dispositivo: `theme` (`system` · `light` · `dark`), `locale` (`es` · `en`), sonido, vibración, diagnóstico, `syncKey` | Lo que es de este dispositivo no se sincroniza. Paleta y fuente ya no son ajustes (`docs/history.md`, 2.3) |

### 4.2 Reglas de dominio (todas con tests)

- **1RM estimado** (Epley sobre la mejor serie; se ignoran las de calentamiento y aproximación).
- **Progresión** según `rutina-actual.md`:
  - **Top set:** al tocar el tope del rango a RIR 1-2 se sube en la siguiente sesión. Si se supera el rango, se sube sí o sí.
  - **Incrementos:** +2,5 kg en torso y +5 kg en pierna, salvo que el ejercicio tenga su propio incremento. Concretado en la Fase 2 (`docs/history.md`, 2.3): mancuernas +2 kg; básicos de pierna y `gemelo-hack` +5 kg; el resto +2,5 kg.
  - **Back-off:** ≈ −10 % del top, redondeado al incremento.
  - **Aislamientos:** cuando todas las series llegan al tope, se sube la mínima carga.
  - **Excepción:** las sesiones marcadas «no cuenta» (máquina ocupada, faltan discos, otra banda) no deciden subidas.
- **Series efectivas por grupo y semana** frente al plan, con el plan congelado en las semanas cerradas. La aproximación cuenta; el calentamiento y las series de 0 reps no (`docs/history.md`, 2.3).
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

La lista de funciones que se conservan de `gym_app` (paridad, condición de la `v1.0.0`) y las nuevas están en `docs/spec/` (una spec por pantalla) y, en su versión original, en `docs/history.md` («Secciones archivadas»).

---

## 6. Migración desde la app actual

Mapeo de registros y pasos: `docs/migration.md`. Se retira en la Fase 13, tras la migración real.

---

## 7. Flujo de trabajo

Ramas, Conventional Commits, versiones, tags y changelog: `.claude/rules/git-workflow.md`. Reparto de papeles: `CLAUDE.md` §8. Versión de cada fase: tabla de la sección 10.

---

## 8. Claude Code: reglas, agentes y comandos

Ver `CLAUDE.md` §8 y `.claude/` (el borrador original, superado, está en `docs/history.md#seccion8`).

Nombres anteriores, que siguen en `docs/history.md`, `CHANGELOG.md` y `docs/audit/` (registros que no se reescriben): `blind-tester` → `armando-base:qa-tester`; `.claude/rules/e2e.md` → `e2e-discipline.md`; `.claude/rules/git.md` → `git-workflow.md`; `/start-phase` y `/close-phase` → `/armando-base:start-phase` y `/armando-base:close-phase`; el reparto de papeles de `CLAUDE.md` pasó de §7 a §8.

---

## 9. Preparación antes de la Fase 0

Hecha. Ver `docs/history.md#seccion9`.

---


## 10. Hoja de ruta por fases

Cada fase sigue el mismo ciclo:

1. **Tú** creas la rama desde `dev`.
2. Lanzas `/armando-base:start-phase N` o pegas el prompt.
3. Claude Code implementa.
4. Ejecutas `/armando-base:close-phase`.
5. **Tú** revisas, pruebas en el móvil, haces los commits propuestos, abres el PR a `dev` y lo mergeas.
6. Al cerrar la fase: PR de `dev` a `main` y tag.

> Si una fase es grande, divídela en varias ramas `feature/*` (Claude Code te lo propondrá). **Una fase se cierra al cumplir sus criterios de salida**; lo nuevo que aparezca por el camino va a `docs/backlog.md`.

### Estado de las fases

El detalle de las fases cerradas (entregables, decisiones, registro) está en `docs/history.md#fase0` … `#fase9`.

| Fase | Contenido | Versión | Estado | Ramas |
|---|---|---|---|---|
| 0 | Base del proyecto: herramientas, documentación y agentes | `v0.1.0` | ✅ 2026-11-02 | `chore/project-setup` |
| 1 | Diseño, tema, i18n y navegación | `v0.2.0` | ✅ 2026-11-03 | `feature/design-system`, `feature/app-shell` |
| 2 | Dominio y catálogo | `v0.3.0` | ✅ 2026-11-03 | `feature/domain-model` |
| 3 | Datos locales, importador y exportaciones | `v0.4.0` | ✅ 2026-11-03 | `feature/local-db`, `feature/import-export` |
| 4 | Sincronización y backend | `v0.5.0` | ✅ 2026-11-04 | `feature/sync-server`, `feature/sync-client`, `fix/e2e-webkit-sync` |
| 5 | Hoy y sesión activa | `v0.6.0` | ✅ 2026-11-06 | `feature/today`, `feature/active-session`, `feature/session-tools`, `chore/ci-e2e-shards` |
| 6 | Catálogo, ejercicios propios y rutinas | `v0.7.0` | ✅ 2026-11-06 | `feature/exercise-catalog`, `feature/routine-editor`, `feature/add-changes-phases` |
| 7 | Calendario, progreso y bloques | `v0.8.0` | ✅ 2026-11-07 | `feature/calendar`, `feature/progress`, `feature/training-stats`, `feature/optional-blocks` |
| 8 | Pulido PWA, accesibilidad y rendimiento | `v0.9.0` | ✅ 2026-11-08 | `feature/pwa`, `chore/polish` |
| 9 | Ajustes tras el uso real | `v0.10.1` | ✅ 2026-11-13 (PR #53 la última rama, PR de release #54; también existe el tag `v0.10.0`) | `docs/phase-9-polish`, `chore/dependabot`, `fix/ui-polish`, `feature/routine-week-edits`, `feature/machine-setup`, `chore/e2e-speed`, `fix/gym-feedback`, `fix/explicit-state` |
| 10 | Consistencia y dispositivo | `v0.11.0` | ✅ 2026-11-14 (cerrada; checklist del iPhone apuntada, D-5 sonido no bloquea: `docs/backlog.md` §5; release pendiente) | `docs/consistency`, `feature/diagnostics`, `chore/e2e-engines`, `docs/device-run`, `chore/e2e-engines-2` |
| 11 | Auditoría con Fable | `v0.12.0` | ⏳ | `docs/audit-fable` y las `fix/*` que salgan |
| 12 | Diseño con Fable | `v0.13.0` | ⏳ | `feature/design-refresh` |
| 13 | QA final, migración real y v1.0.0 | **`v1.0.0`** | ⏳ | `release/1.0.0` o PR `dev → main` |

**Siguiente**: Fase 11 (`docs/audit-fable`, `v0.12.0`), con su prompt en su sección. La Fase 10 está archivada en [`docs/history.md`](docs/history.md#fase10).

---

### Fase 11 · Auditoría con Fable → `v0.12.0` ⏳

**Ramas**: `docs/audit-fable` y después las `fix/*` que salgan de ella.

**Modelo**: el usuario cambia a Fable 5.2 con `/model` antes de empezar.

**Objetivo**: encontrar los defectos que quedan antes del diseño y de la v1.0.0.

**Severidad**:
- **bloqueante**: puede perder o corromper datos, rompe el uso en el gimnasio o es un fallo de seguridad;
- **importante**: fallo visible o deuda que encarece algo ya planificado;
- **backlog**: lo demás.

`server/` y `netlify/` se sustituyen en la v2: allí solo cuentan seguridad y pérdida de datos.

**Criterios de salida**: ningún bloqueante ni importante abierto; el resto, en `docs/backlog.md`.

**Prompt**:

```text
Lee context.md, CLAUDE.md, docs/backlog.md y docs/spec/**. FASE 11: auditoría completa de Certavi.
Rama docs/audit-fable, solo lectura salvo el informe. Revisa: arquitectura y capas, dominio y reglas, datos y
sync (transacciones, cola, LWW, concurrencia, pérdida de datos), seguridad (servidor, CSP, clave, datos
exportados), accesibilidad, rendimiento, calidad de los tests (no la cobertura), mantenibilidad y documentación.
Informe en docs/audit/fable-2026-11.md: id, área, archivo:línea, problema, por qué importa, propuesta y
severidad según la Fase 11. Después pídeme que valide la clasificación, propón ramas fix/* agrupadas por
tema y espera mi OK. Lo de severidad backlog va a docs/backlog.md. Cada rama fix/*: /armando-base:close-phase; la
última, /armando-base:close-phase final.
```

---

### Fase 12 · Diseño con Fable → `v0.13.0` ⏳

**Rama**: `feature/design-refresh` (dividir si es grande).

**Modelo**: Fable 5.2 (el usuario lo cambia con `/model` antes de empezar).

**Objetivo**: estilo, transiciones y aspecto profesional, solo frontend.

**Entregables**:
- Referencias del usuario (capturas y qué le gusta de cada una; se toman ideas, no se copia ninguna app).
- Selector de 2-3 direcciones aplicado a Hoy, sesión activa y Progreso, en claro, oscuro y «0 dopamina».
- Decisión en `docs/design/decision.md`.
- Tokens y movimiento documentados.
- Aplicación pantalla a pantalla.

**Criterios de salida**: diseño aprobado por el usuario en el iPhone; contraste AA y axe sin violaciones; `prefers-reduced-motion` respetado; es/en sin textos cortados a 390 px.

**Prompt**:

```text
Lee context.md, CLAUDE.md, docs/design/** y src/theme/**. FASE 12: renovación del diseño. Primero pídeme
referencias (capturas y qué me gusta de cada una). Propón 2-3 direcciones en una página autónoma
(docs/design/selector-v2.html) sobre Hoy, sesión activa y Progreso, en claro, oscuro y 0 dopamina, con
interruptores y contraste AA visible. Espera mi elección y apúntala en docs/design/decision.md. Después:
tokens, movimiento y componentes de src/ui, y pantalla a pantalla, dividiendo en ramas si hace falta (dime
cuáles crear). Sin colores ni tamaños sueltos, i18n en todo y reduced motion. /armando-base:close-phase en cada
rama; la última, /armando-base:close-phase final.
```

---

### Fase 13 · QA final, migración real y v1.0.0 ⏳

**Rama**: `release/1.0.0`, o directamente un PR de `dev` a `main`.

**Pasos**:
1. El qa-tester hace una regresión completa, en español y en inglés, claro y oscuro, sin conexión. Incluye el logo, las transiciones, la edición de semanas cerradas, las tarjetas de rutina, los chips del editor y los ajustes de la máquina (todo de la Fase 9).
2. Tú usas Certavi en paralelo con gym_app durante 1 semana.
3. Exportas por última vez desde gym_app, importas en Certavi y compruebas los recuentos.
4. **Quitar el rastro de gym_app** (añadido el 2026-11-06), solo **después** de la migración real del paso 3, porque hasta entonces hace falta el importador: eliminar «Importar desde la app anterior» (`ImportExport.tsx`, claves i18n `importLegacy`/`notLegacy`…), `src/data/legacy/`, `src/domain/seed/legacyAliases.ts` (los alias solo sirven para datos de gym_app), `docs/migration.md`, la sección 6 de este archivo y las menciones en README, spec y ADR. Decidir si `context.md` y `docs/history.md` (que cuentan el origen del proyecto) se quedan en el repo público o se resumen. Motivo: la intención es que lo usen tú y gente de tu entorno, no que sea «la v2 de otra app». Importar datos de otras apps (Hevy, Strong…) queda en el backlog (`docs/backlog.md`). Requisito previo (añadido el 2026-11-10): la Fase 9 (`chore/e2e-speed`) hace que los e2e carguen sus datos con un fixture sintético de Certavi y no con el importador, para que borrarlo aquí no rompa la suite.
5. Release `v1.0.0`, tag y despliegue a producción.
6. Archivas `gym_app`.
7. **Documentación de portfolio** (añadido el 2026-11-06):
   - README en **español** (`README.es.md`) y en inglés, con enlace cruzado entre ambos.
   - **Banner** arriba en los dos: nombre del proyecto y un visual (un teléfono con Hoy o una gráfica de progreso). Claude puede generar un SVG; si prefieres hacerlo tú, la plantilla es 1280 × 320 px, texto dentro de los 960 px centrales, logo a la izquierda, «Certavi» en Archivo Bold, subtítulo, fondo `--bg` y acento `#1d4ed8`, versión clara y oscura (`banner-light` / `banner-dark` en `docs/assets/`, con `<picture>` y `prefers-color-scheme`).
   - **Capturas** reales (Hoy, sesión activa, progreso, ficha de ejercicio; claro y oscuro) que tú pasas.
   - **Insignias**: estado de CI (GitHub Actions; solo se ve bien con el repo público), cobertura (Codecov o insignia estática de shields.io actualizada en cada release) y notas de Lighthouse de la Fase 8 (rendimiento, accesibilidad, buenas prácticas; la categoría PWA ya no existe).
   - **CI presentable** (añadido el 2026-11-13): nombres claros de jobs, resumen en `$GITHUB_STEP_SUMMARY` (tests, cobertura y tiempos de e2e) e insignias.
8. **¿Puede usarlo otra persona?** (añadido el 2026-11-06) Dejar la respuesta en el README: sin sync, sí, todo funciona en el dispositivo; con sync, no tal cual, porque el servidor guarda **un solo conjunto de datos** tras una sola `CLAVE_SYNC` (dos personas con la misma clave mezclarían datos), así que cada persona necesita su propio despliegue en Netlify (guía en `docs/deploy-netlify.md`). La semilla es la tuya (rutinas, catálogo y bloque de rehabilitación del tobillo activo en `src/domain/seed/blocks.ts`): decidir si se deja como «plantilla de ejemplo», se desactiva el bloque por defecto, o ambas. Lo que falta para multiusuario está en el backlog (`docs/backlog.md`).
9. **Antes de hacer público el repo** (añadido el 2026-11-06; haces público cuando quieras y activas la protección de ramas):
   - **Escaneo de secretos** con `gitleaks` sobre **todo el historial** (`gitleaks git`), no solo el estado actual, por si hubo una `CLAVE_SYNC`, un token o un export real. Buscar también a mano exports reales de gym_app (`"app": "winter-arc"`) y datos personales en los documentos (`context.md`, `docs/history.md`, specs). Si algo apareció, rotar la clave primero y después reescribir el historial; reescribir ramas lo haces tú.
   - **Cambiar `LICENSE` a MIT** en ese momento (ver «Decisiones vigentes», licencia) y revisar `package.json` (`license`, `private`).
   - Revisar `.gitignore`, variables de entorno y `netlify.toml` (cabeceras, CSP).

**Prompt**:

```text
Lee context.md. FASE 13: preparación de la v1.0.0. Lanza al qa-tester para una regresión completa
(es/en, claro/oscuro, offline, 390x844). Prepara una checklist de migración real para que la ejecute yo
(exportar de gym_app, importar, verificar recuentos por tipo de registro). Después, quita el rastro de gym_app
(importador, alias, migración) y deja README en español e inglés con banner, capturas reales que yo te pase e
insignias (CI, cobertura, Lighthouse) y una CI presentable (nombres de jobs y resumen en $GITHUB_STEP_SUMMARY), más la evaluación de si otra persona puede usarlo. Prepara el escaneo
de secretos con gitleaks sobre todo el historial y el cambio de licencia a MIT. Dame el plan de release a main
con versión y tag.
```

---

## 11. Backlog

Todas las ideas, sugerencias y pendientes (deuda técnica, comprobaciones manuales, mejoras v1.x y producto v2, con la hoja de ruta de la v2) están **solo** en [`docs/backlog.md`](docs/backlog.md). Aquí no se apuntan.

---

## 12. Registro de progreso

[Tabla del registro](docs/history.md#seccion12). Las preguntas abiertas y las listas de pendientes que había aquí pasaron a `docs/backlog.md` (comprobaciones manuales en el iPhone: sección 1); el texto original está archivado en `docs/history.md`.
