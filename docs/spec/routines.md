# Routines: list, viewer and editor

## 1. Purpose

The **Routines** section (first section of the **Rutinas / Routines** tab, next to the exercise
catalog of [exercises.md](exercises.md)) lists the six routines of the training plan — Push, Pull,
Lower B, Upper, Lower A and Lower Full — lets the user **look at a routine without starting a
session**, **edit** it (exercises, order, sets, reps, RIR, notes, optional) and **restore the
original** one.

Only these six routines exist. Their **name and day of the week cannot be changed** (the plan of
each day depends on them) and routines cannot be created or deleted.

A change to a routine applies to the **sessions created from then on**. Sessions already started
and the weeks already closed keep the plan they had (a session keeps its own copy of the routine,
see [session.md](session.md)). The sets planned for the open week (card "Esta semana" in
[today.md](today.md)) are counted from the routines as they are now.

Everything is saved on the device first and works without coverage (see [sync.md](sync.md)).

## 2. Screens and elements

Texts are given as "Spanish" / "English". Numbers follow the language.

### 2.1 The list (`/routines`)

Page title **"Rutinas" / "Routines"**. Below the section links ("Rutinas y ejercicios", see
exercises.md §2.1) there is the heading (level 2) **"Tus rutinas" / "Your routines"** and under it the list with the six
routines in the order of their day (Monday first); the routine without a fixed day is last. Each
item is a link to the routine (§2.2) and shows:

- the name (**Push, Pull, Lower B, Upper, Lower A, Lower Full**, the same in both languages) and,
  if the routine differs from the original, the tag **"Editada" / "Edited"**;
- the day: **Lunes … Domingo / Monday … Sunday**, or **"Sin día fijo" / "Any day"** (Lower Full);
- the summary **"<n> ejercicios · <m> series" / "<n> exercises · <m> sets"** ("1 ejercicio" /
  "1 exercise", "1 serie" / "1 set"). The sets are all the planned sets of the routine (approach
  sets included). On a fresh install: Push **"7 ejercicios · 19 series"**, Pull
  **"8 ejercicios · 23 series"**.

Fresh install: the order is Push (Lunes), Pull (Martes), Lower B (Miércoles), Upper (Viernes),
Lower A (Domingo), Lower Full (Sin día fijo), and none is tagged "Editada".

### 2.2 The viewer (`/routines/<id>`)

Page title **"Rutina" / "Routine"**; heading (level 2) the routine name. It never creates or
changes anything. Elements, in this order:

- a link **"Volver a Rutinas" / "Back to Routines"** to the list;
- the tag **"Editada" / "Edited"** when it differs from the original, the day and the summary, as
  in the list;
- a link **"Editar" / "Edit"** (to `/routines/<id>/edit`) and, only when the routine is edited, a
  button **"Restaurar original" / "Restore original"** (§2.4);
- a section **"Ejercicios" / "Exercises"** with an ordered list named **"Ejercicios de la rutina"
  / "Routine exercises"**, in the routine's order. Each item is a **card** (surface with border
  and rounded corners, like the exercise cards of a session) that shows:
  - the exercise name as a heading (level 4, plain text — not a link and not underlined) and the
    tag **"Opcional" / "Optional"** when it is optional;
  - its muscle group, for example "Pecho" / "Chest";
  - its scheme as text, built from its blocks joined by " + " and followed by " · RIR <rir>" if
    there is a RIR. A block is "<n> aprox." / "<n> appr." (approach), "<n> top", "<n> back-off",
    "<n> bilbo" — each followed by its reps when it has some, for example "1 top 6-8" — or
    "<n> × <reps>" for straight sets. Examples: **"1 top 6-8 + 2 back-off 8-10 · RIR 1-2"**,
    **"3 × 10-15 · RIR 1-2"**, **"1 aprox. + 1 top 6-8 + 2 back-off 8-10 · RIR 1-2"** (Spanish;
    English "1 appr. + …");
  - the note of the exercise in the routine, if it has one;
  - a link that looks like a button, **"Ver ficha" / "View sheet"** with a chevron, to its detail
    page (`/exercises/<exerciseId>`). Its accessible name is **"Ver ficha de <ejercicio>" / "View
    <exercise> sheet"**. It is at least 44 px high.

The note of an exercise in the routine is also shown in that exercise's card during a session
(session.md §2.2).

A routine without exercises (it cannot be saved like that, but it could arrive from another
device) shows **"Esta rutina no tiene ejercicios" / "This routine has no exercises"**.
For an id that does not exist the page shows **"No encontramos esta rutina" / "We couldn't find
this routine"** with a link back to the list.

### 2.3 The editor (`/routines/<id>/edit`)

Page title **"Editar rutina" / "Edit routine"**; heading (level 2) the routine name. Changes are
kept in the page only: **nothing is saved until "Guardar"**. Elements, in this order:

