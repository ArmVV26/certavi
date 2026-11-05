# Active session

## 1. Purpose

The **session screen** (`/session/<id>`) is where the user logs a workout, set by set, in the gym
and often without coverage. It shows the exercises of the session (a copy of the routine taken
when the session started), lets the user log each set with the weight, reps and RIR, shows what
was done last time as a reference, and records the notes and how the user felt. Everything is
saved on the device first (see [sync.md](sync.md)); what is typed but not yet saved survives
re-draws **and reloads**.

The sets of an exercise are a list of **rows**, as in Hevy: the routine gives the first rows,
and for that day only the user can **add a row** ("+ Serie extra", "+ Calentamiento"), **remove
a row** (swipe) and **change the type of a row** (warm-up, effective, dropset) without the row
moving. None of this changes the routine.

How a session is started is described in [today.md](today.md). The rules behind "last time", the
progression hint, the back-off and what counts as an effective set are in [rules.md](rules.md).

**Not in this branch** (see §5): rest timer, adding or reordering exercises, editing date, hours
and routine, the "changes from another device" banner, downloading the session as JSON and
"Undo". A **free session** can be started and finished here, but it cannot get exercises until
the next branch.

## 2. Screens and elements

Texts are given as "Spanish" / "English". Numbers follow the language: Spanish uses a decimal
comma ("62,5 kg"), English a decimal point ("62.5 kg"). In both languages the fields accept a
comma or a point.

The page keeps the existing header (title **"Sesión" / "Session"**, sync indicator, theme
button). Below it, in this order: the session card (§2.1), the exercises (§2.2), the session
notes (§2.3) and the actions (§2.4).

### 2.1 Session card

- The routine name as heading, or **"Sesión libre" / "Free session"**.
- The date and start time, e.g. "miércoles, 4 de noviembre · 18:00", and the label
  **"En curso" / "In progress"** or **"Terminada" / "Finished"**.
- The summary **"<n> ejercicios · <m> series" / "<n> exercises · <m> sets"** and the progress
  **"<h> de <m> hechas" / "<h> of <m> done"**. `m` counts the **working rows**: every row that
  is not a warm-up, a dropset or an extra set (so it follows the routine, and shrinks when a
  working row is removed or changed to warm-up or dropset); `h` counts the saved ones.
  A free session without exercises shows **"Sin ejercicios todavía." / "No exercises yet."**
  instead.
- In a **deload week**: a notice **"Semana de descarga. Menos series y RIR 3-4: el peso de
  siempre o un 10 % menos. No cuenta para récords." / "Deload week. Fewer sets and RIR 3-4: the
  usual weight or 10 % less. It does not count for records."**
- **"¿Cómo llegas?" / "How do you feel?"**: five buttons **1 to 5** with the caption
  "1 fatal · 5 a tope" / "1 awful · 5 great". The chosen one is shown as pressed; tapping it
  again clears the answer.
- When the session is finished and its date is today: **"Sesión terminada. Puedes corregir
  cualquier dato: se guarda al momento." / "Session finished. You can correct any data: it is
  saved immediately."** A finished session shows two figures: **"Series efectivas" /
  "Effective sets"** and **"Volumen" / "Volume"** (kg, thousands separated: "3.250").

An unknown or deleted session id shows **"Sesión no encontrada" / "Session not found"** and a
link **"Volver a Hoy" / "Back to Today"** (as before).

### 2.2 Exercise card

One card per exercise, in the order of the session. The heading is the exercise name; tapping it
folds or unfolds the card (it is a button, announced as expanded or collapsed).

- **Tags:** "Básico" / "Basic" or "Aislamiento" / "Isolation"; "Opcional" / "Optional" when the
  routine marks it so; and **"Completo" / "Done"** when all its working rows are saved.
- **Plan line:** "3 series · 6-8 reps · RIR 1-2" / "3 sets · 6-8 reps · RIR 1-2": the working
  rows of the exercise that day (it follows the rows removed or changed), their rep targets and
  the routine's RIR.
