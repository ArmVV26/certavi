# Today

## 1. Purpose

**Hoy / Today** (`/`) is the screen the user opens in the gym. It says what is planned for the
day (a routine or a rest day), starts or continues that session, lets the user start another
routine, a **free session** or a session on another date, and records the small things of the
day: an activity, the week's average body weight and the **optional blocks of the day**
(mobility, stretching, rehab checklist and pain metrics). It also shows the week at a glance and
the switches that change the whole week: number of sessions, hiking week and deload week.

Everything is saved on the device first and works without coverage (see [sync.md](sync.md)).

The session screen itself is described in `session.md` (Phase 5, next branch). In this branch,
opening a session shows its plan only (§2.8).

## 2. Screens and elements

Texts are given as "Spanish" / "English". Dates and numbers follow the language: Spanish uses a
decimal comma ("76,5") and day-month order ("2–8 nov"); English uses a decimal point ("76.5")
and British order ("2 – 8 Nov"). Date ranges use the spaces the browser puts around the dash.

The page keeps the existing header (title "Hoy" / "Today", sync indicator, theme button) and the
date line at the top (e.g. "miércoles, 4 de noviembre" / "Wednesday 4 November"). Below it, in
this order: notices (§2.1), "La sesión de hoy" (§2.2), the blocks of the day (§2.3), "Esta
semana" (§2.4), "Otra sesión u otro día" (§2.5), "Actividad" (§2.6) and "Peso medio de la
semana" (§2.7).

### 2.1 Notices

Shown above everything else, only when they apply:

- **No sync key on this device**: "Este dispositivo aún no tiene la clave de sincronización: lo
  que apuntes se queda solo aquí." / "This device has no sync key yet: what you log stays only
  here." with a link **"Ponerla en Ajustes" / "Set it in Settings"** to `/settings`.
- **Six or more weeks without a deload** (and the current week is not a deload week): "Llevas
  <n> semanas sin descarga. Lo recomendado es una cada 6-8: márcala abajo cuando te venga
  bien." / "<n> weeks without a deload. One every 6–8 weeks is recommended: turn it on below
  when it suits you." The count is the number of full weeks in a row, before the current one,
  with at least one session since the last deload week.

### 2.2 "La sesión de hoy" / "Today's session"

A card with the heading **"La sesión de hoy" / "Today's session"**.

**What is planned for each day.** The week has five routines on fixed days. The week's size and
the hiking switch (§2.4) change it:

| Day       | Normal week (5)               | 4 sessions              | 3 sessions              |
| --------- | ----------------------------- | ----------------------- | ----------------------- |
| Monday    | Push                          | Push                    | Push                    |
| Tuesday   | Pull                          | Pull                    | Pull                    |
| Wednesday | Lower B                       | Lower B                 | **Lower Full**          |
| Thursday  | Descanso activo / Active rest | Descanso activo         | Descanso activo         |
| Friday    | Upper                         | **Descanso / Rest day** | **Descanso / Rest day** |
| Saturday  | Fútbol / Football             | Fútbol                  | Fútbol                  |
| Sunday    | Lower A                       | Lower A                 | **Descanso / Rest day** |

With **hiking** on (as in gym_app): Sunday becomes **"Senderismo" / "Hiking"** (Lower A is
dropped) and Wednesday becomes **Lower Full** (instead of Lower B). A normal week then has 4
sessions (Push, Pull, Lower Full, Upper, 86 sets); with 4 sessions it has 3 (Push, Pull, Lower
Full, 63 sets); with 3 sessions only Sunday changes. A dropped routine can still be started from
§2.5.

**A routine day** shows:

- the routine name in large type (e.g. "Push");
- a summary "<n> ejercicios · <m> series" / "<n> exercises · <m> sets" — the sets the session
  will have (in a deload week, the reduced ones);
- the label **"Senderismo" / "Hiking"** when the hiking switch is on and **"Descarga" /
  "Deload"** when the deload switch is on;
- the main button, depending on what was done today with that routine:
  - nothing yet: **"Empezar <routine>" / "Start <routine>"**;
  - a session started and not finished: **"Continuar <routine>" / "Continue <routine>"**;
  - a finished session: **"Sesión hecha · ver o corregir" / "Session done · view or edit"**.

  Each one opens the session screen (§2.8). "Empezar" creates the session first.

- a disclosure **"Ver los ejercicios" / "See the exercises"** that lists, without starting, each
  exercise with its sets: "Press inclinado con mancuernas · 3 series" / "… · 3 sets", and
  "(opcional)" / "(optional)" on optional exercises.

