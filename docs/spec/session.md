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

The screen also has the **session tools**: a **rest timer** after each new set of today's session
(§2.6), **adding, moving and removing exercises** with a filter (§2.7), **editing the date, the
hours and the routine** (§2.8), a **banner** when another device changes the session (§2.9),
**downloading the session as JSON** (§2.4) and **"Undo"** after removing a row, an exercise or
the session (§2.5). A **free session** gets its exercises with "+ Añadir ejercicio".

## 2. Screens and elements

Texts are given as "Spanish" / "English". Numbers follow the language: Spanish uses a decimal
comma ("62,5 kg"), English a decimal point ("62.5 kg"). In both languages the fields accept a
comma or a point.

The page keeps the existing header (title **"Sesión" / "Session"**, sync indicator, theme
button). Below it, in this order: the banner of §2.9 (only when it applies), the session card
(§2.1), the exercises (§2.2), the button "+ Añadir ejercicio" (§2.7), the session notes (§2.3)
and the actions (§2.4). The rest timer (§2.6) is a bar fixed above the navigation bar.

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
folds or unfolds the card (it is a button, announced as expanded or collapsed). Next to the
heading: two icon buttons named with the exercise, **"Subir Remo en T" / "Move Remo en T up"** and
**"Bajar Remo en T" / "Move Remo en T down"** (the first card cannot go up and the last cannot go
down: those buttons are disabled). They stay visible when the card is folded (§2.7).

- **Tags:** "Básico" / "Basic" or "Aislamiento" / "Isolation"; "Opcional" / "Optional" when the
  routine marks it so; **"Fuera de la rutina" / "Outside the routine"** when the exercise is not
  part of the session's routine (it was added by hand, or kept when the routine changed; never
  in a free session); and **"Completo" / "Done"** when all its working rows are saved.
- **Plan line:** "3 series · 6-8 reps · RIR 1-2" / "3 sets · 6-8 reps · RIR 1-2": the working
  rows of the exercise that day (it follows the rows removed or changed), their rep targets and
  the routine's RIR.