- the buttons **"Guardar" / "Save"** and **"Descartar" / "Discard"**;
- the summary line **"<n> ejercicios · <m> series"** of the routine _as being edited_, which
  changes with every edit;
- a navigation **"Ir a un ejercicio" / "Jump to an exercise"** with one chip per exercise, in the
  routine's order, numbered from 1: **"1 Press inclinado con mancuernas"**, **"2 …"**. The chips
  wrap onto several rows so that **all of them are visible without scrolling sideways**. Tapping a
  chip scrolls the page to that exercise's card (below the sticky header) and moves the focus to
  its heading. The chips follow the list as it is being edited: moving an exercise changes the
  order and the numbers, adding one adds its chip at the end, removing one takes its chip out (and
  "Deshacer" puts it back in its place). Nothing is saved or marked as changed by tapping a chip;
- the list **"Ejercicios de la rutina" / "Routine exercises"**; each exercise is a group named
  after the exercise (heading level 3) with:
  - the buttons **"Subir <ejercicio>" / "Move <exercise> up"**, **"Bajar <ejercicio>" / "Move
    <exercise> down"** (disabled for the first / the last) and **"Quitar <ejercicio>" / "Remove
    <exercise>"**;
  - the checkbox **"Opcional" / "Optional"** (optional exercises are dropped in deload weeks, see
    rules.md);
  - its sets, a list named **"Series" / "Sets"** with one row per planned set, numbered from 1.
    Each row has: a select **"Tipo de la serie <n>" / "Type of set <n>"** (**Aproximación, Top
    set, Back-off, Serie de trabajo, Bilbo** / Approach, Top set, Back-off, Working set, Bilbo),
    a text field **"Repeticiones de la serie <n>" / "Reps of set <n>"** and a button **"Quitar
    serie <n>" / "Remove set <n>"** (disabled when it is the only set);
  - a button **"Añadir serie" / "Add set"**: adds a set at the end, a copy of the last one (a top
    set becomes a back-off), at most **20 sets** per exercise (then the button is disabled);
  - a text field **"RIR objetivo" / "Target RIR"** with the hint **"Por ejemplo 2 o 1-2" / "For
    example 2 or 1-2"**;
  - a text area **"Nota" / "Note"**. The notes that come with the app show their text and can be
    edited or emptied.
- the button **"Añadir ejercicio" / "Add exercise"**, which opens the same sheet as a session
  (session.md §2.7: search and filters; the exercises already in the routine appear disabled with
  **"Ya está en la rutina" / "Already in the routine"**; archived exercises are not offered). Tapping an
  exercise adds it at the end with a copy of its default scheme and closes the sheet.

Rules for the fields:

- **Reps** are written as `8`, `~10` (about ten) or `6-8` (a range, the first number not larger
  than the second, and not zero). They can be empty only in an approach set.
- **RIR** is written as `2` or `1-2` (first not larger than the second), or left empty.
- A routine needs at least one exercise; an exercise always keeps at least one set.

**Removing an exercise** takes it out of the list at once and shows the toast **"<ejercicio>
quitado" / "<exercise> removed"** with the action **"Deshacer" / "Undo"**, which puts it back in
the same place with the same sets.

**Saving.** "Guardar" checks the whole routine. If something is wrong nothing is saved: a message
**"Revisa la rutina: hay campos con errores" / "Check the routine: some fields have errors"** (an
alert) appears at the top, every wrong field shows its message and the first one gets the focus.
Messages: **"Indica las repeticiones" / "Enter the reps"**, **"Escribe las repeticiones como 8, ~10
o 6-8" / "Write the reps as 8, ~10 or 6-8"**, **"Escribe el RIR como 2 o 1-2" / "Write the RIR as 2
or 1-2"**, and, for the routine as a whole, **"La rutina necesita al menos un ejercicio" / "The
routine needs at least one exercise"**. When everything is valid, the routine is saved, the toast
**"Rutina guardada" / "Routine saved"** appears and the page goes to the viewer (§2.2). Saving
without having changed anything just goes back to the viewer.

**Leaving with unsaved changes.** "Descartar" and any other navigation (bottom
tabs, section links, the browser's back button) ask first when there are changes: a dialog
**"¿Descartar los cambios?" / "Discard changes?"** with the text **"Tienes cambios sin guardar en
esta rutina." / "You have unsaved changes in this routine."** and the buttons **"Descartar
cambios" / "Discard changes"** and **"Seguir editando" / "Keep editing"** (focus starts on the
second one). Without changes the page is left at once. Closing or reloading the browser tab with
changes shows the browser's own warning; if the page is reloaded the unsaved changes are lost and
the editor shows the saved routine.

### 2.4 Restoring the original

