# Calendar

## 1. Purpose

**Calendario / Calendar** (`/calendar`) shows a month at a glance — which days had a session or an
activity and which weeks were special (deload, hiking, short) — and lets the user look back at any
day or week, **log something on a past day** (a session or an activity), edit the **body weight of
any week**, change the options of a week that is not closed yet, and download the **JSON of a
week**.

Weeks are **closed** automatically once they are over: their planned sets are frozen, so changing
a routine later never changes the history (§2.5).

Everything is saved on the device first and works without coverage (see [sync.md](sync.md)).
The session screen is described in [session.md](session.md); the switches of the current week,
the activity and weight forms in [today.md](today.md).

## 2. Screens and elements

Texts are given as "Spanish" / "English". Dates follow the language: Spanish "2–8 nov",
"noviembre de 2026"; English "2 – 8 Nov", "November 2026". Numbers use a decimal comma / point.

The page keeps the existing header (title "Calendario" / "Calendar", sync indicator, theme
button). Below it, in this order: the month bar (§2.1), the month grid (§2.2), the month summary
(§2.3) and — only when a day or a week is selected — one panel: the day panel (§2.4) or the week
panel (§2.5). On first load nothing is selected.

### 2.1 Month bar

- **"Mes anterior" / "Previous month"** and **"Mes siguiente" / "Next month"** icon buttons.
- The month and year as a heading: "noviembre de 2026" / "November 2026".
- **"Ir a hoy" / "Go to today"** button, shown only when the visible month is not the current one;
  it shows the current month and selects today.

The user can browse to any month, past or future. The visible month survives a re-render (for
example when sync brings changes) but not a reload: the page always opens on the current month.

### 2.2 Month grid

- A header row with the weekday initials, Monday first: "L M X J V S D" / "M T W T F S S".
- One row per week that touches the month (4 to 6 rows). Each row has:
  - a **week button** at its start. Its accessible name is **"Semana <range>" / "Week <range>"**
    (e.g. "Semana 2–8 nov"), followed by the special markers of that week, separated by " · ":
    **"Descarga" / "Deload"**, **"Senderismo" / "Hiking"** and, for a short week,
    **"4 sesiones" / "4 sessions"** or **"3 sesiones" / "3 sessions"**. Example:
    "Semana 9–15 nov · Descarga · 4 sesiones". Visually the markers are compact (one letter or
    icon each); a week without markers has none. A **closed** week (§2.5) adds " · Cerrada" /
    " · Closed" to the name.
  - seven **day cells**, each a button. Days of the previous and next month that complete the
    first and last rows are shown dimmed and are selectable too.
- A day cell shows the day number and, below it, one mark per kind of content: a filled mark when
  there is **at least one session** that day (a second one, when there is more than one) and a
  different mark when there is **at least one activity**. Today has a ring.
- The accessible name of a cell is the long date plus its content: "miércoles, 4 de noviembre,
  1 sesión, 1 actividad" / "Wednesday 4 November, 1 session, 1 activity"; with nothing logged:
  "…, sin registros" / "…, nothing logged". Today's cell has `aria-current="date"`, the selected
  one `aria-pressed="true"`.
- Pressing a cell selects that day (§2.4); pressing it again unselects it. Pressing a week
  button selects that week (§2.5); only one thing is selected at a time.
- The grid fits a 390 px screen with no horizontal scroll.

### 2.3 Month summary

One line under the grid: **"<n> sesiones · <m> actividades" / "<n> sessions · <m> activities"**
counting what falls inside the visible month only (not the dimmed days). Singular for 1
("1 sesión", "1 session"). With nothing logged: "Nada registrado este mes" / "Nothing logged this
month".

### 2.4 Day panel

A card whose heading is the long date ("miércoles, 4 de noviembre" / "Wednesday 4 November") and a
button **"Cerrar" / "Close"** that unselects the day. It contains:

- **Plan**: "Plan: <routine>" / "Plan: <routine>" (e.g. "Plan: Push") or the kind of rest day
  ("Plan: Descanso activo", "Plan: Fútbol", "Plan: Senderismo", "Plan: Descanso" / "Plan: Active
  rest", "Plan: Football", "Plan: Hiking", "Plan: Rest day"). It follows the options of the week
  that contains the day (§2.5) and the current routines' days.
- **Sessions** of the day, a list. Each item is a link to `/session/<id>` with the routine name
  (or "Sesión libre" / "Free session"), its state — **"En curso" / "In progress"** or
  **"Terminada" / "Finished"** — and "<n> series" / "<n> sets" (effective sets logged: warm-ups and sets without reps are not
  counted). Without
  sessions: "Sin sesiones" / "No sessions".
- **Activities** of the day: "Fútbol 60 min" / "Football 60 min", plus the note if there is
  one. Without activities: "Sin actividades" / "No activities".
- **"Registrar en este día" / "Log on this day"**, only for today and past days (never for a
  future day, which shows "No se puede registrar en el futuro." / "You can't log in the future."
  instead):
  - **Session**: a group of buttons, one per routine plus **"Sesión libre" / "Free session"**.
    Pressing one opens (or creates, as in Today "Otra sesión u otro día") that session dated that
    day and navigates to `/session/<id>`. If one already exists for that routine and day, it is
    opened and the toast "Ya había una sesión «<routine>» ese día: la abro." /
    "There was already a session «<routine>» that day: opening it." appears — the same behaviour
    and texts as Today.
  - **Activity**: the same form as Today's "Actividad" (kind chips, "Minutos" / "Minutes", "Nota" /
    "Note", **"Guardar actividad" / "Save activity"**) saving on the selected day. After saving, the
    toast "Actividad guardada: <activity>" / "Activity saved: <activity>" appears, the form clears, and the cell and the
    list show the new activity.