- **Progression hint** (only when there is a last time; texts for the rule results of
  [rules.md](rules.md) §3):
  - go up: "Sube a 65 kg" / "Go up to 65 kg";
  - repeat: "Repite 62,5 kg y busca 8 reps" / "Repeat 62.5 kg and aim for 8 reps";
  - deload week: "Descarga: peso de siempre o un 10 % menos" / "Deload: usual weight or 10 % less";
  - bodyweight: "Prueba una banda más fina (o ninguna)" / "Try a thinner band (or none)" or
    "Misma banda: busca 10 reps" / "Same band: aim for 10 reps".
- **Last time:** "Última vez (3 nov): 62,5 kg × 8 · 57,5 kg × 10" / "Last time (3 Nov): …" listing
  its effective sets, or **"Sin registros previos" / "No previous records"**. "Last time" is the
  latest earlier session with that exercise that counts (not marked "does not count"; deload
  sessions only if there is no normal one).
- **Straps / band** (only for exercises that use them): a switch **"Con straps" / "With
  straps"** and/or a text field **"Banda" / "Band"** (empty = no band) with the bands already
  used for that exercise as suggestions. They start with the value of the last set saved in this
  session, otherwise of last time, otherwise straps on and the exercise's default band.
- **Rows of sets.** A header names the columns: **Serie** / **Set**, **Anterior** / **Previous**,
  **kg** ("Lastre" / "Added" for bodyweight exercises), **Reps**, **RIR** and ✓. The rows keep
  their position: the first ones come from the routine, a warm-up added with "+ Calentamiento"
  goes at the top, an extra set goes at the bottom.
  - **Type cell (left):** a button showing the type of the row and opening the type choice
    (below). Its accessible name is e.g. "Tipo de la serie 2: efectiva" / "Type of set 2:
    effective".
    - **Warm-up:** the symbol **C** (es) / **W** (en); the row looks different (warm-up colour)
      and says "no cuenta" / "doesn't count".
    - **Dropset:** **D**.
    - **Effective:** a number, counting the effective rows (not warm-ups or dropsets): 1, 2, 3…
      A small caption names the role the routine gave to the row: "Aprox." / "Approach",
      "Top", "Back-off", "Bilbo"; extra sets say "Extra". The planned reps range ("6-8") is
      shown next to the rows that have one.
  - **Anterior / Previous:** what the same row was last time, e.g. "62,5 × 8" (kg × reps; "—"
    when there is nothing). It is the n-th set of the same type of last time; if there are
    fewer, the last set of that type; if there is none of that type, the last effective set of
    last time. Warm-ups always show "—".
  - **kg, Reps, RIR:** three fields. RIR offers "RIR" (empty), 0, 1, 2, 3, 4 and "5+".
  - **✓** is labelled "Marcar serie hecha" / "Mark set done" (empty row) or "Serie hecha
    (pulsa para quitar)" / "Set done (tap to remove)" (saved row). On a row with **no kg and no
    reps typed**, ✓ saves the values of **Anterior**.
  - **Type choice:** a sheet titled "Tipo de serie" / "Set type" with three options:
    **"Calentamiento" / "Warm-up"**, **"Efectiva" / "Effective"** and **"Dropset"**; the
    current one is marked. Choosing one changes the row at once, saved or not, and the row stays
    where it is. Choosing "Efectiva" on a warm-up or dropset row gives it the role "Serie" /
    "Set" (the roles Top and Back-off only come from the routine).
  - **Removing a row:** swiping the row to the left shows a red **"Quitar" / "Remove"** button;
    tapping it removes the row. The same button is also reachable with the keyboard and screen
    readers (it is named "Quitar serie 2" / "Remove set 2" and shows when it gets the focus), so
    removing never depends on swiping. An empty row goes away at once; a saved row asks first
    (§2.5). The rows below move up and the saved sets in them keep their data.
- **Suggested back-off:** when the exercise has a top set and its weight is known (typed or
  saved), "Back-off sugerido: 57,5 kg (−10 % del top)" / "Suggested back-off: 57.5 kg (−10 % of
  top)". It updates while the top weight is typed. It is only a text: it does not fill any field.
- **Buttons:** "+ Calentamiento" / "+ Warm-up", "+ Serie extra" / "+ Extra set", "Nota" /
  "Note" (reads "Nota ✎" / "Note ✎" when the exercise has a note). An extra set is an effective
  row with the caption "Extra" that is added at the bottom.
