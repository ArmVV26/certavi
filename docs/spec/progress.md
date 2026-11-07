# Progress

## 1. Purpose

**Progreso / Progress** (`/progress`) answers "am I doing what I planned, and is it working?":
sets per muscle group against the plan, sets per week, the evolution of one exercise, how fresh
the user arrives to train, a review of the training cycle, the latest records and body weight.
All of it is drawn with hand-written charts that work in light and dark mode and have a **text
equivalent** (§2.9). The exercise screen (`/exercises/:id`) gets an **Evolution** chart (§3).

Everything is computed from the data on the device; it works without coverage and updates by
itself when data changes (for example after a sync). Weeks, plans and closed weeks are described
in [calendar.md](calendar.md); sets, records and the 1RM in [rules.md](rules.md).

## 2. Screen

The page keeps the existing header (title "Progreso" / "Progress", sync indicator, theme button).
Below it, in this order: the summary (§2.1) and one card per section (§2.2 – §2.8). With **no
sessions at all** the page shows only the empty state "Todavía no hay datos" / "No data yet" with
the text "Cuando registres tu primera sesión, aquí verás tu progreso." / "Once you log your first
session, your progress will show up here." and the body-weight card if there is any weight.

### 2.1 Summary

Four figures in one row (they wrap on a narrow screen):

| Label (es / en)   | Value                                                   | Note (es / en)                        |
| ----------------- | ------------------------------------------------------- | ------------------------------------- |
| Semana / Week     | the week number of the plan (see "Cycle start" below)   | the range of the week, e.g. "2–8 nov" |
| Series / Sets     | "<done> / <planned>" effective sets of the current week | esta semana / this week               |
| Sesiones/Sessions | the number of sessions ever logged                      | en total / in total                   |
| Récords / Records | records set in the current month (§2.7)                 | este mes / this month                 |

**Cycle start.** The cycle starts on the Monday of week 1 of the plan (the `planStart` setting).
When it is not set, the cycle starts on the Monday of the week of the **first logged session**.
Without any session there is no cycle and the "Semana" figure is hidden.

### 2.2 Sets per muscle group

Heading **"Series por grupo muscular" / "Sets per muscle group"**. A choice of period (radio
group, legend "Periodo" / "Period"): **"Esta semana" / "This week"** (default), **"Semana pasada"
/ "Last week"**, **"Media de 4 semanas" / "4-week average"**.

- A subtitle with the period: "Semana 2–8 nov" / "Week 2 – 8 Nov" for a week; for the average
  "4 semanas: 26 oct–22 nov" / "4 weeks: 26 Oct – 22 Nov" (the four weeks before the current one). A week with
  hiking adds " · con senderismo" / " · with hiking", a deload week " · descarga" / " · deload".
- One bar per muscle group (the ten groups, always in the same order as the exercise filters:
  chest, back, shoulders, quads, hamstrings and glutes, triceps, biceps, calves, core, forearms),
  with the sets done and a mark at the planned sets. The bar is in the success colour when the
  plan is met (done ≥ planned and planned > 0). The numbers are shown next to the bar:
  "12 / 16". Averages have one decimal ("10,5 / 12").
- The **accessible name** of each row: "Pecho: 12 de 16 series" / "Chest: 12 of 16 sets".
- Legend: "Series hechas" / "Sets done", "Plan cumplido" / "Plan met", "Plan" / "Plan".
- The planned sets of a **closed** week are the ones frozen when it closed; those of an open week
  come from the current routines and the week options (see calendar.md §2.5). The average uses
  the same rule for each of its four weeks.

### 2.3 Sets per week

Heading **"Series por semana" / "Sets per week"**. Columns for the last **12 weeks** (the
current one included, oldest first) with the effective sets done and a mark at the sets planned
that week (not drawn for weeks before the cycle starts). The label under each column is the
Monday as "2/11". The **tooltip** of a column (its text equivalent is the table row of §2.9): "2–8 nov: 98 de 104 series, 5 sesiones" /
"2 – 8 Nov: 98 of 104 sets, 5 sessions" (without the plan: "2–8 nov: 98 series, 5 sesiones").
Legend: "Series hechas" / "Sets done", "Plan de esa semana" / "Plan of that week".