### 2.5 Week panel

A card with the heading **"Semana <range>" / "Week <range>"** (followed by "· Semana <n>" /
"· Week <n>" when a plan start date exists) and a **"Cerrar" / "Close"** button. It contains:

- **Figures**: "Series efectivas" / "Effective sets" as "<done> / <planned>" and "Sesiones" /
  "Sessions" as "<done> de <size>" / "<done> of <size>" — same meaning as in Today's "Esta semana".
  For a closed week the planned number is the frozen one.
- **Options of the week**, the same three controls as Today — "Sesiones" (3/4/5 selector),
  "Semana con senderismo" and "Semana de descarga" (and their hints) — for the **current week and
  past weeks that are not closed**. They behave as in Today (including the deload toast).
  - In a **closed** week they are shown read-only (disabled) with the note **"Semana cerrada: el
    plan quedó guardado el <date>." / "Week closed: the plan was saved on <date>."**
  - In a **future** week they are shown read-only with **"Todavía no puedes cambiar esta semana."
    / "You can't change this week yet."**
- **"Peso medio de la semana" / "Average weekly weight"**: the same field and **"Guardar peso" /
  "Save weight"** button as in Today, for this week, with the previous week's value as
  placeholder and the "Antes: …" line. Works for the current and any past week (closed or
  not). For a future week the form is replaced by the same message as the options.
- **"Descargar JSON de la semana" / "Download the week as JSON"**: downloads
  `certavi-week-<monday>.json` with that week's plan, weight, sessions with their sets and notes,
  activities, block logs and weekly metrics (same file as `exportWeek`; no sync key or secret
  inside).

#### Closing a week

A week is **closed** when it is over (its Sunday is before today). Closing stores the planned sets
per muscle group of that week, computed with the week's options and the routines **at the moment
of closing**, and the closing time. Weeks are closed:

- when the app starts and whenever the date changes (also when the app comes back to the
  foreground on a new day), for every week that is already over, is not closed yet and has data
  (a session, an activity or a week record).

A closed week's planned sets never change afterwards, even if a routine is edited or restored. A
week with no record gets the default options (5 sessions, no hiking, no deload) when closed. The
current week and future weeks are never closed. Closing syncs like any other write (the most
recent write wins, as for every record).

## 3. Acceptance criteria

**AC-CAL-01 · Opens on the current month**
Given today is Wednesday 4 November 2026
When I open `/calendar`
Then the heading of the month bar reads "noviembre de 2026"
And no "Ir a hoy" button is shown
And the cell "miércoles, 4 de noviembre…" has `aria-current="date"`
And no day or week panel is shown.

**AC-CAL-02 · Navigate months**
When I press "Mes anterior"
Then the heading reads "octubre de 2026" and the button "Ir a hoy" appears
When I press "Ir a hoy"
Then the heading reads "noviembre de 2026" again and today's day panel is shown (§2.4).

**AC-CAL-03 · Marks per day**
Given a finished Push session on 2 Nov and a football activity on 4 Nov
When I look at November
Then the cell of 2 Nov is named "lunes, 2 de noviembre, 1 sesión" and the cell of 4 Nov
"miércoles, 4 de noviembre, 1 actividad" (only the kinds that exist are named, §2.2)
And a day without anything is named "…, sin registros".

**AC-CAL-04 · Month summary**
Given the data of AC-CAL-03 only
Then the summary reads "1 sesión · 1 actividad"
And in a month without data it reads "Nada registrado este mes".

**AC-CAL-05 · Special weeks**
Given the week of 9 Nov has deload on, size 4 and the week of 16 Nov has hiking on
Then the week button "Semana 9–15 nov · Descarga · 4 sesiones" exists
And the week button "Semana 16–22 nov · Senderismo" exists
And a normal week's button is just "Semana 2–8 nov".

**AC-CAL-06 · Day detail**
When I press the cell of a day with a finished Push session and a 60-minute football activity
Then a panel with the long date shows "Plan: Push", the session link "Push · Terminada · 12 series"
and "Fútbol 60 min"
When I press the session link
Then the session screen of that session opens.

