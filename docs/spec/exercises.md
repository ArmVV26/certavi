# Exercises: catalog, custom exercises and exercise detail

## 1. Purpose

The **exercise catalog** lists every exercise the user can train, with filters, and lets the user
open the **detail page** of any exercise (records, history and its own weight step), **create
exercises from scratch**, and edit or archive the ones they created. The seed catalog (the exercises
that come with the app) can be browsed and its weight step changed, but not renamed or archived.

The catalog lives inside the **Rutinas / Routines** tab: that tab has two sections, "Rutinas" (the
routines, see [routines.md](routines.md)) and "Ejercicios" (this spec). The bottom navigation does
not change.

Everything is saved on the device first and works without coverage (see [sync.md](sync.md)).
Exercise names, the training rules behind the records and the progression step are described in
[rules.md](rules.md); the "Add exercise" sheet of a session in [session.md](session.md) §2.7.

## 2. Screens and elements

Texts are given as "Spanish" / "English". Numbers follow the language (decimal comma in Spanish).

### 2.1 Sections of the Routines tab

`/routines` and `/exercises` share a header: the page title (**"Rutinas" / "Routines"** or
**"Ejercicios" / "Exercises"**) and, below it, a navigation named **"Rutinas y ejercicios" /
"Routines and exercises"** with two links, **"Rutinas" / "Routines"** and **"Ejercicios" /
"Exercises"**. The link of the current section is marked as the current page. In the bottom
navigation the **Rutinas** tab is the current one on every page of this spec (`/exercises`,
`/exercises/new`, `/exercises/<id>` and `/exercises/<id>/edit`).

### 2.2 The catalog (`/exercises`)

Below the section links, in this order:

- A link **"Crear ejercicio" / "Create exercise"** to the form (§2.4).
- The search field **"Buscar ejercicio" / "Search exercise"** and the same filter chips as the
  "Añadir ejercicio" sheet of a session (session.md §2.7): **muscle group** (one), **equipment**
  (one), **type** (one: "Básico" / "Basic", "Aislamiento" / "Isolation"), **"Straps"**,
  **"Creados por mí" / "Created by me"** and **"En alguna rutina" / "In a routine"**, plus one more
  chip, **"Mostrar archivados" / "Show archived"**. Chips are shown as pressed when on and a second
  tap turns them off. All the active filters apply together.
- A line with the number of results: **"<n> ejercicios" / "<n> exercises"** ("1 ejercicio" /
  "1 exercise"), announced politely when it changes.
- The results, a list named **"Ejercicios" / "Exercises"**, in alphabetical order of the displayed
  name (ignoring case and accents). Each item is a link to the detail page and shows: the name, a
  line **"<grupo> · <equipo>"** (for example "Espalda · Discos" / "Back · Plate-loaded") and small
  tags: **"Straps"** (if the exercise uses straps), **"Propio" / "Mine"** (created by the user) and
  **"Archivado" / "Archived"** (only visible with "Mostrar archivados").
- With no match: **"Ningún ejercicio coincide" / "No exercise matches"**.

Archived exercises are hidden unless "Mostrar archivados" is on. The filters are not remembered:
every visit to the page starts without filters.

### 2.3 The detail page (`/exercises/<id>`)

A page whose header title is **"Ejercicio" / "Exercise"** and whose heading (level 2) is the
exercise name, with a link **"Volver a Ejercicios" / "Back to
Exercises"** to the catalog. For an exercise the user created, the page offers a link **"Editar" /
"Edit"** (to `/exercises/<id>/edit`) and a button **"Archivar" / "Archive"** (for an archived one,
**"Desarchivar" / "Unarchive"**). Seed exercises show neither.

Sections, in this order:

1. **"Datos" / "Details"**: _Grupo principal / Primary group_, _Músculos secundarios / Secondary
   muscles_ (a list, or "Ninguno" / "None"), _Equipo / Equipment_, _Tipo / Type_ ("Básico" /
   "Aislamiento"), _Unilateral_ (Sí/No, Yes/No), _Straps_ (Sí/No), _Banda / Band_ (Sí/No) and
   _Esquema por defecto / Default scheme_ ("<n> series · RIR <rir>", for example "3 series · RIR
   1-2"; "1 serie" for one; no RIR part when it is empty). Tags next to the title: **"Propio" /
   "Mine"** and **"Archivado" / "Archived"** when they apply.
2. **"En rutinas" / "In routines"**: the names of the routines that have the exercise, separated
   by commas, or **"En ninguna rutina" / "In no routine"**.
3. **"Incremento" / "Weight step"**: a number field **"Incremento (kg)" / "Weight step (kg)"**
   with the current step, and a button **"Guardar incremento" / "Save step"**. It works for every
   exercise, seed or not. Saving shows the toast **"Incremento guardado" / "Step saved"**. The step
   must be between 0,25 and 50 kg; otherwise the field shows **"El incremento debe estar entre
   0,25 y 50 kg" / "The step must be between 0.25 and 50 kg"** and nothing is saved. The step is
   what the progression suggestions add to the weight (see rules.md).
4. **"Récords" / "Records"** (only if the exercise has been logged): **"1RM estimado" /
   "Estimated 1RM"**, **"Peso máximo" / "Max weight"** (weight × reps) and **"Mejor volumen" /
   "Best volume"**, each with its value in kg and the date, and **"Mejores marcas por repeticiones"
   / "Best marks by reps"**: a list "<n> reps · <kg> kg", one per repetition count, from the
   rules in rules.md (warm-up and approach sets and deload weeks never set records).
5. **"Historial" / "History"** (only if the exercise has been logged): the sessions where it
   has effective sets, **newest first**. Each entry is a link to that session
   (`/session/<id>`) showing the date and its effective sets as "<kg> × <reps>" separated by
   " · "; with the tags **"Descarga" / "Deload"** and **"No cuenta" / "Does not count"** when they
   apply.

An exercise that has never been logged shows, instead of sections 4 and 5, the message **"Aún no
has registrado este ejercicio" / "You haven't logged this exercise yet"**.

For an id that does not exist the page shows **"No encontramos este ejercicio" / "We couldn't
find this exercise"** with a link to the catalog.

### 2.4 The form (`/exercises/new` and `/exercises/<id>/edit`)

Title **"Crear ejercicio" / "Create exercise"** (or **"Editar ejercicio" / "Edit exercise"**), with
a link back to the catalog (or to the detail page when editing). Fields, in order:

| Field                                                                          | Notes                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nombre / Name**                                                              | Required, up to 80 characters; spaces at the ends are ignored                                                                                                                                                    |
| **Grupo principal / Primary group**                                            | A choice of the ten muscle groups. Starts on "Pecho" / "Chest"                                                                                                                                                   |
| **Músculos secundarios / Secondary muscles**                                   | Checkboxes for the other groups (the primary group is not offered)                                                                                                                                               |
| **Equipo / Equipment**                                                         | The seven kinds of equipment of session.md §2.7. Starts on "Otro" / "Other"                                                                                                                                      |
| **Tipo / Type**                                                                | "Básico" / "Basic" or "Aislamiento" / "Isolation". Starts on "Aislamiento"                                                                                                                                       |
| **Unilateral**, **Usa straps / Uses straps**, **Admite banda / Supports band** | Checkboxes, all off at the start                                                                                                                                                                                 |
| **Esquema por defecto / Default scheme**                                       | A group with **"Series" / "Sets"** (1 to 10, starts on 3), **"Repeticiones" / "Reps"** (`10`, `~10` or `8-12`, starts on `8-12`) and **"RIR"** (`2`, `1-2` or empty, starts on `1-2`). They create straight sets |
| **Incremento (kg) / Weight step (kg)**                                         | Starts on the suggested step for the chosen group, equipment and type (2 kg for dumbbells, 5 kg for leg compounds, 2,5 kg for the rest) and follows those choices until the user types their own value           |

Buttons: **"Guardar" / "Save"** and **"Cancelar" / "Cancel"** (a link; nothing is saved and there
is no confirmation, even with changes).

**Errors.** Pressing "Guardar" with a problem saves nothing, shows a message under each wrong
field (linked to it for screen readers) and moves the focus to the first one:

- empty name: **"Escribe un nombre" / "Enter a name"**; a name longer than 80 characters: **"El
  nombre puede tener hasta 80 caracteres" / "The name can have up to 80 characters"**;
- another exercise (seed or not, archived or not) with the same name once case and accents are
  ignored: **"Ya existe un ejercicio con ese nombre" / "An exercise with that name already
  exists"**. Keeping the exercise's own name when editing is fine;
- step outside 0,25–50 kg: the message of §2.3;
- sets outside 1–10: **"Las series deben ser de 1 a 10" / "Sets must be from 1 to 10"**;
- reps not like `10`, `~10` or `8-12`: **"Repeticiones no válidas: usa 10, ~10 u 8-12" / "Invalid
  reps: use 10, ~10 or 8-12"**;
- RIR not like `2`, `1-2` or empty: **"RIR no válido: usa 2 o 1-2, o déjalo vacío" / "Invalid RIR:
  use 2 or 1-2, or leave it empty"**.

**After saving.** A new exercise opens its detail page with the toast **"Ejercicio creado" /
"Exercise created"**; an edited one goes back to its detail page with **"Cambios guardados" /
"Changes saved"**. The exercise keeps its id, so its history is never lost when it is renamed or
changed.

The edit page of a seed exercise or of an unknown id sends the user to the detail page
(or to its "not found" message).

### 2.5 Archiving

"Archivar" opens a dialog **"¿Archivar este ejercicio?" / "Archive this exercise?"**: "Dejará de
aparecer en la lista y al añadirlo a una sesión. Su historial se conserva y podrás desarchivarlo."
/ "It will stop appearing in the list and when adding it to a session. Its history is kept and
you can unarchive it." with **"Archivar" / "Archive"** and **"Cancelar" / "Cancel"**. Confirming
archives it (toast **"Ejercicio archivado" / "Exercise archived"**) and the page now offers
"Desarchivar", which restores it at once (toast **"Ejercicio restaurado" / "Exercise restored"**,
no dialog). Archived exercises are not offered in the "Añadir ejercicio" sheet, but sessions that
already have them keep them.

An exercise that is **in a routine cannot be archived**: pressing "Archivar" opens a dialog titled
**"No se puede archivar" / "It can't be archived"** that says **"Está en la rutina <nombre>.
Quítalo de la rutina antes." / "It is in the routine <name>. Remove it from the routine
first."** (several routines are separated by commas) and has a single button **"Entendido" /
"Got it"**.

### 2.6 Creating an exercise from a session

The sheet **"Añadir ejercicio"** of a session has a button **"Crear ejercicio" / "Create
exercise"** at the top. It opens the form (§2.4); when the exercise is saved it is **added at the
end of that session** and the app returns to the session with the toast **"Ejercicio creado y
añadido a la sesión" / "Exercise created and added to the session"**. "Cancelar" returns to the
session. What was typed in the session and not saved yet is kept (session.md §4).

## 3. Acceptance criteria

**AC-EXERCISES-01 · Reach the catalog**
Given I am on Today
When I open "Rutinas" in the bottom navigation and then the link "Ejercicios"
Then I am on "Ejercicios", the "Rutinas" tab of the bottom navigation is the current one and the
link "Ejercicios" of "Rutinas y ejercicios" is the current page.

**AC-EXERCISES-02 · The list**
Given a fresh install
When I open "Ejercicios"
Then I see the seed exercises in alphabetical order, each with "<grupo> · <equipo>"
And the count line matches the number of items
And "Remo en T" shows the tag "Straps" and "Aperturas en máquina" does not.

**AC-EXERCISES-03 · Search**
Given the catalog
When I type "remo" in "Buscar ejercicio"
Then only the exercises whose name contains "remo" (ignoring case and accents) are listed, among
them "Remo en T"
And "Ningún ejercicio coincide" appears if I type "zzz".

**AC-EXERCISES-04 · Combined filters**
Given the catalog
When I turn on the chips "Espalda" and "Straps"
Then every listed exercise is a back exercise that uses straps
And turning on "Mancuernas" as well gives "Ningún ejercicio coincide"
And turning a chip off again removes only that filter.

**AC-EXERCISES-05 · Open the detail page of an exercise with history**
Given I logged two sessions of "Remo en T" (a deload week among them is optional)
When I open "Remo en T" from the catalog
Then the page shows its data, "En rutinas" with the routines that have it, the records and the
history with the newest session first
And each history entry opens its session.

**AC-EXERCISES-06 · Exercise never logged**
Given I never logged "Dominadas"
When I open its detail page
Then I see "Aún no has registrado este ejercicio" and no "Récords" or "Historial" sections.

**AC-EXERCISES-07 · Change the weight step**
Given the detail page of a seed exercise
When I change "Incremento (kg)" to 5 and press "Guardar incremento"
Then I see "Incremento guardado"
And after reloading the page the field still shows 5.

**AC-EXERCISES-08 · Invalid weight step**
Given the detail page of an exercise
When I type 0 (or 60) in "Incremento (kg)" and press "Guardar incremento"
Then I see the message about the range 0,25–50 kg and the saved step does not change.

**AC-EXERCISES-09 · Create an exercise**
Given the catalog
When I press "Crear ejercicio", type the name "Press landmine", choose the group "Hombro" and
the equipment "Barra", and press "Guardar"
Then I see its detail page with the toast "Ejercicio creado" and the tag "Propio"
And in the catalog it is listed with "Hombro · Barra" and the tag "Propio"
And the chip "Creados por mí" lists it, and only it.

**AC-EXERCISES-10 · Name rules**
Given the form
When I press "Guardar" with an empty name
Then I see "Escribe un nombre", the name field has the focus and nothing is saved
And when I type "REMO EN T" (or "remo en t") and press "Guardar" I see "Ya existe un ejercicio con
ese nombre".

**AC-EXERCISES-11 · Other field rules**
Given the form with a name
When I set "Repeticiones" to "abc", "Series" to 0 or "Incremento (kg)" to 0 and press "Guardar"
Then each wrong field shows its message and nothing is saved.

**AC-EXERCISES-12 · The suggested step follows the choices**
Given the form
When I choose the equipment "Mancuernas" the step shows 2
And when I choose a lower-body group and the type "Básico" with other equipment it shows 5
And once I type my own value, changing the group no longer changes it.

**AC-EXERCISES-13 · A created exercise survives a reload**
Given I created "Press landmine"
When I reload the page (also without connection)
Then "Press landmine" is still in the catalog.

**AC-EXERCISES-14 · The new exercise can be used in a session**
Given a created exercise
When I open a session, press "+ Añadir ejercicio" and search "landmine"
Then it is listed ("Hombro · Barra") and tapping it adds it to the session with its default
scheme (3 sets).

**AC-EXERCISES-15 · Create from the session**
Given an active session
When I press "+ Añadir ejercicio", then "Crear ejercicio", fill the form and press "Guardar"
Then I am back in the session, the new exercise is its last card and I see "Ejercicio creado y
añadido a la sesión"
And pressing "Cancelar" instead returns to the session without adding anything.

**AC-EXERCISES-16 · Edit an exercise I created**
Given an exercise I created and used in a session
When I open "Editar", change the name and the equipment and press "Guardar"
Then I see "Cambios guardados" and the new data on the detail page
And the session and the history show the new name, with the same sets.

**AC-EXERCISES-17 · Seed exercises cannot be edited or archived**
Given the detail page of a seed exercise
Then there are no "Editar" or "Archivar" controls
And opening `/exercises/remo-t/edit` shows the detail page of "Remo en T".

**AC-EXERCISES-18 · Archive and unarchive**
Given an exercise I created
When I press "Archivar" and confirm
Then I see "Ejercicio archivado", the page shows the tag "Archivado" and the button "Desarchivar"
And it is no longer listed in the catalog nor in the "Añadir ejercicio" sheet
And with "Mostrar archivados" on, the catalog lists it with the tag "Archivado"
And "Desarchivar" shows "Ejercicio restaurado" and lists it again.

**AC-EXERCISES-19 · Cancel archiving**
Given the archive dialog
When I press "Cancelar" (or Escape)
Then the exercise is not archived.

**AC-EXERCISES-20 · English, theme and small screen**
Given the language is English and the theme dark
Then every text of this spec appears in English, the layout fits 390 px without horizontal scroll
and there are no accessibility violations on the catalog, the detail page and the form.

## 4. Edge cases

- **Without connection:** creating, editing, archiving and changing the step work the same; they
  sync later (see sync.md). Two devices that edit the same exercise: the last change wins as a
  whole record, like every record.
- **Same name on two devices:** each device checks only its own data, so two exercises with the
  same name can end up existing after a sync. Both are kept; the user can archive one.
- **Names are free text:** a created exercise is never translated, whatever the language.
- **Renaming** keeps the id: sessions, sets, notes and records stay attached to the exercise.
- **Archiving an exercise that is in a routine** is refused (§2.5). Routines can contain created
  exercises once the routine editor is there (see routines.md).
- **A very long name** wraps to several lines in the list and the detail page.
- **Archived exercise opened by its URL** works (it shows the tag and "Desarchivar").
- **Seed exercises whose step was changed** keep their custom step after the app is updated.

## 5. Out of scope

- Deleting an exercise (archiving is the way; the history is never lost).
- Renaming, changing or archiving seed exercises, and photos of the machines (backlog v2).
- Choosing a default scheme with a top set and back-off sets when creating an exercise (the form
  creates straight sets; the routine editor can build any scheme).
- The evolution chart of the exercise (Phase 7, with the rest of the charts).
- Merging two exercises and importing exercises from a file other than the full backup.