### 2.4 By exercise

Heading **"Por ejercicio" / "By exercise"**. A select **"Ejercicio" / "Exercise"** with the
exercises that have at least one session, sorted by name, and a link **"Ver ficha" /
"Open details"** to `/exercises/<id>`. The chosen exercise is remembered on this device. The first
time, it is the exercise with the most recent session.

- A line chart with one point per session (oldest first): the **best estimated 1RM of the session**
  (Epley, warm-up, approach and dropset sets ignored), subtitle "Mejor 1RM estimado de cada sesión
  (Epley)." / "Best estimated 1RM of each session (Epley)." For a **bodyweight** exercise the
  point is the total repetitions of the session, subtitle "Repeticiones totales por sesión." /
  "Total repetitions per session."
- Deload sessions are not drawn (they would look like a drop) and the subtitle says so when there
  are any: "Las semanas de descarga no se dibujan." / "Deload weeks are not drawn."
- With a single session the chart shows one point; with none, "Este ejercicio aún no tiene
  series." / "This exercise has no sets yet." (only reachable when no exercise has data, in which
  case the select is replaced by the text "Aún no hay ejercicios con series." / "No exercise has
  sets yet.").

### 2.5 How you arrive

Heading **"Cómo llegas a entrenar" / "How you arrive"**. A line chart: for each of the last 12
weeks with at least one answered "¿Cómo llegas?" (1 awful – 5 great, asked when a session
starts), the **average** of the week. Text: "Media semanal de la nota (1 fatal · 5 a tope) que
pones al empezar cada sesión." / "Weekly average of the 1 (awful) – 5 (great) score you give when a
session starts." Tooltip of a point: "2–8 nov: 3,5 de 5, 2 sesiones" / "2 – 8 Nov: 3.5
of 5, 2 sessions". Without any answer: "Aparecerá cuando marques «¿Cómo llegas?» en tus
sesiones." / "It will show up once you answer "How do you arrive?" in your sessions."

### 2.6 Cycle review

Heading **"Revisión del ciclo" / "Cycle review"**, followed by the date six weeks after the cycle
start ("· 14 dic" / "· 14 Dec"). It compares, for each **basic lift** (compound exercise that is
not bodyweight), the best estimated 1RM of the **first two weeks** of the cycle with the best of
the **last week** (from the Monday of the previous week up to today).

- Intro text: while the review date has not passed, "Faltan <n> días. Mientras tanto, esto compara
  tus 2 primeras semanas con la última:" / "<n> days to go. Meanwhile, this compares your first 2
  weeks with the last one:" ("Falta 1 día" / "1 day to go"); after it, "Comparación entre tus 2
  primeras semanas y la última (mejor 1RM estimado en cada básico):" / "Comparison of your first
  2 weeks and the last one (best estimated 1RM in each basic lift):".
- A table with the columns **Básico / Lift**, **Inicio / Start**, **Ahora / Now**, **Cambio /
  Change**: the exercise (a link to its details), the two 1RMs in kg and the change in percent
  with sign and one decimal ("+4,5 %"). Sorted by change, highest first. Deload sessions are
  ignored; a lift missing in either window is left out.
- Under the table: "<n> básicos suben · <m> planos o bajando" / "<n> lifts going up · <m> flat or
  going down" ("1 básico sube", "1 lift going up"; up = change above +1 %).
- When both windows have answers to "¿Cómo llegas?": "Cómo llegas: 3,2 las 2 primeras semanas →
  3,9 la última" / "How you arrive: 3.2 in the first 2 weeks → 3.9 in the last one", followed by
  " · mejor que al principio" / " · better than at the start" (difference ≥ +0.5), " · bajando:
  puede que estés acumulando fatiga" / " · going down: you may be piling up fatigue" (≤ −0.7) or
  " · estable" / " · steady".
- The rule of thumb is always shown: "Pesos que suben y llegas con ganas → sigue igual. Estancado y
  te notas plano → recorta volumen. Estancado pero fresco → falta estímulo." / "Weights going up
  and you arrive keen → keep going. Stalled and feeling flat → cut volume. Stalled but fresh →
  you need more stimulus."