- **Routine note** (only when the routine has a note for that exercise, for example "Banda morada
  por defecto" on "Sentadilla hack con banda"): the note text, in muted italics, right under the
  plan line. It is the note written in the routine (routines.md), different from the **"Nota"**
  button of the card, which is the user's note of that session. Exercises added by hand have none.
- **Machine settings** (only when the exercise has settings, exercises.md §2.7): one line with
  them as "<name> <value>" separated by " · ", for example **"Respaldo 3 · Asiento 5"**, under
  the routine note. They are the settings of the exercise, the same in every session.
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
  "Note" (reads "Nota ✎" / "Note ✎" when the exercise has a note), **"Ajustes" / "Settings"**
  (reads "Ajustes ✎" / "Settings ✎" when the exercise has machine settings; it opens the sheet
  below) and **"Quitar ejercicio" /
  "Remove exercise"** (danger; §2.7). An extra set is an effective row with the caption "Extra"
  that is added at the bottom.
- **Note area** (opened by "Nota"): a text area **"Nota del ejercicio" / "Exercise note"**, a
  checkbox **"No cuenta para la progresión" / "Does not count for progression"** and, when it
  is checked, a choice of reason: "Máquina ocupada" / "Machine busy", "Faltan discos" / "Missing
  plates", "Otra banda" / "Other band", "Otro" / "Other".
- **Machine settings sheet:** a sheet titled **"Ajustes de la máquina" / "Machine settings"**
  with the editor of exercises.md §2.7 (rows "Nombre del ajuste <n>" / "Valor del ajuste <n>",
  "Añadir ajuste", "Quitar ajuste <n>", "Guardar ajustes"). Saving closes the sheet, shows
  "Ajustes guardados" / "Settings saved" and updates the line of the card; the typed sets of the
  session are not touched.
- **Folding:** a card with all its working rows saved folds by itself when the last one is saved
  and shows the one-line summary of its effective sets ("62,5 × 8 · 57,5 × 10"). Tapping the
  heading unfolds it. When the session opens, completed cards are folded and the others
  unfolded.

### 2.3 Session notes

A text area **"Notas de la sesión" / "Session notes"**, saved while typing (after a short pause).

### 2.4 Actions

- **"Terminar sesión" / "Finish session"** (primary) while in progress; **"Marcar como en curso"
  / "Mark as in progress"** when finished.
- **"Datos de la sesión" / "Session details"**: opens the sheet of §2.8.
- **"Descargar JSON" / "Download JSON"**: downloads the session (its data, sets and exercise
  notes) as `certavi-session-<date>-<id>.json`. It works offline. Typed values that were not
  saved are not included.
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
- Remove an exercise that has saved sets or a note: "¿Quitar Remo en T de esta sesión?" /
  "Remove Remo en T from this session?" with "Se borrarán sus 3 series y su nota. La rutina no
  cambia." / "Its 3 sets and its note will be deleted. The routine does not change." —
  **"Quitar" / "Remove"**. An exercise with nothing saved is removed at once.
- Change the routine of the session (§2.8): "¿Cambiar la sesión a Pull?" / "Change the session
  to Pull?" with "La lista de ejercicios pasará a ser la de esa rutina. Las series ya apuntadas
  se mantienen." / "The exercise list will become that of the routine. The sets already logged
  are kept." — **"Cambiar" / "Change"**.

**Undo.** Every removal is followed, once it is done, by a notification with a **"Deshacer" /
"Undo"** button that stays about 6 seconds (see AC-DIALOG-05) and brings back exactly what was
removed, in its place, with its saved data:

| Removed                      | Notification                             | After "Deshacer"                             |
| ---------------------------- | ---------------------------------------- | -------------------------------------------- |
| A row (empty or saved)       | "Serie quitada" / "Set removed"          | "Serie recuperada" / "Set restored"          |
| An exercise                  | "Ejercicio quitado" / "Exercise removed" | "Ejercicio recuperado" / "Exercise restored" |
| The session (shown on Today) | "Sesión eliminada" / "Session deleted"   | "Sesión recuperada" / "Session restored"     |

Typed values that were not saved are never brought back. Un-saving a set (✓) has no "Undo": it
already asks first and the row stays.

### 2.6 Rest timer

A bar fixed above the navigation bar, only on the session screen:

- **Text:** "Descanso" / "Rest" and, when there is an empty working row left, **"Siguiente: Press
  de pecho en máquina vertical" / "Next: …"** (the exercise of the next empty row, in screen
  order); the time left as **m:ss** ("2:45"); a progress bar. It is announced politely to screen
  readers when it starts and when it ends, not every second.
- **Buttons:** **"−15 s"**, **"+15 s"** and **"Cerrar descanso" / "Close rest"** (✕).
- **When it starts:** every time a **new** set is saved with ✓ (including ✓ on an empty row that
  saves "Anterior"), if the session is **of today** and **in progress**. Saving again while it
  runs restarts it. It does not start when a saved set is corrected, when the session is of
  another day, or when it is finished. Finishing or deleting the session closes it.
- **How long** (depends on the row just saved):

  | Row saved           | Rest                                                                               |
  | ------------------- | ---------------------------------------------------------------------------------- |
  | Warm-up             | 60 s                                                                               |
  | Approach ("Aprox.") | 90 s                                                                               |
  | Top                 | the "basic" rest + 30 s                                                            |
  | Any other row       | the "basic" rest for basic exercises, the "isolation" rest for isolation exercises |

  The "basic" and "isolation" rests are set in Settings (§ "Descanso" of
  [theme-language-navigation.md](theme-language-navigation.md)): 180 s and 120 s at first.

- **−15 s / +15 s** change the time left (never below 0:15 while counting). After it ended, they
  start it again with that time (at least 15 s).