**A rest day** shows its name and a short note:

| Rest day (es / en)            | Note (es)                                                                          | Note (en)                                                                 | Quick activities    |
| ----------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------- |
| Descanso activo / Active rest | Natación o movilidad. No correr.                                                   | Swimming or mobility. No running.                                         | Natación, Movilidad |
| Fútbol / Football             | Partido (+ natación si cuadra).                                                    | Match (+ a swim if it fits).                                              | Fútbol, Natación    |
| Senderismo / Hiking           | Semana de senderismo. Ojo: las bajadas cargan cuádriceps y gemelo, no es descanso. | Hiking week. Careful: the descents load quads and calves, it is not rest. | Senderismo          |
| Descanso / Rest day           | Hoy no toca rutina.                                                                | No routine today.                                                         | —                   |

Each quick activity is a button **"+ <activity>"** (e.g. "+ Natación" / "+ Swimming"). It
selects that activity in the "Actividad" card (§2.6) and moves the focus to its "Minutos" field.

**Other sessions of today.** For every other session dated today, a line **"También hoy:
<routine> (en curso)" / "Also today: <routine> (in progress)"** — "(hecha)" / "(done)" when
finished — whose routine name is a link to that session. A free session reads "Sesión libre" /
"Free session".

### 2.3 Blocks of the day

For every **active** optional block planned for today's weekday that has items or metrics, a
card with the block's name as heading (seed data: **"Rehabilitación del tobillo" / "Ankle
rehab"**, active every day; "Estiramientos" is inactive and empty, so it does not appear).
The card shows:

- when the block has a review date today or later: **"Revisión: <date> (en <n> días)" /
  "Review: <date> (in <n> days)"**, "(mañana)" / "(tomorrow)" for 1 day, or **"Revisión hoy" /
  "Review today"**;
- a checklist **"Ejercicios · <done>/<total>" / "Exercises · <done>/<total>"**: one checkbox per
  item with its name and its dose (e.g. "Rodillo en gemelo" — "2 × 30 s por pierna"); items done
  only some days add " · 3-5 días por semana" / " · 3-5 days a week";
