---
paths:
  - 'src/domain/**'
---

# Domain (`src/domain`)

`src/domain` — pure TypeScript: entities, zod schemas, rules, seed catalog and routines.
**No React, no Dexie, no `fetch`.** Everything here is unit-tested. Domain logic lives in
`src/domain` (pure, no React/Dexie) and must have tests.

Layout: `model/` (zod schemas + types), `rules/`, `seed/` (catalog, routines, blocks, legacy
aliases), `sync/` (contract schemas, merge rule), `testing/` (test data builders), `dates.ts`.

## Domain model (summary)

Full table in `context.md` §4. Records are stored and synced as **plain JSON**; behaviour lives
in pure rule modules (`src/domain/rules`), with classes only where they help.

```ts
interface SyncEnvelope {
  id: string; // stable; gym_app exercise ids are preserved
  type: RecordType; // 'exercise' | 'routine' | 'session' | 'set' | ...
  updatedAt: number; // ms epoch; the highest wins
  deleted?: true; // soft delete, travels to other devices
  serverSeq?: number; // set by the server; the client never sends it
}
```

Entities: `Exercise`, `MuscleGroup`, `SetScheme`, `Routine`, `WeekPlan`, `WorkoutSession`
(`routineId: null` = free session; its `items` keep one scheme per exercise whose rows are the
sets the user sees), `SetEntry` (`kind`: warmup · approach · top · backoff · straight · bilbo ·
dropset · extra; `slot` = position of its row in the exercise), `ExerciseNote`, `Activity`, `BodyWeight`, `OptionalBlock`,
`BlockLog`, `WeeklyMetric`, `Settings` (device-only fields such as theme and sync key are
never synced).

Rules (all tested): estimated 1RM (Epley on best set, ignoring warm-up/approach), progression
(top set, increments +2.5 kg upper / +5 kg lower unless overridden, back-off ≈ −10 %, isolation),
"does not count" sessions, effective sets per muscle group per week vs plan, records (excluding
deload weeks), deload, short week, hiking week (`weekRoutines`), day plan (`dayPlan.ts`), new
sessions (`session.ts`), Today helpers (`today.ts`), blocks of the day (`blocks.ts`), weekly
streak and training volume per week or month (`trainingStats.ts`).
