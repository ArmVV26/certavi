# Migration from gym_app

How data moves from `gym_app` (v1.5.1, "Winter Arc · registro") to Certavi.
The importer is built in **Phase 3**; the real migration happens in **Phase 10**.

## 1. Back up first — outside the repository

In gym_app, go to **Settings → "Copia completa (.json)"** and save the file **outside this
repository**, for example `D:\backups\certavi\`.

> **Never** put real exports inside the repo. `backups/` and `*.backup.json` are git-ignored,
> and Claude Code is denied access to `backups/`, but the safe rule is: real data never enters
> this folder. Importer tests use **synthetic** JSON only.

## 2. Importing in Certavi

**Settings → Datos → "Importar desde la app anterior"** (implemented in Phase 3,
`src/data/legacy/gymApp.ts` + `src/data/importRecords.ts`):

1. reads the gym_app JSON (`{ app: 'winter-arc', version: 2, exportedAt, records }`, or a bare
   array of records, as gym_app's own importer accepted);
2. validates every record with a tolerant zod schema of the gym_app shapes, converts it and
   validates the result with the Certavi schema (`parseRecord`);
3. shows a preview before saving: what will be written per type, what is unchanged, ignored or
   invalid;
4. saves on confirmation in **one transaction**, with last-write-wins: a record is written only
   if this device has no copy with the same or a newer `updatedAt`. Written records join the
   pending queue and sync like any other local change; the clock moves past the newest one.

The full copy of gym_app leaves out deleted records and may carry `srv`.

## 3. Envelope field renames

| gym_app | Certavi                                        |
| ------- | ---------------------------------------------- |
| `t`     | `type`                                         |
| `u`     | `updatedAt` (kept as is)                       |
| `del`   | `deleted` (deleted records are not imported)   |
| `srv`   | dropped (the server assigns a new `serverSeq`) |

## 4. Record mapping

The `t` values and shapes below come from the gym_app v1.5.1 **source code**. Note that
`wk_*`, `exc_*`, `cfg_*` and `mig_*` are id prefixes: their `t` values are `week`, `excfg`,
`cfg` and `mig`.

| `t` (id) in gym_app                   | Certavi                                  | Notes                                                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session` (`ses_…`)                   | `WorkoutSession` (same id)               | `tpl` → `routineId` (`libre` → `null`); `start`/`end` → `startedAt`/`endedAt`; `ready` → `readiness`; `items` converted; sessions without `items` (the oldest) get the seed routine's |
| `set` (`st_<sid>_<ex>_<slot>`)        | `SetEntry` (same id)                     | `sid`, `ex`, `w`, `r`, `rir`, `straps`, `band` (`''` → none), `at` → `completedAt` (`u` if missing); kinds and slots below                                                            |
| `note` (`nt_<sid>_<ex>`)              | `ExerciseNote` (`note_<sid>_<ex>`)       | id rebuilt with the Certavi rule, after the alias                                                                                                                                     |
| `act` (`act_…`)                       | `Activity` (same id)                     | `futbol` football, `natacion` swimming, `senderismo` hiking, `movilidad` mobility, `bici` cycling, `otro`/unknown other; `min` → `minutes` (`null` → 0)                               |
| `bw` (`bw_<monday>`)                  | `BodyWeight` (`bw_<monday>`)             | —                                                                                                                                                                                     |
| `week` (`wk_<monday>`)                | `WeekPlan` (`week_<monday>`)             | `hiking`, `deload` (missing → false), `size` 5; `plan` (Spanish group keys) → `plannedSetsByGroup`; `closedAt` kept; `total` dropped (it is the sum)                                  |
| `tpl` (`tpl_<id>`)                    | `Routine` (`<id>`)                       | the override becomes the seed routine with the gym_app items; unknown templates are ignored                                                                                           |
| `excfg` (`exc_<ex>`)                  | `Exercise.increment`                     | `step` on the seed exercise (after the alias); unknown exercises are ignored                                                                                                          |
| `rec` (`rec_<date>`)                  | `BlockLog` of the ankle rehab block      | `mob`/`ecc` checklists → `done` (below); `stairs`, `maxPain` → `max-pain`, `pogos` → `metrics` (`null` = not logged); `note`                                                          |
| `wall` (`wall_<monday>`)              | `WeeklyMetric` `wall-test` (left, right) | the measuring `date` is dropped                                                                                                                                                       |
| `cfg` (`cfg_recovery`)                | ankle rehab `OptionalBlock`              | `active`; `start` → `startDate`; `physio` → `reviewDate`; `footballOk` dropped                                                                                                        |
| `cfg` (`cfg_exp_brazos`), `mig_*`     | Ignored                                  | internal settings and migration markers                                                                                                                                               |
| records with `del: true`, unknown `t` | Ignored                                  | —                                                                                                                                                                                     |
| exercise `abdomen`                    | → `crunch-maquina`                       | in sets, notes, session items, routines and increments                                                                                                                                |