The button **"Restaurar original" / "Restore original"** of the viewer opens the dialog
**"¿Restaurar la rutina original?" / "Restore the original routine?"** with the text **"Se
perderán los cambios que hiciste en <rutina>. Las sesiones ya empezadas no cambian." / "The
changes you made to <routine> will be lost. Sessions already started don't change."** and the
buttons **"Restaurar" / "Restore"** and **"Cancelar" / "Cancel"** (focus starts on Cancel).
Confirming puts back the exercises, order, sets, reps, RIR, notes and optional flags that come
with the app, shows the toast **"Rutina restaurada" / "Routine restored"**, removes the tag
"Editada" and hides the button. The restored routine is a new change like any other, so it
reaches the other devices (see sync.md).

## 3. Acceptance criteria

**AC-ROUTINES-01 · The list**
Given a fresh install
When I open "Rutinas"
Then I see the list "Tus rutinas" with Push, Pull, Lower B, Upper, Lower A and Lower Full in that
order, each with its day and its summary ("Push": "Lunes", "7 ejercicios · 19 series")
And none is tagged "Editada"
And "Rutinas" is the current link of "Rutinas y ejercicios" and the Rutinas tab of the bottom
navigation is the current one.

**AC-ROUTINES-02 · The viewer creates nothing**
Given a fresh install
When I open "Push" from the list
Then I see its exercises in order with their schemes ("Press inclinado con mancuernas": "1 top
6-8 + 2 back-off 8-10 · RIR 1-2") and the note of the exercises that have one
And there is no "Restaurar original" button
And Today still shows no session started (opening a routine never creates a session).

**AC-ROUTINES-03 · From the viewer to an exercise**
Given the viewer of "Push"
Then each exercise is a card with its name as heading, its group, its scheme and a "Ver ficha"
button-like link (the names are not links)
When I tap "Ver ficha de Aperturas en máquina"
Then I am on the detail page of that exercise, and its "En rutinas" section lists "Push".

**AC-ROUTINES-04 · Add an exercise**
Given the editor of "Push"
When I tap "Añadir ejercicio", search "remo" and tap "Remo en T"
Then the sheet closes and "Remo en T" is the last exercise of the editor with its default sets
And the summary line adds its sets
And when I tap "Guardar" the viewer shows "Remo en T" last and the list shows the new summary.

**AC-ROUTINES-05 · An exercise already in the routine**
Given the editor of "Push"
When I open "Añadir ejercicio" and search "inclinado"
Then "Press inclinado con mancuernas" appears disabled with "Ya está en la rutina".

**AC-ROUTINES-06 · Remove and undo**
Given the editor of "Push"
When I tap "Quitar Aperturas en máquina"
Then the exercise disappears, the summary line loses its sets and the toast "Aperturas en máquina
quitado" offers "Deshacer"
And when I tap "Deshacer" it is back in the same place with its three sets.

**AC-ROUTINES-07 · Reorder**
Given the editor of "Push"
When I tap "Bajar Press inclinado con mancuernas"
Then it is the second exercise and "Press de pecho en máquina vertical" the first
And "Subir" of the first exercise and "Bajar" of the last one are disabled
And after "Guardar" the viewer shows the new order.

**AC-ROUTINES-08 · Add and remove sets**
Given the editor of "Push" and its exercise "Aperturas en máquina" (3 sets)
When I tap "Añadir serie" in that exercise
Then it has 4 sets and the summary line adds one set
And when I tap "Quitar serie 4" it has 3 again
And the exercise with a single set has "Quitar serie 1" disabled
And "Añadir serie" is disabled when the exercise has 20 sets.

**AC-ROUTINES-09 · Change type, reps and RIR**
Given the editor of "Push" and "Press inclinado con mancuernas" ("1 top 6-8 + 2 back-off 8-10 ·
RIR 1-2")
When I set the type of set 1 to "Serie de trabajo", its reps to "5", and the target RIR to "2"
And I tap "Guardar"
Then the viewer shows that exercise as **"1 × 5 + 2 back-off 8-10 · RIR 2"** (set 1 is now a
working set of its own; the two back-off sets stay).

**AC-ROUTINES-10 · Optional and note**
Given the editor of "Pull"
When I tick "Opcional" on "Remo en T", write the note "Agarre ancho" in its "Nota" and save
Then the viewer shows "Remo en T" with the tag "Opcional" and the note "Agarre ancho"
And the note of an exercise that came with a note (for example "Elevaciones de gemelo en hack" in
"Lower B") is
shown in its "Nota" field and can be emptied; emptied and saved, the viewer shows no note for it.

**AC-ROUTINES-11 · Invalid values are not saved**
Given the editor of "Push"
When I empty the reps of a working set and tap "Guardar"
Then nothing is saved, I see the alert "Revisa la rutina: hay campos con errores", the field shows
"Indica las repeticiones" and has the focus
And when I write "10-6" it shows "Escribe las repeticiones como 8, ~10 o 6-8"
And when I write "abc" in the RIR it shows "Escribe el RIR como 2 o 1-2"
And when I remove all the exercises the page shows "La rutina necesita al menos un ejercicio"
and cannot be saved
And an approach set with empty reps is valid.

**AC-ROUTINES-12 · Discard**
Given the editor of "Push" with a change
When I tap "Descartar"
Then I see "¿Descartar los cambios?"
And "Seguir editando" closes the dialog and keeps my changes
And "Descartar cambios" goes to the viewer, which shows the routine as it was
And with no changes, "Descartar" goes to the viewer without asking.

**AC-ROUTINES-13 · Leaving by another way asks too**
Given the editor of "Push" with a change
When I tap another tab of the bottom navigation
Then I see "¿Descartar los cambios?"; "Seguir editando" keeps me in the editor and "Descartar
cambios" goes to that tab.

**AC-ROUTINES-14 · Reload in the middle**
Given the editor of "Push" with a change that I did not save
When I reload the page
Then the editor shows "Push" as it was saved, without my change.

**AC-ROUTINES-15 · Saved, edited and persistent**
Given I removed "Aperturas en máquina" from "Push" and saved
Then the list tags "Push" with "Editada" and shows "6 ejercicios · 16 series"
And the viewer of "Push" has the same tag
And after reloading the page the change is still there, also without connection.

**AC-ROUTINES-16 · New sessions use the edited routine**
Given "Push" edited as in AC-ROUTINES-15 and a session of "Push" already started before the edit
When I start a new "Push" session on another date (today.md, "Otra sesión u otro día")
Then it has 6 exercises and does not include "Aperturas en máquina"
And the session started before the edit still has all its exercises and its sets.

**AC-ROUTINES-17 · The week's plan follows the routines**
Given "Push" edited as in AC-ROUTINES-15
Then the sets planned for the chest in the open week (Today, card "Esta semana") are lower than
before the edit by the sets that "Aperturas en máquina" had.

**AC-ROUTINES-18 · Restore the original**
Given "Push" is tagged "Editada"
When I open it, tap "Restaurar original" and "Cancelar"
Then nothing changes
And when I tap "Restaurar original" and then "Restaurar", the toast "Rutina restaurada" appears,
the viewer shows the seven original exercises ("7 ejercicios · 19 series"), the tag "Editada" and
the button disappear, and the list shows the original summary.

**AC-ROUTINES-19 · A routine of my own exercise**
Given I created the exercise "Mi remo" (exercises.md)
When I add it to "Pull" in the editor and save
Then the viewer shows "Mi remo" in "Pull"
And its detail page lists "Pull" in "En rutinas", and archiving it is refused (exercises.md §2.5).

**AC-ROUTINES-20 · Unknown routine**
When I open `/routines/xyz` or `/routines/xyz/edit`
Then I see "No encontramos esta rutina" and a link back to the list.

**AC-ROUTINES-21 · Appearance**
The list, the viewer and the editor work in light and dark mode, in English (with the texts of §2)
and at 390 px wide without horizontal scrolling, and pass the axe accessibility checks.

**AC-ROUTINES-22 · Jump chips**
Given the editor of "Push" (7 exercises)
Then the navigation "Ir a un ejercicio" shows 7 chips "1 Press inclinado con mancuernas" …
"7 …", all visible at 390 px wide without horizontal scroll
When I tap the chip of the last exercise
Then that exercise's card is in view (not under the header) and its heading has the focus
And nothing was changed (leaving the page does not ask to discard)
When I tap "Bajar Press inclinado con mancuernas"
Then the first chip is now "1 Press de pecho en máquina vertical" and "2 Press inclinado con
mancuernas"
When I remove an exercise the chips lose it and renumber, and "Deshacer" restores it
When I add "Remo en T" it appears as the last chip.

## 4. Edge cases

- **Without connection:** viewing, editing, saving and restoring work the same; they sync later.
  Two devices that edit the same routine: the last save wins as a whole routine, like every record.
- **Edited on another device while the editor is open:** the editor keeps working on what it
  loaded; saving replaces the routine with it (last write wins).
- **Sessions already started** keep their own copy of the plan: editing or restoring the routine
  never changes them, and neither does it change the sets already logged in them.
- **Exercise names** are shown translated (seed) or as typed (created by the user).
- **A routine with exercises dropped on a deload week:** unchanged, the optional exercises of the
  edited routine are the ones dropped (rules.md).
- **Very long notes** wrap; the note field grows with its content.

## 5. Out of scope

- Creating, renaming, deleting or moving to another day any routine (backlog v2).
- Editing the week plan, the day of the routine or the size of the week (see today.md).
- Reordering sets by dragging, or copying a routine.
- A history of the changes of a routine.