**AC-CAL-07 · Empty day and unselect**
When I press a day with nothing logged
Then the panel shows "Sin sesiones" and "Sin actividades"
When I press "Cerrar" (or the same cell again)
Then the panel disappears and no cell has `aria-pressed="true"`.

**AC-CAL-08 · Log a session on a past day**
Given today is 4 Nov and no session exists on 2 Nov
When I select 2 Nov and press "Pull" under "Registrar en este día"
Then the session screen of a Pull session dated 2 Nov opens
When I go back to the calendar and select 2 Nov
Then the panel lists a "Pull" session of that day
And pressing "Pull" again opens that same session and shows the toast "Ya había una sesión «Pull»
ese día: la abro.".

**AC-CAL-09 · Log an activity on a past day**
When I select 3 Nov, choose "Natación", enter 45 minutes and press "Guardar actividad"
Then the toast "Actividad guardada: Natación" appears, the minutes field is empty
And the day panel lists "Natación 45 min" and the cell of 3 Nov counts 1 activity.

**AC-CAL-10 · No logging in the future**
When I select a day after today
Then the panel shows the plan and "No se puede registrar en el futuro." and no session buttons or
activity form.

**AC-CAL-11 · Week panel and options**
When I press the button of the current week
Then the panel "Semana 2–8 nov" shows "Series efectivas", "Sesiones" and the three option controls,
enabled
When I turn on "Semana de descarga"
Then the toast "Semana de descarga: las sesiones nuevas salen reducidas" (same as Today) appears, the week button gets
"· Descarga" in its name and Today's week card shows the switch on.

**AC-CAL-12 · Closing weeks**
Given sessions in a week that ended last Sunday and no week record
When the app starts
Then that week's button name ends with "· Cerrada" and its panel shows "Semana cerrada: el plan
quedó guardado el <date>." with the three options disabled
And editing a routine afterwards (adding a set to Push) does not change the week's planned sets.

**AC-CAL-13 · Current and future weeks are not closed**
Then the week of today and any later week are never named "Cerrada", and a future week's options
show "Todavía no puedes cambiar esta semana."

**AC-CAL-14 · Body weight of any week**
When I open the panel of a past week, enter "76,4" and press "Guardar peso"
Then the toast "Peso guardado · 26 oct – 1 nov" (same text as Today, with that range)
appears and the field keeps 76,4 after reloading
And Today's card "Peso medio de la semana" shows the value when it is the current or the last
week.

**AC-CAL-15 · Week JSON**
When I press "Descargar JSON de la semana" in the panel of a week with a session
Then a file named `certavi-week-2026-11-02.json` is downloaded, valid JSON that contains that
session and its sets, and nothing from other weeks.

**AC-CAL-16 · English and dark mode**
Given the app is in English and dark mode
Then the calendar reads "November 2026", "Previous month", "Next month", weekday initials
"M T W T F S S", "Log on this day" and week buttons "Week 2 – 8 Nov"
And the axe check finds no violations, in light and dark, with no panel and with a day panel open.

**AC-CAL-17 · Offline**
Given the device is offline
When I log an activity on a past day, change a week's weight and reload
Then everything is still there and the sync indicator shows changes waiting.

## 4. Edge cases

- **Midnight**: the calendar follows the device date when the app returns to the foreground
  (today's ring and which weeks are closed move on).
- **Sessions in progress**: a session that was never finished (`En curso`) still marks its day;
  it counts for the "Sesiones" figure of its week.
- **Deleted records** (sessions, activities) disappear from the grid, the lists and the
  summary; deleted sets do not count in "<n> series".
- **Two devices**: week options, weights and closings are one record per week; the latest
  change wins. A week closed on another device turns read-only here after sync.
- **Weeks without data** (no session, activity or week record) are not closed and keep their
  options editable.
- **Imported weeks** with no week record are closed with the default options.
- **Weeks before the first data**: months with no data render normally and nothing is closed.
- **Deleted sets**: deleted sets are not counted in "<n> series".
- **Months with six rows** and 28-day months starting on Monday (four rows) both render.
- **Day panel and navigation**: changing month keeps the selected day if it is still visible
  (dimmed days included); otherwise the panel closes.
- **0 minutes**: an activity without minutes is saved with 0 and shown without minutes.
- **Small screen (390×844)**: no horizontal scroll; the nine columns (week button + 7 days) fit
  in one row; every cell and button is at least 44 px high.

## 5. Out of scope

- Editing or deleting an activity or a block log from the calendar (activities can be added only;
  deleting sessions is in the session screen).
- Reopening or editing the options of a closed week.
- Creating or editing the plan start date.
- Block logs, metrics and charts (`blocks.md`); progress charts and weekly set counts per muscle
  group (`progress.md`).
- Importing a week's JSON.