Item shape: `{ ex, plan: [kind, range, n][], rir, nota?, opt? }` →
`{ exerciseId, scheme: { blocks: [{ kind, reps, count }], rir }, note?, optional }`. A `rir`
Certavi cannot read becomes `''`. `nota` becomes user text; `deload` on items and sessions
and `exp` on sessions are dropped (the week carries the deload flag).

Recovery checklist keys → ankle rehab items: `rodillo` foam-roll, `pared` wall-ankle,
`sentado` ankle-sit, `goma` band-mobilization, `cajon` box-drop, `talon` heel-raise,
`zancada` split-heel-raise, `pogos` pogos.

Muscle groups in week plans: `pecho` chest, `espalda` back, `hombro` shoulders, `cuadriceps`
quads, `femoral` hamstrings-glutes, `triceps`, `biceps`, `gemelo` calves, `core`, `antebrazo`
forearms.

When two gym_app records map to the same Certavi id (e.g. notes of `abdomen` and
`crunch-maquina` in the same session), the newest wins.

**Exercise ids from gym_app are preserved**, so renamed exercises keep their history
(see `context.md` §4.3).

### Ids in the Phase 2 seed (`src/domain/seed`)

- **Exercises:** all 45 gym_app ids except `abdomen`, plus the new `hack-banda`. `abdomen` is
  resolved by `resolveExerciseId` (`legacyAliases.ts`) to `crunch-maquina`; the importer must
  apply it to sets, notes, session items and routine overrides.
- `dominadas`, `hack-squat`, `bilbo-banca` and `bilbo-prensa` stay in the catalog (not archived)
  but are in no seed routine. Their history imports as is.
- **Routines** keep the gym_app template ids: `push`, `pull`, `upper`, `lowerA`, `lowerB`,
  `lowerFull`. `libre` becomes `routineId: null`.
- gym_app set kinds map as: `aprox` → `approach`, `work` → `straight`; the others keep their
  name. Slots `w<n>` / `p<n>` / `x<n>` are converted to one list of rows per exercise (`slot` =
  position: warm-ups first, then the planned sets, then the extra sets) after the import, by
  `normalizeLegacyRows`; the session's scheme gains the matching warm-up and extra rows.
- gym_app's `hiking` week was a 4-session week with Lower Full. In Certavi a week has a `size`
  (5, 4 or 3) besides `hiking`; imported weeks keep their frozen plan, so their numbers do not
  change.
- "Does not count" is new in Certavi (`ExerciseNote.excludeFromProgression`); gym_app has nothing
  to map to it.
- Seed records have `updatedAt: 0`, so any imported or edited record wins over them.

## 5. Importer test requirements (Phase 3)

`tests/fixtures/gym-app-sample.json` is a **synthetic** full copy covering every record type
above: deleted records, `abdomen`, `libre`, a session without items, routine overrides,
`excfg`, `rec`, `wall`, `cfg_recovery`, `cfg_exp_brazos` and `mig_*`. Unit tests
(`src/data/legacy/gymApp.test.ts`, `src/data/importRecords.test.ts`) check the counts per
type (29 records written, 5 ignored) and each mapping; the e2e tests import it from Settings.

## 6. Switch-over (Phase 10)

1. Use Certavi in parallel with gym_app for one week.
2. Make a final export from gym_app and import it into Certavi.
3. Check the counts per record type.
4. Release v1.0.0 and use Certavi.
5. Archive the `gym_app` repository on GitHub (Settings → Archive).