- The review needs the last week not to overlap the first two, so it is available from the
  **fourth week** of the cycle; before that the table is replaced by "Aparecerá a partir de la
  cuarta semana, cuando haya datos del principio y de la última semana." / "It will appear from
  the fourth week, when there is data from the start and from the
  last week."

### 2.7 Latest records

Heading **"Últimos récords" / "Latest records"**. Up to **12** record events, newest first, from
all exercises: a session that beat the previous best **weight** or, when the weight did not
improve, the previous best **estimated 1RM** (the first session of an exercise only sets the
baseline; deload weeks, warm-ups, approach sets and bodyweight exercises never set records).
Each item is a link to the exercise (the date has the year, "3 nov 2026"): the name, "<date> · peso máximo" / "<date> · max weight" or
"<date> · 1RM estimado (80×5)" / "<date> · estimated 1RM (80×5)", and on the right "85 kg" with
"antes 82,5 kg" / "before 82.5 kg". Without records: "Los récords aparecen a partir de la
segunda sesión de cada ejercicio." / "Records show up from the second session of each exercise."

### 2.8 Body weight

Heading **"Peso corporal" / "Body weight"**. A line chart of the weekly body weight (one point per
week with a saved weight, oldest first) in kg. Tooltip of a point: "2–8 nov: 82,4 kg".
Without any weight: "Aún no hay peso guardado. Puedes añadirlo en Hoy o en el Calendario." /
"No weight saved yet. You can add it in Today or in the Calendar."

### 2.9 Charts: text equivalent