- **Note area** (opened by "Nota"): a text area **"Nota del ejercicio" / "Exercise note"**, a
  checkbox **"No cuenta para la progresión" / "Does not count for progression"** and, when it
  is checked, a choice of reason: "Máquina ocupada" / "Machine busy", "Faltan discos" / "Missing
  plates", "Otra banda" / "Other band", "Otro" / "Other".
- **Folding:** a card with all its working rows saved folds by itself when the last one is saved
  and shows the one-line summary of its effective sets ("62,5 × 8 · 57,5 × 10"). Tapping the
  heading unfolds it. When the session opens, completed cards are folded and the others
  unfolded.

### 2.3 Session notes

A text area **"Notas de la sesión" / "Session notes"**, saved while typing (after a short pause).

### 2.4 Actions

- **"Terminar sesión" / "Finish session"** (primary) while in progress; **"Marcar como en curso"
  / "Mark as in progress"** when finished.
- **"Eliminar sesión" / "Delete session"** (danger).

### 2.5 Dialogs

All confirmations use Certavi's dialogs (never the browser's). Each has a primary button and
**"Cancelar" / "Cancel"**:

- Un-save a set (tap ✓ on a saved row): "¿Quitar esta serie del registro?" / "Remove this set
  from the log?" — **"Quitar" / "Remove"**. The row stays and is left empty.
- Remove a saved row (swipe, "Quitar"): "¿Quitar la serie 2?" / "Remove set 2?" with "Se borrará
  lo registrado (62,5 kg × 8). La rutina no cambia." / "What was logged will be deleted (62.5 kg
  × 8). The routine does not change." — **"Quitar" / "Remove"**.
- Straps or band changed while the exercise has saved sets: "¿Corregir también las 3 series ya
  guardadas?" / "Also correct the 3 sets already saved?" — **"Corregir las 3 guardadas" /
  "Correct the 3 saved"** or **"Solo las próximas" / "Only the next ones"**.
- Delete the session: "¿Eliminar esta sesión?" / "Delete this session?" with "Se borrarán la
  sesión y todas sus series y notas." / "The session and all its sets and notes will be
  deleted." — **"Eliminar" / "Delete"**.

## 3. Acceptance criteria

