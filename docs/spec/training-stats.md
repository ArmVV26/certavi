# Training statistics

## 1. Purpose

Two simple answers that motivate: **am I training week after week?** (the weekly streak) and
**how much work did I do?** (weight lifted, exercises and sets per week or per month). They live in
a card of **Progreso / Progress** (`/progress`, [progress.md](progress.md)) and the streak also
shows in the week card of **Hoy / Today** ([today.md](today.md)). Everything is computed from the
data on the device, works without coverage and updates by itself when data changes.

## 2. Definitions

- **Effective set**: not a warm-up and with at least one repetition ([rules.md](rules.md)).
- **Session that counts**: a session with at least one effective set. An empty session, or one
  with only warm-ups, does not count. Activities (football, swimming…) are not sessions.
- **Weight lifted** of a period: the sum of weight × repetitions of its effective sets. A set of
  0 kg (bodyweight, or no weight written) adds nothing. The sets of an exercise marked **"does not
  count"** in its session (another band, missing plates…) are **not added** to the weight lifted,
  but they are still exercises and sets done.
- **Exercises done**: one per exercise and session (an exercise done in three sessions of the
  period counts three).
- **Sets done**: the effective sets, the same figure as "Series por semana" in
  [progress.md](progress.md) §2.3.
- **Period**: a **week** (Monday to Sunday) or a **month** (calendar month). The current period is
  always the one of today, even if it is not over.

## 3. Weekly streak

- A week is **active** when it has at least one session that counts, on any day of it.
- The **streak** is the number of active weeks in a row. It is counted back from the **current
  week**:
  - the current week counts if it is already active;
  - the current week **without a session yet does not break it**: the streak is counted from last
    week, so it can still be kept until Sunday;
  - a whole past week without a session ends it.
- **Deload weeks and hiking weeks** keep the streak as long as they have a session, like any
  other week. Short weeks too. An activity alone does not make a week active.
- The **best streak** is the longest run of active weeks in the whole history (never lower than
  the current one).
- Sessions dated after the current week (planned ahead) do not count yet.

## 4. Screens

### 4.1 Progress: the "Entrenamiento / Training" card

Heading **"Entrenamiento" / "Training"**, right after the summary and before "Series por grupo
muscular". It is shown only when there is at least one session. It holds, in this order:

1. **Streak.** A figure "Racha" / "Streak" with the weeks ("3 semanas" / "3 weeks", "1 semana" /
   "1 week") and a note:
   - active this week: "Mejor racha: 5 semanas" / "Best streak: 5 weeks";
   - not active yet but with a streak: "Entrena esta semana para mantenerla" / "Train this week to
     keep it";
   - without streak (0, shown "0 semanas" / "0 weeks"): "Entrena esta semana para empezar una" / "Train this week to start one".
2. A choice **"Resumen por" / "Summary by"** (radio group, legend hidden): **"Semana" / "Week"**
   (default) and **"Mes" / "Month"**. It is remembered only while the screen is open.
3. A subtitle with the current period: "Semana 2–8 nov" / "Week 2 – 8 Nov", or the month and year,
   "noviembre de 2026" / "November 2026".
4. Three figures for the current period: **"Peso levantado" / "Weight lifted"** (kg, thousands
   separated in the active language: "12.480 kg" / "12,480 kg"), **"Ejercicios" / "Exercises"** and
   **"Series" / "Sets"**.
5. A **column chart** of the weight lifted in the last **12 weeks** or **6 months** (the current
   one included, oldest first), with the label under each column ("2/11" for a week, "nov" for a
   month), a text description and a **"Ver datos" / "Show data"** table (period, weight lifted,
   exercises, sets, sessions), as in [progress.md](progress.md) §2.9. The tooltip text of a
   column (its text equivalent is the table row): "2–8 nov: 12.480 kg, 22 ejercicios, 78 series" / "2 – 8 Nov: 12,480 kg, 22 exercises, 78 sets".
   Legend: "Peso levantado" / "Weight lifted".

Without any weight (all sets at 0 kg) the figures show 0 kg and the chart shows empty columns.

### 4.2 Today: the week card

The "Esta semana" card gets a third figure **"Racha" / "Streak"** next to the sets and the
sessions: "3 semanas" / "3 weeks", or "0 semanas" / "0 weeks" when there is none. It is not shown while the data loads
and is not a link. It is a labelled figure like the other two: "Racha" and its value, "3 semanas".

## 5. Acceptance criteria

```
AC-STA-01 · Streak
Given sessions in each of the last three weeks, the current one included
When I open Progreso
Then the "Entrenamiento" card shows "Racha" with "3 semanas"
And Hoy shows the same figure in "Esta semana"
```

```
AC-STA-02 · The current week does not break the streak
Given sessions in the previous two weeks and none yet in the current week
When I open Progreso
Then the streak is "2 semanas" and the note says "Entrena esta semana para mantenerla"
```

```
AC-STA-03 · A skipped week breaks it
Given sessions in the last two weeks but not in the one before
When I open Progreso
Then the streak is "2 semanas" and the best streak is the longest run in the history
```

```
AC-STA-04 · Weight lifted, exercises and sets per week
Given this week a session with 3 sets of 80 kg × 5 of one exercise and 2 sets of 60 kg × 10 of another
When I open Progreso and the choice is "Semana"
Then I see "Peso levantado" 2.400 kg, "Ejercicios" 2 and "Series" 5
```

```
AC-STA-05 · Month
Given sessions in two different weeks of the current month
When I choose "Mes"
Then the figures add both weeks and the chart shows months instead of weeks
```

```
AC-STA-06 · What does not add up
Given warm-up sets, sets without repetitions, bodyweight sets and an exercise marked "no cuenta"
When I look at the figures
Then warm-ups and empty sets are in no figure
And the weight of the marked exercise and of bodyweight sets is not in "Peso levantado"
And the marked exercise still counts in "Ejercicios" and "Series"
```

```
AC-STA-07 · Text equivalent
Given the chart of the card
When I open "Ver datos"
Then I get a table with one row per period with its weight, exercises, sets and sessions
```

```
AC-STA-08 · Language, theme and size
Given English and the dark theme on a 390 px screen
When I open Progreso and Hoy
Then every text of the card and of the streak is in English and nothing scrolls horizontally
```

## 6. Edge cases

- A new device or a first session today: the streak is 1 and the best streak 1.
- Several sessions in one week count once for the streak; they all count for the figures.
- A session registered on a past date counts in the week and month of that date.
- Deleted sessions and sets never count.
- A session without sets, or with only warm-ups, adds nothing to any figure and makes no week
  active.
- A month in progress is compared with nothing: its column is just lower until the month ends.

## 7. Out of scope

- Weight lifted **per routine**, session by session with the change between sessions (backlog v2:
  it needs rules for edited routines, deload weeks and free sessions).
- Goals ("train 4 days a week"), reminders and badges.
- Comparing the current period with the previous one as a percentage.
- Counting activities in the streak.