- one **0–10 scale** per metric, labelled with the metric name ("Dolor al bajar escaleras",
  "Dolor máximo en los ejercicios", "Dolor en pogos" / "Pain going down stairs", "Maximum pain
  during the exercises", "Pain during pogos"). It is a group of eleven toggle buttons 0…10; the
  chosen one is pressed. Tapping the pressed value again clears it. Values above the metric's
  threshold (3) are drawn as a warning, and while any metric is above it the card shows
  **"Por encima de 3/10: baja la intensidad de lo que cargue la zona." / "Above 3/10: go easier
  on whatever loads that area."**;
- a text field **"Nota del día" / "Note for the day"**, saved when the field loses focus, with
  the toast **"Nota guardada" / "Note saved"**.

Every tick and every value is saved at once for today (one record per block and day).

### 2.4 "Esta semana" / "This week"

A card with the heading **"Esta semana" / "This week"** followed by the week range (Monday to
Sunday, e.g. "2–8 nov" / "2 – 8 Nov"). When a plan start date is set (a synced setting, no screen
to set it yet) it also shows "Semana <n>" / "Week <n>".

- **Days of the week**: a list of the seven days, Monday first. Each day shows its short name
  ("lun" / "Mon"), the plan of that day (routine name, or the rest day name: "Activo" /
  "Active", "Fútbol" / "Football", "Monte" / "Hike", "Descanso" / "Rest") and a check mark when
  something was done that day. When there are sessions that day the label is the routine name
  of each session ("Push + Pull"); otherwise, when there is an activity that day, the
  activity's name. Today is marked as the current date. A day with exactly one session is a link
  to that session. The accessible name of each day reads like "lunes 2: Push, hecho" / "Monday
  2: Push, done".
- **Two figures**:
  - **"Series efectivas" / "Effective sets"**: "<done> / <planned>" — effective sets logged this
    week (warm-ups and 0-rep sets do not count; see [rules.md](rules.md)) against the planned
    sets of the week (104 in a normal week, 81 with 4 sessions, 63 with 3, 86 in a hiking week,
    fewer in a deload week);
  - **"Sesiones" / "Sessions"**: "<n> de <planned>" / "<n> of <planned>" — sessions logged this
    week against the days with a routine (5, 4 or 3; one fewer in a hiking week of 5 or 4).
- **"Sesiones esta semana" / "Sessions this week"**: a choice of **5 · 4 · 3**, with the hint
  "Con 4 se cae el Upper; con 3: Push, Pull y Lower Full." / "With 4, Upper is dropped; with 3:
  Push, Pull and Lower Full."
- Switch **"Semana con senderismo" / "Hiking week"**, description "Para toda la semana: el
  miércoles pasa a Lower Full y el domingo es monte." / "For the whole week: Wednesday becomes
  Lower Full and Sunday is hiking."
- Switch **"Semana de descarga" / "Deload week"**. Description when off: "Mitad de series y RIR
  3-4." / "Half the sets and RIR 3-4." plus, when there is at least one week, " Llevas <n>
  semanas seguidas sin descargar." / " <n> weeks in a row without a deload." ("1 semana
  seguida" / "1 week in a row"). Description when on: "Activa: las sesiones nuevas salen con la
  mitad de series y RIR 3-4. No cuentan para récords." / "On: new sessions get half the sets
  and RIR 3-4. They do not count for records." Turning it on shows the toast **"Semana de
  descarga: las sesiones nuevas salen reducidas" / "Deload week: new sessions come out
  reduced"**; turning it off, **"Semana normal" / "Normal week"**.

The three settings belong to the current week (one record per week) and sync. They change what
§2.2 proposes and the planned sets at once. They do **not** change sessions already started:
a session keeps the plan it was created with.

### 2.5 "Otra sesión u otro día" / "Another session or day"

A card with the heading **"Otra sesión u otro día" / "Another session or day"**:

- a date field **"Fecha" / "Date"**, today by default; the latest date allowed is today;
- a hint: on today, "Elige qué entrenaste. Sirve para cambiar el orden hoy o para apuntar un
  día que se te olvidó." / "Choose what you trained. Use it to change today's order or to log a
  day you forgot."; on another date, "Se registrará el <date>. Sin temporizador; podrás ajustar
  la hora." / "It will be logged on <date>. No timer; you can adjust the time.";
- one button per routine (Push, Pull, Lower B, Upper, Lower A, Lower Full — routines with a day
  in weekday order, then the others) and a last one **"Sesión libre" / "Free session"**.

Tapping one:

- with a date after today: nothing is created and the date field shows **"No se puede registrar
  en el futuro." / "You can't log a future date."**;
- when a session with that routine (or a free session, for "Sesión libre") already exists on that
  date: it opens that session and shows the toast **"Ya había una sesión «<routine>» ese día: la
  abro." / "There was already a “<routine>” session that day: opening it."**;
- otherwise it creates the session and opens it. A routine session copies the routine's
  exercises and sets (reduced if that date's week is a deload week); a **free session starts
  with no exercises**. A session for today starts now and is in progress; a session for another
  date is created as finished, from 18:00 to 19:15 of that date.

### 2.6 "Actividad" / "Activity"

A card with the heading **"Actividad" / "Activity"**:

- a group **"Tipo de actividad" / "Activity type"** of toggle buttons: Fútbol, Natación,
  Senderismo, Movilidad, Bici, Otro / Football, Swimming, Hiking, Mobility, Cycling, Other. One
  is always selected: on a rest day, the first quick activity of the day (§2.2); otherwise
  Fútbol / Football;
- a number field **"Minutos" / "Minutes"** (optional, whole minutes, 0–1440);
- a text field **"Nota" / "Note"** (optional, placeholder "Opcional" / "Optional");
- a button **"Guardar actividad de hoy" / "Save today's activity"**. It saves the activity for
  today, shows the toast **"Actividad guardada: <activity>" / "Activity saved: <activity>"** and
  empties the fields;
- when there are activities today, a line **"Hoy: Natación 45 min · Fútbol" / "Today: Swimming
  45 min · Football"**, in the order they were saved (minutes only when more than 0).

Activities on other days are logged from the calendar (Phase 7).

### 2.7 "Peso medio de la semana" / "Average weekly weight"

A card with the heading **"Peso medio de la semana" / "Average weekly weight"**:

- a group **"Semana" / "Week"** with two toggle buttons: **"Esta semana · <range>" / "This week
  · <range>"** (selected by default) and **"Semana pasada · <range>" / "Last week · <range>"**;
- a number field **"Peso medio" / "Average weight"** in kg (decimal comma in Spanish), showing
  the value saved for the selected week, if any. When empty, its placeholder is the latest
  value saved before that week;
- a button **"Guardar peso" / "Save weight"**. A value outside 20–300 kg is not saved and the
  field shows **"Escribe un peso entre 20 y 300 kg." / "Enter a weight between 20 and 300
  kg."**. Otherwise it saves the week's value (replacing the previous one) and shows the toast
  **"Peso guardado · <range>" / "Weight saved · <range>"**;
- when there is a value before the selected week: **"Último dato anterior (<range>): <kg> kg"
  / "Previous entry (<range>): <kg> kg"**.

Older weeks are edited from the calendar (Phase 7).

### 2.8 Session screen (`/session/<id>`, this branch only)

Header title **"Sesión" / "Session"**. It shows:

- the routine name as heading, or **"Sesión libre" / "Free session"**;
- the session date and start time (e.g. "miércoles, 4 de noviembre · 18:00");
- the label **"En curso" / "In progress"** or **"Terminada" / "Finished"**;
- **"Plan"** with "<n> ejercicios · <m> series" / "<n> exercises · <m> sets" and the list of
  exercises with their sets ("Remo en T · 3 series"); a free session says **"Sin ejercicios
  todavía." / "No exercises yet."**;
- the label "Próximamente" / "Coming soon" with "Registrar series, temporizador y notas." /
  "Logging sets, rest timer and notes." (until `session.md` is implemented).

An unknown or deleted session id shows **"Sesión no encontrada" / "Session not found"** and a
link **"Volver a Hoy" / "Back to Today"**.

## 3. Acceptance criteria

Dates use the seed routines and a fresh install unless stated. "Today is …" means the device
date.

**AC-TODAY-01 · Proposed routine by weekday**
Given today is Monday 2 November 2026
When I open Today
Then "La sesión de hoy" shows "Push" with "7 ejercicios · 19 series" and the button "Empezar Push"
And on Tuesday 3 November it shows "Pull" and on Wednesday 4 November "Lower B".

**AC-TODAY-02 · Rest days**
Given today is Thursday 5 November 2026
Then "La sesión de hoy" shows "Descanso activo", "Natación o movilidad. No correr." and the
buttons "+ Natación" and "+ Movilidad"
When I tap "+ Movilidad"
Then "Movilidad" is selected in "Actividad" and the "Minutos" field has the focus
And on Saturday 7 November the rest day is "Fútbol".

**AC-TODAY-03 · Start, continue and done**
Given today is Monday 2 November 2026
When I tap "Empezar Push"
Then the session screen opens with heading "Push", "En curso" and "7 ejercicios · 19 series"
When I go back to Today
Then the button reads "Continuar Push" and opens the same session
And after a reload the button still reads "Continuar Push".

**AC-TODAY-04 · Free session**
Given today is any day
When I tap "Sesión libre" in "Otra sesión u otro día"
Then a session opens with heading "Sesión libre", "En curso" and "Sin ejercicios todavía."
And back on Today, "Esta semana" counts 1 session.

**AC-TODAY-05 · Another routine today**
Given today is Monday 2 November 2026
When I tap "Pull" in "Otra sesión u otro día"
Then a "Pull" session for today opens
And back on Today, "La sesión de hoy" still offers "Empezar Push" and shows "También hoy: Pull
(en curso)" with a link to that session.

**AC-TODAY-06 · Log a past day**
Given today is Wednesday 4 November 2026
When I set "Fecha" to 2 November 2026
Then the hint reads "Se registrará el lunes, 2 de noviembre. Sin temporizador; podrás ajustar la hora."
When I tap "Push"
Then a "Push" session opens dated Monday 2 November, from 18:00, "Terminada"
When I go back to Today, set the date to 2 November again and tap "Push"
Then the same session opens with the toast "Ya había una sesión «Push» ese día: la abro."
And the Monday of "Esta semana" shows a check mark.

**AC-TODAY-07 · No future dates**
Given today is Wednesday 4 November 2026
When I set "Fecha" to 5 November 2026 and tap "Push"
Then no session is created and the field shows "No se puede registrar en el futuro."

**AC-TODAY-08 · Short weeks**
Given today is Friday 6 November 2026
When I choose "4" in "Sesiones esta semana"
Then "La sesión de hoy" shows the rest day "Descanso" and "Series efectivas" reads "0 / 81"
When I choose "3"
Then "Series efectivas" reads "0 / 63"
And on Wednesday of that week the plan is "Lower Full".

**AC-TODAY-09 · Hiking week**
Given today is Wednesday 4 November 2026 ("La sesión de hoy" shows "Lower B")
When I turn on "Semana con senderismo"
Then "La sesión de hoy" shows "Lower Full" with the label "Senderismo"
And the Sunday of "Esta semana" reads "Monte"
And "Series efectivas" reads "0 / 86" and "Sesiones" "0 de 4"
And the switch is still on after a reload.

**AC-TODAY-10 · Deload week**
Given today is Monday 2 November 2026
When I turn on "Semana de descarga"
Then the toast "Semana de descarga: las sesiones nuevas salen reducidas" appears
And "La sesión de hoy" shows "Push" with the label "Descarga" and fewer sets than 19
And "Series efectivas" shows the deload plan
When I tap "Empezar Push"
Then the session has the reduced sets.

**AC-TODAY-11 · Deload reminder**
Given sessions logged in each of the six weeks before the current one and no deload week
When I open Today
Then the notice "Llevas 6 semanas sin descarga. …" is shown
And it disappears when I turn on "Semana de descarga".

**AC-TODAY-12 · Activity**
Given today is any day
When I choose "Natación", type 45 in "Minutos" and tap "Guardar actividad de hoy"
Then the toast "Actividad guardada: Natación" appears
And the card shows "Hoy: Natación 45 min"
And today in "Esta semana" shows a check mark.

**AC-TODAY-13 · Average weight, this week and last week**
Given no weight saved
When I type "76,4" in "Peso medio" and tap "Guardar peso"
Then the toast "Peso guardado · <this week's range>" appears and the field keeps "76,4"
When I choose "Semana pasada"
Then the field is empty with the placeholder of the latest earlier value (none here)
When I type "77" and save, then choose "Esta semana"
Then the field shows "76,4" and "Último dato anterior (<last week's range>): 77 kg" is shown.

**AC-TODAY-14 · Invalid weight**
When I type "12" in "Peso medio" and tap "Guardar peso"
Then nothing is saved and the field shows "Escribe un peso entre 20 y 300 kg."

**AC-TODAY-15 · Blocks of the day**
Given the seed block "Rehabilitación del tobillo" is active
When I open Today
Then its card shows "Ejercicios · 0/8" and three 0–10 scales
When I tick "Rodillo en gemelo" and choose 4 in "Dolor al bajar escaleras"
Then the checklist reads "Ejercicios · 1/8", 4 is pressed and the warning "Por encima de 3/10:
baja la intensidad de lo que cargue la zona." is shown
When I reload
Then the tick and the 4 are still there
When I tap 4 again
Then no value is pressed and the warning is gone.

**AC-TODAY-16 · Offline**
Given the device is offline
When I start a session from Today, save an activity and a weight, and reload the page
Then everything is still there and the sync indicator shows changes waiting.

**AC-TODAY-17 · English and dark mode**
Given the app is in English and dark mode
Then Today reads "Today's session", "This week", "Another session or day", "Activity" and
"Average weekly weight", numbers use a decimal point
And the axe check finds no violations, in light and dark.

**AC-TODAY-18 · No sync key**
Given a device without a sync key
Then Today shows the notice "Este dispositivo aún no tiene la clave de sincronización: …"
whose link "Ponerla en Ajustes" opens Settings.

**AC-TODAY-19 · Unknown session**
When I open `/session/does-not-exist`
Then the page shows "Sesión no encontrada" and a link "Volver a Hoy" back to Today.

## 4. Edge cases

- **Reload in the middle**: everything on Today is saved when tapped (ticks, values, switches)
  or when the save button is pressed; what is typed but not saved in the activity and weight
  fields is lost on reload (it survives re-renders, e.g. when sync brings changes).
- **Two devices**: the week switches, the weight and the block log are one record each per week
  or day; the most recent change wins.
- **Midnight**: Today follows the device date when the app comes back to the foreground.
- **0 minutes**: an activity without minutes is saved with 0 and shown without minutes.
- **Comma or point**: "76,4" and "76.4" are both accepted in either language.
- **Small screen (390×844)**: no horizontal scroll; the day list fits in one row.

## 5. Out of scope

- Logging sets, timer, notes, readiness, editing or deleting a session (`session.md`).
- Configuring blocks, block charts and the weekly wall test (Phase 7, `blocks.md`).
- Setting the plan start date; editing activities and weights of older weeks (Phase 7).
- The routine viewer and editor (Phase 6).