- **When the time is up:** the text becomes **"¡A por la siguiente serie!" / "Go for the next
  set!"**, the bar is full, and, if **"Sonido al acabar el descanso"** is on, two short beeps
  sound; if **"Vibración"** is on and the device can vibrate, it vibrates. The bar closes by
  itself about 30 seconds later.
- The time is counted from the moment it started, so it is right after the phone was locked or
  the app was in the background (the beeps are not guaranteed in that case, above all on iPhone).
  It is not kept after a reload.

### 2.7 Adding, moving and removing exercises

- **"+ Añadir ejercicio" / "+ Add exercise"** (below the cards; also in a free session, where it
  is the way to get exercises) opens a bottom **sheet "Añadir ejercicio" / "Add exercise"** with:
  - a search field **"Buscar ejercicio" / "Search exercise"** (ignores case and accents:
    "remo" finds "Remo en T");
  - filter chips, shown as pressed when on, tapping again clears them: **muscle group** (one),
    **equipment** (one: "Discos" / "Plate-loaded", "Placas" / "Selectorized", "Mancuernas" /
    "Dumbbell", "Polea" / "Cable", "Barra" / "Barbell", "Peso corporal" / "Bodyweight", "Otro" /
    "Other"), **type** ("Básico" / "Basic" or "Aislamiento" / "Isolation"), **"Straps"**,
    **"Creados por mí" / "Created by me"** and **"En alguna rutina" / "In a routine"**. All the
    active filters apply together;
  - the results: name, muscle group and equipment of each exercise, in alphabetical order, or
    **"Ningún ejercicio coincide" / "No exercise matches"**. Archived exercises are not listed.
    An exercise that is already in the session is shown disabled with **"Ya está en la sesión" /
    "Already in the session"** (an exercise appears only once per session).
- Tapping an exercise adds it **at the end** with its default scheme, closes the sheet, and the
  new card is shown unfolded with the focus on it. In a session of a routine it is tagged
  "Fuera de la rutina". The routine itself does not change.
- **Moving:** "Subir ejercicio" / "Bajar ejercicio" swap the card with its neighbour. The order
  is only for that session. Saved sets and notes do not change.
- **Removing:** "Quitar ejercicio" (see the dialog in §2.5). The session summary
  ("n ejercicios · m series") updates, and "Undo" is offered. The routine does not change.

### 2.8 Session details

The sheet **"Datos de la sesión" / "Session details"** (opened from the actions) has:

- **"Fecha" / "Date"** (a date field), not later than today.
- **"Inicio" / "Start"** (time) and, when the session is finished, **"Fin" / "End"** (time).
  The times belong to the chosen date. "Fin" cannot be earlier than "Inicio".
- **"Rutina" / "Routine"**: "Sesión libre" / "Free session" and the routines, with the current
  one chosen.
- **"Guardar" / "Save"** and **"Cancelar" / "Cancel"**. Errors show next to the field:
  **"La fecha no puede ser futura" / "The date cannot be in the future"** and **"El fin no puede
  ser anterior al inicio" / "The end cannot be earlier than the start"**; nothing is saved
  while there is an error.

Saving moves the session in Today, in the week and in the figures of the week. Changing the
routine first asks for confirmation (§2.5) and then works like this: the exercise list becomes
that of the new routine (a copy, reduced in a deload week); an exercise that is in both keeps
its rows if it has saved sets, otherwise it takes the scheme of the new routine; an exercise
that has saved sets or a note and is **not** in the new routine stays at the end tagged "Fuera
de la rutina"; the other old exercises go away. With "Sesión libre", exercises with saved data
stay and the rest go. **No saved set or note is ever lost by changing the routine.** A session
of today can keep using the rest timer after the change; the date change to another day stops
the timer.

### 2.9 Changes from another device

When a change **made on another device** reaches this device (sync) and affects this session
(the session itself, one of its sets or one of its exercise notes), a notice appears at the top:
**"Hay cambios de otro dispositivo en esta sesión." / "There are changes from another device in
this session."** with a button **"Cerrar" / "Close"**.