Every chart except the group bars (whose numbers are already on screen) is a figure with a heading, **a text description** (screen readers read what it shows:
"Series por semana: gráfica de columnas, 12 semanas, de 0 a 104 series") and a **"Ver datos" /
"Show data"** disclosure that opens a table with the exact values (the numbers
of the tooltips above, split in cells). The table is the way to read exact values, since charts do
not need a hover. Its rows are: weeks — week, sets, plan ("—" before the cycle), sessions, activity
minutes; how you arrive — week, average, sessions; body weight — week, kg (the number only);
evolution — date, value with its unit.
Colours come from the theme (light and dark), meaning is never carried by colour alone (the plan
is a mark, the plan met adds the text "plan cumplido" to the row's name) and the contrast meets AA.

## 3. Exercise screen — Evolution

On `/exercises/:id`, between the records and the history (only when the exercise has sessions), a
card **"Evolución" / "Evolution"** with:

- a choice **"Métrica" / "Metric"**: **"1RM estimado" / "Estimated 1RM"** (default), **"Peso
  máximo" / "Max weight"**, **"Volumen" / "Volume"**. For a **bodyweight** exercise the options
  are **"Repeticiones" / "Reps"** (total of the session) and **"Volumen" / "Volume"** (kg × reps).
- a line chart of that metric per session, oldest first: the 1RM and the max weight use the
  working sets that count for strength (no warm-up, approach or dropset); volume is kg × reps of
  every effective set. **Deload sessions are not drawn**, and neither are sessions with nothing to measure (value 0: for
  example the volume of a bodyweight exercise, whose sets weigh 0 kg). With nothing left to draw the
  card says "Aún no hay sesiones que dibujar con esta métrica." / "There are no sessions to draw with this metric yet."
- the same text equivalent and "Ver datos" table as §2.9, one row per session
  ("12 nov: 92,5 kg" / "12 Nov: 92.5 kg"; volume in kg).

## 4. Acceptance criteria

```
AC-PRO-01 · Empty page
Given no sessions on the device
When I open Progreso
Then I see "Todavía no hay datos" and no chart
```

```
AC-PRO-02 · Summary
Given 3 sessions, one of them this week with 12 effective sets and a plan of 104
When I open Progreso
Then "Sesiones" shows 3 "en total"
And "Series" shows "12 / 104" "esta semana"
```

```
AC-PRO-03 · Sets per group against the plan
Given this week I did 12 effective chest sets and the plan has 16
When I open Progreso
Then the chest row reads "Pecho: 12 de 16 series"
And a group with done ≥ planned > 0 reads "plan cumplido"
```

```
AC-PRO-04 · Period of the groups
Given sessions this week and last week
When I choose "Semana pasada"
Then the subtitle shows last week's range
And the rows show last week's sets and its plan
When I choose "Media de 4 semanas"
Then the rows show the average of the four weeks before the current one, with one decimal
```

```
AC-PRO-05 · Closed weeks use their frozen plan
Given a closed week whose routine was edited afterwards
When I look at that week (last week)
Then the plan is the one frozen when it closed
```

```
AC-PRO-06 · Sets per week
Given sessions in two different weeks
When I open Progreso
Then the weekly chart has 12 columns
And the column of a week reads "<range>: <done> de <plan> series, <n> sesiones"
```

```
AC-PRO-07 · Exercise evolution
Given 3 sessions of "Press banca" and one deload session
When I pick "Press banca" in "Por ejercicio"
Then the chart has 3 points (the deload session is not drawn)
And "Ver datos" lists each session with its best 1RM
And the pick is still there after reloading
```

```
AC-PRO-08 · How you arrive
Given sessions answered 3 and 4 in the same week
When I open Progreso
Then the chart has one point for that week reading "<range>: 3,5 de 5, 2 sesiones"
```

```
AC-PRO-09 · Cycle review
Given the cycle started 4 weeks ago, Push 1RM 100 kg in the first two weeks and 105 kg last week
When I open Progreso
Then "Revisión del ciclo" lists the lift with 100, 105 and "+5,0 %"
And "1 básico sube · 0 planos o bajando" is shown
```

```
AC-PRO-10 · Review not available yet
Given the cycle started less than 3 weeks ago (we are still in its third week)
When I open Progreso
Then the review shows "Aparecerá a partir de la cuarta semana…" and no table
```

```
AC-PRO-11 · Latest records
Given an exercise whose second session beat the weight of the first
When I open Progreso
Then "Últimos récords" lists it as a max-weight record with the weight and "antes <previous>"
And a deload session never appears there
```

```
AC-PRO-12 · Body weight
Given weights saved in 3 weeks
When I open Progreso
Then the body weight chart has 3 points and "Ver datos" lists them in kg
```

```
AC-PRO-13 · Text equivalent
Given any chart
When I use a screen reader or open "Ver datos"
Then I get a description of the chart and a table with its exact values
```

```
AC-PRO-14 · Evolution in the exercise screen
Given an exercise with sessions
When I open its screen and choose "Peso máximo", then "Volumen"
Then the chart and its table change to that metric
And a bodyweight exercise offers "Repeticiones" and "Volumen" instead
```

```
AC-PRO-15 · Language, theme and size
Given English and the dark theme on a 390 px screen
When I open Progreso
Then every text is in English, charts keep readable colours and nothing scrolls horizontally
```

## 5. Edge cases

- No cycle start saved: the first logged session sets it (§2.1). The review works the same.
- Sessions with a routine that no longer exists or free sessions: they count in sets, weekly
  charts and records like any other.
- Sessions marked "does not count" for an exercise (machine busy…) are drawn in the exercise
  charts (they are real data) but never decide progression; records follow the rules of
  [rules.md](rules.md).
- Deleted sessions and sets never count. Sets with 0 repetitions and warm-ups are not effective.
- A week with several routines of the same day or an activity-only week: activities do not count
  as sets; they only show in the accessible name of the weekly column when there are minutes
  ("…, 90 min de actividad" / "…, 90 min of activity").
- Offline and reload: the page reads the device only.
- Very long histories: weekly charts only look at the last 12 weeks; records and evolution look
  at the whole history.

## 6. Out of scope

- Editing data from Progreso (it is read-only).
- Weight lifted per week or month and the workout streak: see
  [training-stats.md](training-stats.md) (the "Entrenamiento" card of this screen). Weight per
  routine is not done yet (backlog).
- Comparing cycles, exporting a cycle summary and weekly measures of optional blocks
  (see [blocks.md](blocks.md) when it exists).
- Charts of muscle measures or photos.