Dates use the seed routines and a fresh install unless stated. The session of the examples is
**Push** started on Monday 2 November 2026 (its second exercise, "Press de pecho en máquina
vertical", has a top set and 2 back-offs). Values below are examples.

**AC-SESSION-01 · The session shows its exercises**
Given I started "Push" today
When the session screen opens
Then I see "Push", "En curso", "7 ejercicios · 19 series" and "0 de 19 hechas"
And one card per exercise, in the routine order, each with its plan line and "Sin registros
previos".

**AC-SESSION-02 · Log a set and keep it after a reload**
Given the first row of an exercise is empty
When I type 60 in kg, 8 in reps, choose RIR 2 and tap ✓
Then the row shows 60 / 8 / 2 with the saved ✓
And the progress goes up by one ("1 de 19 hechas")
When I reload the page
Then the saved set and the progress are still there.

**AC-SESSION-03 · ✓ on an empty row saves "Anterior"**
Given last time the top set of an exercise was 62,5 kg × 8
And a new session of that exercise is open
Then the top row's "Anterior" shows "62,5 × 8"
When I tap ✓ without typing
Then the set is saved with 62,5 kg × 8.

**AC-SESSION-04 · Nothing to save**
Given an exercise without a last time ("Anterior" shows "—")
When I tap ✓ on an empty row
Then nothing is saved, the empty field is marked invalid and has the focus
And the progress does not change.

**AC-SESSION-05 · 0 kg is valid**
Given an exercise with an empty row
When I type 0 in kg, 10 in reps and tap ✓
Then the set is saved as 0 kg × 10
And for a bodyweight exercise, leaving "Lastre" empty and typing 8 reps saves 0 kg × 8 (no seed
routine has one: pull-ups stay outside the routines, so this is covered by component tests until
exercises can be added to a session in the next branch).

**AC-SESSION-06 · Reps must be positive**
Given a row with 60 in kg and 0 or nothing in reps (and no "Anterior")
When I tap ✓
Then the set is not saved and the reps field is marked invalid.

**AC-SESSION-07 · Add a warm-up**
Given an exercise card
When I tap "+ Calentamiento"
Then a new row with the symbol "C" ("W" in English) and "no cuenta" appears **at the top**,
above the routine's rows, with the focus in its kg field
When I type 20 kg × 10 and tap ✓
Then it is saved, the progress ("h de m hechas") does not change and the numbers of the
effective rows are still 1, 2, 3…
And after finishing the session, "Series efectivas" and "Volumen" do not include it.

**AC-SESSION-08 · Extra set**
Given an exercise with all its working rows saved
When I tap "+ Serie extra"
Then a new effective row with the caption "Extra" appears at the bottom, numbered after the
others
When I type values and tap ✓
Then the extra set is saved and counts in "Series efectivas" and "Volumen"
And the progress denominator ("de m") does not change.

**AC-SESSION-09 · Remove a row by swiping (also one from the routine)**
Given "Remo en T" has 3 rows and the first two are saved
When I swipe row 2 to the left and tap "Quitar"
Then a dialog asks "¿Quitar la serie 2?" and, if I confirm "Quitar", the exercise has 2 rows,
row 1 keeps its data and the summary of the session drops by one set ("18 series")
And the routine itself is unchanged: starting the same routine another day shows 3 rows
And if the third row was saved, it is now row 2 with its values.
When I cancel the dialog, nothing changes.
And an empty row is removed at once, without a dialog.
And with the keyboard, focusing "Quitar serie 2" and activating it does the same.

**AC-SESSION-10 · Un-save and edit a saved set**
Given a saved row
When I tap its ✓ and confirm "Quitar"
Then the row stays in its place, empty, and the progress goes down
When I change the reps of a saved row and leave the field
Then the new value is saved at once (and still there after a reload).

**AC-SESSION-11 · Suggested back-off**
Given an exercise with a top set and back-offs, step 2,5 kg
When I type 65 in the top kg
Then "Back-off sugerido: 57,5 kg (−10 % del top)" appears and updates when I change the top
weight
And it does not fill any field.

**AC-SESSION-12 · Last time and progression hint**
Given last session the top set was 62,5 kg × 8 at RIR 1
Then the card shows "Última vez (<fecha>): 62,5 kg × 8 …" and "Sube a 65 kg"
And with a top set of 65 kg × 7 last time it shows "Repite 65 kg y busca 8 reps".
And in a deload week the hint is "Descarga: peso de siempre o un 10 % menos".

**AC-SESSION-13 · Straps and band**
Given a back exercise (it has straps) with two saved sets with straps on
When I turn the switch "Con straps" off
Then the dialog asks to correct the 2 saved sets
When I choose "Corregir las 2 guardadas"
Then the switch stays off, both saved sets are saved without straps (not shown on the rows) and
the next sets use it
When I choose "Solo las próximas" instead, the saved sets keep their value
And for an exercise without saved sets, no dialog appears.
And an exercise with a band offers the "Banda" field with the bands used before (no seed routine
has one yet: covered by component tests).

**AC-SESSION-14 · Exercise note and "does not count"**
Given an exercise card
When I tap "Nota", type "Máquina distinta", check "No cuenta para la progresión" and choose
"Máquina ocupada"
Then the button reads "Nota ✎" and the note is still there after a reload
And in a later session of that exercise, "Última vez", "Anterior" and the hint ignore this
session and use the one before.
When I clear the text and uncheck the box, the note disappears.

**AC-SESSION-15 · Session note and "¿cómo llegas?"**
When I type a session note and tap "4"
Then "4" is shown as pressed and the note is kept after a reload
When I tap "4" again, it is no longer pressed.

**AC-SESSION-16 · Typed values survive**
Given I typed 60 and 8 in an empty row without tapping ✓, and an extra row with 10 reps
When something redraws the screen (e.g. I unfold another card, or a sync brings data)
Then the typed values are still in their rows
When I reload the page
Then they are still there as well (they are not saved sets: the progress does not count them;
the extra row itself is part of the session and is still there)
And tapping ✓ on such a row saves it
And finishing or deleting the session discards all typed values that were not saved.

**AC-SESSION-17 · Finish and reopen**
Given an in-progress session of today with sets saved
When I tap "Terminar sesión"
Then it reads "Terminada", the figures "Series efectivas" and "Volumen" appear, a toast says
"Sesión guardada" (with "· n récord(s)" when the session set records, never in a deload week)
and the button becomes "Marcar como en curso"
When I tap "Marcar como en curso", it reads "En curso" again
And a session registered on a past day starts "Terminada" and can still be edited.

**AC-SESSION-18 · Delete the session**
When I tap "Eliminar sesión"
Then the dialog asks for confirmation; "Cancelar" changes nothing
When I confirm "Eliminar"
Then I am taken to Today, which no longer counts that session
And opening its address shows "Sesión no encontrada".

**AC-SESSION-19 · Completed exercises fold**
Given an exercise with 2 working rows, one saved
When I save the second
Then the card shows "Completo", folds and shows the one-line summary of its effective sets
When I tap its heading, it unfolds.

**AC-SESSION-20 · Free session**
Given a free session
Then the card shows "Sesión libre" and "Sin ejercicios todavía."
And "¿Cómo llegas?", the session notes, "Terminar sesión" and "Eliminar sesión" work as in a
routine session.

**AC-SESSION-21 · Offline**
Given the device is offline
Then starting, logging, folding, finishing and deleting work the same, and everything is still
there after a reload; it syncs when coverage returns.

**AC-SESSION-22 · English, dark mode and small screens**
Given English and dark mode are on
Then every text of this screen is in English ("W" for warm-ups, decimal point), no Spanish word
shows, contrast is correct, and at 390×844 there is no horizontal scroll and every row fits
(type, previous, kg, reps, RIR and ✓ visible without scrolling sideways).

**AC-SESSION-23 · Change the type of a row**
Given an exercise with rows Top, Back-off and Back-off (labelled 1, 2, 3), the second one empty
When I tap the type cell of row 2
Then a sheet "Tipo de serie" offers "Calentamiento", "Efectiva" and "Dropset", with "Efectiva"
marked
When I choose "Calentamiento"
Then row 2 stays in the second position and shows "C" ("W" in English)
And the other rows are numbered 1 and 2, and the progress denominator goes down by one
When I choose "Dropset" for it instead, it shows "D", is not numbered, and the denominator is
the same as with the warm-up
And with a **saved** row the same happens and its data is kept: as a warm-up it no longer counts
in "Series efectivas" and "Volumen"; as a dropset it counts in both.
When I choose "Efectiva" for a warm-up or dropset row, it is numbered again with the caption
"Serie"
And the change is still there after a reload.

## 4. Edge cases

- **Double tap on ✓**: saves the set once.
- **Comma or point**: "62,5" and "62.5" both work; "abc" is not accepted.
- **Reload in the middle**: saved sets, rows, types, notes, readiness and finished state are
  kept; typed values are kept as drafts (AC-SESSION-16). Folded or unfolded state of the cards
  is not kept.
- **The last row of an exercise cannot be removed** (it has no "Quitar" button); the exercise
  itself is removed in the next branch.
- **Removing a row that is the only one of its role** (e.g. the top set): the remaining rows keep
  their order and the numbers are recalculated.
- **Dropset and records**: a dropset counts as an effective set and in volume, but not for the
  estimated 1RM, the maximum weight or records (like an approach set).
- **Two devices**: rows and types live in the session, one record that the most recent change
  wins; two devices saving the same row at the same time: the most recent shows. Notes,
  readiness and the finished state are one record each.
- **Session of a past day**: registered already finished (18:00–19:15); rows can be added,
  removed, changed and corrected, "Marcar como en curso" is available.
- **Sessions imported from gym_app** open with the same rows (warm-ups at the top, extra sets at
  the bottom) and can be edited like any other.
- **Exercise no longer in the catalog**: the card shows the exercise's stored name or id and
  works as any other.
- **Long names and notes** wrap; nothing overflows at 390 px.

## 5. Out of scope

- Rest timer with beep and vibration (next branch).
- Adding, removing and reordering exercises, with the filter; getting exercises in a free
  session (next branch).
- Editing the date, hours and routine of a session (next branch).
- The "changes from another device" banner (next branch; until then, other devices' data
  refreshes the saved values but never touches typed ones).
- Downloading a session as JSON and "Undo" for removals (next branch).
- Other set types (failure…), dragging rows to reorder them, tapping "Anterior" to fill the row.
- The exercise detail page ("Ficha", Phase 6) and the calendar day view (Phase 7).