- The saved values on the screen are already updated when the notice shows (rows, notes,
  readiness, finished state, exercises).
- **What is typed and not saved is never touched.**
- The notice stays until it is closed; if more changes arrive later, it shows again.
- This device's own writes coming back from the server, and changes to other sessions, do not
  show it.

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
And for a bodyweight exercise (add one to a session with "+ Añadir ejercicio"), leaving "Lastre"
empty and typing 8 reps saves 0 kg × 8.

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
And after any removal a notification "Serie quitada" with "Deshacer" appears; tapping it shows
"Serie recuperada" and the row is back in its place with its saved values (also after a reload).

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
Then it reads "Terminada", the figures "Series efectivas" and "Volumen" appear (each one a tile
whose label and number start at the same left edge, with no indent on the number), a toast says
"Sesión guardada" (with "· n récord(s)" when the session set records, never in a deload week)
and the button becomes "Marcar como en curso"
When I tap "Marcar como en curso", it reads "En curso" again
And a session registered on a past day starts "Terminada" and can still be edited.

**AC-SESSION-18 · Delete the session**
When I tap "Eliminar sesión"
Then the dialog asks for confirmation; "Cancelar" changes nothing
When I confirm "Eliminar"
Then I am taken to Today, which no longer counts that session
And a notification "Sesión eliminada" with "Deshacer" appears there
And opening its address shows "Sesión no encontrada"
When I tap "Deshacer" before it goes away, "Sesión recuperada" appears, Today counts the session
again and its address opens it with all its sets, notes and exercises.

**AC-SESSION-19 · Completed exercises fold**
Given an exercise with 2 working rows, one saved
When I save the second
Then the card shows "Completo", folds and shows the one-line summary of its effective sets
When I tap its heading, it unfolds.

**AC-SESSION-20 · Free session**
Given a free session
Then the card shows "Sesión libre" and "Sin ejercicios todavía."
And "+ Añadir ejercicio" is shown (AC-SESSION-24)
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

**AC-SESSION-24 · Add an exercise to a free session**
Given a free session with no exercises
When I tap "+ Añadir ejercicio"
Then a sheet "Añadir ejercicio" opens with the search field, the filter chips and the list of
exercises
When I tap "Remo en T"
Then the sheet closes, a card "Remo en T" appears with its default rows, without the tag "Fuera de
la rutina", the summary reads "1 ejercicio · …" (singular) and "Sin ejercicios todavía." is gone
And I can log sets in it, and it is still there after a reload.

**AC-SESSION-25 · Filter the exercises**
Given the sheet "Añadir ejercicio" is open
When I type "remo" in "Buscar ejercicio"
Then only the exercises whose name contains it (any case, with or without accents) are listed
When I also press the chip "Espalda" and the chip "Básico"
Then only the basic back exercises matching the text are listed
When I press "Straps" the list keeps only those with straps; when I press "Creados por mí" the
list only has exercises I created (empty with the fresh install: "Ningún ejercicio coincide");
"En alguna rutina" keeps those that are in some routine
When I press a pressed chip again, its filter is cleared
And exercises already in the session show "Ya está en la sesión" and cannot be chosen.

**AC-SESSION-26 · Add an exercise to a routine session**
Given a session of "Push"
When I add "Remo en T" (not part of Push)
Then it appears at the end of the cards with the tag "Fuera de la rutina", the summary and the
progress count its rows ("8 ejercicios · …")
And starting "Push" another day still gives the original 7 exercises
And the tag stays after a reload.

**AC-SESSION-27 · Move exercises**
Given a session with exercises A, B and C
Then "Subir A" and "Bajar C" are disabled
When I tap "Bajar A"
Then the order is B, A, C, and it is still B, A, C after a reload
When I tap "Subir C", the order is B, C, A
And sets and notes stay with their exercise, and the routine does not change.

