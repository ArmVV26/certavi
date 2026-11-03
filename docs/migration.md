# Migration from gym_app

How data moves from `gym_app` (v1.5.1, "Winter Arc · registro") to Certavi.
The importer is built in **Phase 3**; the real migration happens in **Phase 9**.

## 1. Back up first — outside the repository

In gym_app, go to **Settings → "Copia completa (.json)"** and save the file **outside this
repository**, for example `D:\backups\certavi\`.

> **Never** put real exports inside the repo. `backups/` and `*.backup.json` are git-ignored,
> and Claude Code is denied access to `backups/`, but the safe rule is: real data never enters
> this folder. Importer tests use **synthetic** JSON only.

## 2. Importing in Certavi

Certavi will have **Settings → "Import from the previous app"**, which:

1. reads the gym_app JSON,
2. validates it with zod,
3. transforms it with the mapping below,
4. shows a summary before saving (e.g. "27 sessions, 553 sets…"),
5. saves on confirmation; the records then sync like any other local change.

## 3. Envelope field renames

| gym_app | Certavi                                        |
| ------- | ---------------------------------------------- |
| `t`     | `type`                                         |
| `u`     | `updatedAt`                                    |
| `del`   | `deleted`                                      |
| `srv`   | dropped (the server assigns a new `serverSeq`) |

## 4. Record mapping

| `t` in gym_app            | Certavi                           | Notes                                                    |
| ------------------------- | --------------------------------- | -------------------------------------------------------- |
| `session`                 | `WorkoutSession`                  | `tpl` → `routineId` (`libre` → `null`); `items` are kept |
| `set`                     | `SetEntry`                        | `w/r/rir/straps/band/kind/slot`                          |
| `note`                    | `ExerciseNote`                    | —                                                        |
| `act`                     | `Activity`                        | —                                                        |
| `bw`                      | `BodyWeight`                      | —                                                        |
| `wk`                      | `WeekPlan`                        | `hiking`, `deload` and the frozen plan                   |
| `tpl`                     | `Routine`                         | The override becomes the routine itself                  |
| `rec`                     | `BlockLog` of the rehab block     | `mob`, `ecc`, `stairs`, `pogos`, `maxPain`, `note`       |
| `wall`                    | `WeeklyMetric` (wall test)        | —                                                        |
| `exc`                     | `Exercise.increment`              | —                                                        |
| `cfg_recovery`            | Rehab block (active, physio date) | —                                                        |
| `cfg_exp_brazos`, `mig_*` | Ignored                           | —                                                        |
| records with `del: true`  | Ignored                           | —                                                        |
| exercise `abdomen`        | → `crunch-maquina`                | Same exercise, merged                                    |

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
  name. Slots `w<n>` / `p<n>` / `x<n>` become `slot: n` with the kind telling them apart.
- gym_app's `hiking` week was a 4-session week with Lower Full. In Certavi a week has a `size`
  (5, 4 or 3) besides `hiking`; imported weeks keep their frozen plan, so their numbers do not
  change.
- "Does not count" is new in Certavi (`ExerciseNote.excludeFromProgression`); gym_app has nothing
  to map to it.
- Seed records have `updatedAt: 0`, so any imported or edited record wins over them.

## 5. Importer test requirements (Phase 3)

A synthetic JSON covering **every** record type above, including deleted records, `abdomen`,
`libre`, routine overrides, `rec` and `wall`. The test checks that counts per type match.

## 6. Switch-over (Phase 9)

1. Use Certavi in parallel with gym_app for one week.
2. Make a final export from gym_app and import it into Certavi.
3. Check the counts per record type.
4. Release v1.0.0 and use Certavi.
5. Archive the `gym_app` repository on GitHub (Settings → Archive).
