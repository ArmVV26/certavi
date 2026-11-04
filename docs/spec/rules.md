# Training rules

## Purpose

The rules Certavi uses to suggest weights, count sets and find records. They come from the
current routine (`rutina-actual.md`, cycle 2 Nov – 20 Dec 2026) and from gym_app. Phase 2
implements them as pure logic with no screens; the screens that show them arrive in Phases 5–7.
This document describes what the user will see. Each rule has numeric examples that later
acceptance criteria can reuse.

## 1. Kinds of sets

| Kind                       | Symbol (es / en) | Counts for weekly sets and volume | Counts for 1RM, max weight and records |
| -------------------------- | ---------------- | --------------------------------- | -------------------------------------- |
| Warm-up                    | **C** / **W**    | No                                | No                                     |
| Approach («aprox»)         | —                | **Yes**                           | No                                     |
| Top set                    | —                | Yes                               | Yes                                    |
| Back-off                   | —                | Yes                               | Yes                                    |
| Straight (linear)          | —                | Yes                               | Yes                                    |
| Bilbo                      | —                | Yes                               | Yes                                    |
| Extra (added in a session) | —                | Yes                               | Yes                                    |

A set with 0 reps does not count. **0 kg is a valid weight.**

## 2. Estimated 1RM

Epley formula on the best set: `weight × (1 + reps / 30)`.

- 100 kg × 5 → **116.7 kg**. 150 kg × 12 → **210 kg**.
- Warm-up and approach sets are ignored: an approach set of 200 kg × 3 before a 150 kg × 8 top
  set does not raise the 1RM.

## 3. Progression (what to do next time)

The reference is the **last earlier session** with that exercise that counts:

- Sessions where the exercise was marked **"does not count"** (machine busy, missing plates,
  another band colour…) are skipped. The mark applies to **one exercise in one session**; the
  rest of that session still counts.
- Deload sessions are used only if there is no normal one.

**Top set** (range 6-8, increment 2.5 kg):

| Last top set                         | Suggestion                             |
| ------------------------------------ | -------------------------------------- |
| 62.5 kg × 8 at RIR 1 or 2            | Go up to **65 kg**                     |
| 62.5 kg × 8 at RIR 3 or no RIR noted | Go up to **65 kg**                     |
| 62.5 kg × 8 at RIR 0                 | Repeat 62.5 kg until 8 come at RIR ≥ 1 |
| 62.5 kg × 9 or 10 (any RIR)          | Go up to **65 kg** no matter what      |
| 65 kg × 7                            | Repeat 65 kg and aim for 8 reps        |

**Back-off:** about **10 % below** the top set, rounded to the exercise's weight step, always at
least one step below the top set. Top 65 kg (step 2.5) → back-off **57.5 kg**; top 170 kg
(step 5) → **155 kg**.

**Straight sets / isolations** (3 × 10-15): when **all** planned sets reach 15 at the same weight,
go up one step (20 kg → 22.5 kg). Otherwise repeat the weight.

**Bilbo set** (20-30): past 30 reps → **+5 kg**.

**Pull-ups** (bodyweight, ~10): all sets at 10 or more → use a thinner band (or none).

**Deload week:** no progression suggestion; use the usual weight or 10 % less, leaving 3-4 reps
in reserve.

### Default weight steps

| Exercises                                                                               | Step        |
| --------------------------------------------------------------------------------------- | ----------- |
| Dumbbells (incline dumbbell press, incline curl)                                        | **+2 kg**   |
| Leg compounds (leg press, hack, Romanian deadlift, hip thrust…) and the hack calf raise | **+5 kg**   |
| Everything else: upper body and leg isolations                                          | **+2.5 kg** |

Each exercise can override its step (Phase 6).

## 4. Weekly sets per muscle group

Every planned set counts, including **approach** sets and **optional** exercises (wrist curl).
Warm-ups never count.

**Normal week (5 sessions: Push, Pull, Lower B, Upper, Lower A) = 104 sets:**

| Group               | Sets |
| ------------------- | ---- |
| Quads               | 16   |
| Hamstrings & glutes | 15   |
| Back                | 14   |
| Chest               | 13   |
| Shoulders           | 13   |
| Triceps             | 8    |
| Biceps              | 8    |
| Calves              | 8    |
| Core                | 6    |
| Forearms            | 3    |

Reverse flies count as shoulders; hip abduction and adduction count as hamstrings & glutes.

**Short weeks:**

- **4 sessions:** Push, Pull, Lower A, Lower B. **Upper is dropped, never a leg day.** 81 sets.
- **3 sessions:** Push, Pull, Lower Full. 63 sets.

**Hiking week** (Sunday in the mountains, as in gym_app): Lower A is dropped and Lower B becomes
Lower Full. A normal week is then Push, Pull, Lower Full, Upper — **86 sets**; with 4 sessions,
Push, Pull, Lower Full — 63 sets; with 3 sessions nothing changes.

A **closed** week keeps the plan it had when it was closed, even if the routines change later.
The current week (and later ones) always use the routines as they are now.

## 5. Deload

- Half the sets, rounded up: 3 straight sets → 2; top + 2 back-off → top + 1 back-off;
  top + 1 back-off → top only.
- Approach sets, optional exercises and Bilbo sets are dropped.
- Target RIR **3-4**.
- A normal week planned with deload: **62 sets**.
- Deload weeks never set records.

## 6. Records and best marks

From non-deload sessions, without warm-up or approach sets:

- **Max weight**, **best estimated 1RM**, **best session volume** (kg × reps of effective sets).
- **Best by reps:** the best weight for each rep count, shown only if no higher rep count has the
  same or more weight (100 kg × 5 hides 95 kg × 3).
- A **record event** is a session that beats the previous max weight or, otherwise, the previous
  best 1RM. The first session of an exercise only sets the baseline. Pull-ups have no weight
  records.

## 7. Catalog and routines

- Exercise ids from gym_app are kept, so history survives renames:
  - `jalon-pecho` is now "Jalón de pecho · agarre abierto neutro";
  - `jalon-cerrado` is now "Jalón de pecho · agarre cerrado prono".
- `abdomen` merges into `crunch-maquina`.
- **New:** `hack-banda` "Sentadilla hack con banda", with the purple band by default.
- Pull-ups, hack squat and the Bilbo exercises stay in the catalog, outside the routines.
- Straps are offered on every back exercise except pull-ups, and on the Romanian deadlift.
- Routine days: Push Monday, Pull Tuesday, Lower B Wednesday, Upper Friday, Lower A Sunday.
  Lower Full has no fixed day.
- Optional block "Rehabilitación del tobillo": daily mobility (5 items, 2 × 30 s per leg),
  strength 3-5 days a week (heel raises and split-stance heel raises 3 × 10 per leg, pogos
  3 × 20), pain metrics 0-10 with a reference line at **3/10** (going down stairs, maximum pain
  during the exercises, pogos) and a weekly
  wall test (left / right, cm). The "Estiramientos" block is created empty and inactive.

## Out of scope

Screens, sync and storage. The calf rule during rehab (go up only if going down stairs does not
hurt) depends on the blocks and arrives in Phase 7.