**AC-SESSION-28 · Remove an exercise and undo**
Given "Remo en T" has 2 saved sets and a note
When I tap "Quitar ejercicio" on it
Then the dialog asks "¿Quitar Remo en T de esta sesión?" with "Se borrarán sus 2 series y su
nota. La rutina no cambia."; "Cancelar" changes nothing
When I confirm "Quitar", the card is gone, the summary and progress go down and "Ejercicio
quitado" with "Deshacer" appears
When I tap "Deshacer", "Ejercicio recuperado" appears and the card is back in the same place
with its rows, its 2 saved sets and its note (also after a reload)
And an exercise with nothing saved is removed without a dialog, with the same notification.

**AC-SESSION-29 · Edit date and hours**
Given a finished session of today that started at 18:00 and ended at 19:15
When I open "Datos de la sesión", change "Fecha" to the day before, "Inicio" to 17:30 and "Fin"
to 18:45, and tap "Guardar"
Then the session card shows that day and 17:30, Today no longer counts it in today and counts it
in that day, and everything is still there after a reload
When I set "Fin" earlier than "Inicio", "El fin no puede ser anterior al inicio" shows and
"Guardar" saves nothing
When I set a date after today, "La fecha no puede ser futura" shows and nothing is saved
And for a session in progress the sheet has no "Fin" field.

**AC-SESSION-30 · Change the routine**
Given a session of "Push" with sets saved in its first exercise and nothing in the others
When I choose the routine "Pull" in "Datos de la sesión" and tap "Guardar"
Then the dialog asks "¿Cambiar la sesión a Pull?"; "Cancelar" changes nothing
When I confirm "Cambiar", the session reads "Pull", its cards are those of Pull, and the first
exercise of Push, which has saved sets, stays at the end tagged "Fuera de la rutina" with its
sets
And the exercises of Push without sets are gone
And an exercise that is in both routines and has saved sets keeps its rows and sets
When I choose "Sesión libre", the heading reads "Sesión libre", the exercises with saved sets stay
without the tag and the others go away.

**AC-SESSION-31 · Download the session as JSON**
Given a session with 2 saved sets and an exercise note
When I tap "Descargar JSON"
Then a file `certavi-session-<date>-<id>.json` is downloaded containing the session, its sets
and its note, and no typed value that was not saved
And it also works offline.

**AC-SESSION-32 · The rest timer starts after a new set**
Given an in-progress session of today, with the basic rest at 180 s and the isolation rest at
120 s
When I save the top row of a basic exercise with ✓
Then the bar shows "Descanso", "Siguiente: …" and a time of 3:30 counting down
When I save a warm-up row, the bar restarts at 1:00; an approach row, at 1:30; a back-off row of
a basic exercise, at 3:00; any row of an isolation exercise, at 2:00
And saving by ✓ on an empty row ("Anterior") also starts it.

**AC-SESSION-33 · Rest timer controls and end**
Given the bar is counting
When I tap "+15 s" the time grows by 15 s; when I tap "−15 s" it shrinks by 15 s (never below
0:15 while counting)
When the time is up, the bar reads "¡A por la siguiente serie!"; with "Sonido al acabar el
descanso" on, two beeps sound; with "Vibración" on and a device that vibrates, it vibrates
And about 30 seconds later the bar closes by itself
When I tap "Cerrar descanso" at any moment, the bar closes
And after the time is up, "+15 s" starts the rest again with 15 s.

**AC-SESSION-34 · When the timer does not start**
Then the timer does not start when: I correct a set that was already saved; the session is of
another day; the session is finished
And finishing or deleting the session closes the bar if it is open
And changing the date of the session to another day closes it
And after a reload the bar is not there.

**AC-SESSION-35 · Changes from another device**
Given the session is open on this device and on another one with the same key
When the other device saves a set in this session and syncs
Then this device shows the saved set and the notice "Hay cambios de otro dispositivo en esta
sesión."
And a value typed here and not saved is still there, untouched
When I tap "Cerrar", the notice goes away; when the other device changes something else in the
session, it shows again
And it does not show for this device's own changes, nor for changes to another session.

**AC-SESSION-36 · English, dark mode and small screens for the tools**
Given English and dark mode are on
Then the rest bar, the sheets "Add exercise" and "Session details", the buttons of the cards, the
notices and the notifications are in English, with correct contrast
And at 390×844 there is no horizontal scroll, the rest bar does not cover the last card or the
actions (the page can be scrolled until they show), and the sheets fit with their buttons
reachable.

**AC-SESSION-37 · The routine note shows in the session**
Given a "Lower Full" session
Then the card of "Sentadilla hack con banda" shows its routine note ("Banda morada por defecto. Si usas
otra, apunta el color: …") under its plan line
And the card of an exercise without a routine note shows no such line.

**AC-SESSION-38 · Machine settings in the session**
Given a session with "Press de pecho en máquina" and no settings for it
Then its card has the button "Ajustes" and no settings line
When I press "Ajustes", type "Respaldo" / "3" and "Asiento" / "5" and press "Guardar ajustes"
Then the sheet closes, I see "Ajustes guardados", the card shows "Respaldo 3 · Asiento 5" and the
button reads "Ajustes ✎"
And the detail page of that exercise lists "Respaldo: 3" and "Asiento: 5"
And a typed, unsaved weight in that card is still there.

**AC-SESSION-39 · Machine settings are the same in every session**
Given "Respaldo 3 · Asiento 5" saved for an exercise
When I open another session that has that exercise
Then its card shows the same line.

## 4. Edge cases

- **Double tap on ✓**: saves the set once.
- **Comma or point**: "62,5" and "62.5" both work; "abc" is not accepted.
- **Reload in the middle**: saved sets, rows, types, notes, readiness and finished state are
  kept; typed values are kept as drafts (AC-SESSION-16). Folded or unfolded state of the cards
  is not kept.
- **The last row of an exercise cannot be removed** (it has no "Quitar" button); the exercise
  itself is removed with "Quitar ejercicio".
- **Removing the last exercise** of a routine session leaves it with no exercises ("Sin
  ejercicios todavía.") and "+ Añadir ejercicio".
- **Undo after something else changed**: "Deshacer" brings back what was removed even if other
  rows or exercises changed meanwhile (a removed row goes back to its position and the rows
  below move down; what was added later is not touched). If the same exercise was added again
  in the meantime, nothing is restored and the notification says **"No se puede deshacer: ya
  hay datos nuevos" / "Cannot undo: there is new data"**; the same message shows if the
  session no longer exists. Un-doing the removal of the session does not depend on anything
  else.
- **Notifications are stacked**: removing two things in a row shows two notifications (at most
  3 at once, see AC-DIALOG-05); each "Deshacer" only brings back its own.
- **Reload while a notification with "Deshacer" is open**: the removal stays done and the
  notification is gone (no "Undo" after a reload).
- **Date and routine together**: changing both in one "Guardar" asks for the routine
  confirmation once; cancelling that dialog saves neither.
- **Another session with the same date and routine** may already exist: nothing is merged, both
  stay.
- **Rest timer in a deload week** uses the same times. **Two beeps** are played once per rest;
  closing the bar before the time is up plays none.
- **Vibration** needs a device that supports it (not iPhone's Safari): with the switch on and no
  support, nothing happens and nothing fails.
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

- A rest timer that survives a reload or works with the app closed (notifications), and a
  per-exercise rest time.
- Dragging exercises to reorder them (the buttons "Subir" / "Bajar" are the way), creating a new
  exercise from the "Añadir ejercicio" sheet (Phase 6) and choosing a scheme when adding one.
- "Undo" after a reload, and "Undo" for un-saving a set, changing a type or finishing.
- Other set types (failure…), dragging rows to reorder them, tapping "Anterior" to fill the row.
- The exercise detail page ("Ficha", Phase 6) and the calendar day view (Phase 7).
