# Optional blocks

## 1. Purpose

**Optional blocks** are short routines done next to training: mobility, stretching and
rehabilitation. Each block has a checklist of exercises, the weekdays it is proposed on and,
optionally, values to rate every day (pain from 0 to 10) or once a week (the wall test, in cm).

Today already shows the blocks of the day (checklist, scales, note; see [today.md](today.md)
§2.3). This spec adds:

- the **eleven-box 0–10 scale on one row** on a 390 px screen (§2.1);
- **Bloques / Blocks** (`/settings/blocks`): list, creation and editing of blocks (§2.2, §2.4);
- the **tracking** of a block: charts of its daily values with the 3/10 limit and the weekly
  wall test (§2.3);
- the **calf rule during rehab** (§2.5).

Everything is saved on the device first and works without coverage (see [sync.md](sync.md)).

Seed data (rules.md): **"Rehabilitación del tobillo" / "Ankle rehab"** — active every day, 8
exercises, three 0–10 values with a limit of 3, the weekly wall test — and **"Estiramientos" /
"Stretching"** — inactive, no exercises, no days. The user fills the second one in from the
editor; nothing is preloaded.

## 2. Screens and elements

Texts are given as "Spanish" / "English". Numbers use a decimal comma / point.

### 2.1 The 0–10 scale

Used by the block metrics (0–10) and by "¿Cómo llegas?" in the session (1–5). It is a group of
toggle buttons, one per value, named with the metric ("Dolor al bajar escaleras"). Tapping the
pressed value clears it.

- **All the values are on one row**, whatever the width, down to 360 px: the boxes get narrower
  instead of wrapping. On 390 px the eleven boxes (0…10) share the card's width, about 27 px each,
  and the last one ("10") is level with the first ("0"). A box is at least 44 px high.
- Values above the metric's limit are drawn as a warning (colour **and** the card's message; see
  today.md §2.3), never by colour alone.

### 2.2 Block list

Settings gets a card **"Bloques opcionales" / "Optional blocks"** with a link row
**"Gestionar bloques" / "Manage blocks"** to `/settings/blocks`. The page title is "Bloques opcionales" /
"Optional blocks". It has:

- a button **"Nuevo bloque" / "New block"** (→ §2.4);
- the section **"Activos" / "Active"** and, if any, **"Inactivos" / "Inactive"**. Each block is a
  link whose name is the block's name and which shows the type (**"Movilidad" / "Mobility"**,
  **"Estiramientos" / "Stretching"**, **"Rehabilitación" / "Rehab"**) and a summary:
  "<n> ejercicios · todos los días" / "<n> exercises · every day", the days when fewer than seven
  ("L, X, V" / "M, W, F"), or **"Sin ejercicios" / "No exercises"** when it has none.

Seed on first start: "Rehabilitación del tobillo" under Active, "Estiramientos" under Inactive.
The link opens the block's tracking page (§2.3).

On Today, every block card gets a link **"Ver seguimiento" / "See tracking"** to the same page.

### 2.3 Tracking: `/settings/blocks/:blockId`

Heading with the block's name and a link **"Editar bloque" / "Edit block"**. A block that does
not exist (or was never created) shows the not-found state with a link back to the list.

**Daily values.** For each metric of the block, a card with the metric's name and a line chart:

- a point per day with a value, the vertical axis fixed **0 to 10**, and — when the metric has a
  limit — a **dashed line at 3** with the legend **"Límite 3/10" / "Limit 3/10"**;
- a selector **"Periodo" / "Period"** (shared by all the charts of the page): **"30 días" / "30
  days"** (default), **"90 días" / "90 days"** and **"Todo" / "All"**, counted back from today;
- a text description for screen readers ("Dolor al bajar escaleras (límite 3/10): gráfica de
  líneas, 3 puntos, de 1 a 5") and the table **"Ver datos" / "View data"** (date and value);
- without values in the period: **"Aún no hay registros de esta métrica." / "No entries for this
  metric yet."**

A day with a value above the limit appears in the table with the value followed by
**"(por encima del límite)" / "(above the limit)"**.

**Weekly values.** For each weekly metric (seed: **"Test de la pared" / "Wall test"**, in cm,
parts **"Izquierda" / "Left"** and **"Derecha" / "Right"**) a card with:

- the week range ("2–8 nov"), one number field per part labelled "Izquierda (cm)" / "Left (cm)",
  prefilled with what is saved for this week, and **"Guardar" / "Save"**. Valid values: 0 to 99,
  with decimals; a field may stay empty but not both. Saving shows the toast **"Test de la pared
  guardado · 2–8 nov" / "Wall test saved · 2–8 nov"**; saving again the same week replaces the
  values (one record per block, metric and week);
- a line chart per part over the **last 12 weeks** that have a value (own scale, unit cm), each
  with its description and "Ver datos" table; without weeks: **"Aún no hay registros." / "No
  entries yet."** The period selector does not apply to them.

A block without metrics shows neither section; the page then says **"Este bloque no tiene
métricas." / "This block has no metrics."** A deleted block log or weekly record never counts.

### 2.4 Editor: `/settings/blocks/new` and `/settings/blocks/:blockId/edit`

Fields, in this order:

1. **"Nombre" / "Name"** (required, up to 60 characters). For a seed block the field shows its
   name; the name only becomes custom text if it is changed.
2. **"Tipo" / "Type"**: a selector (Movilidad / Estiramientos / Rehabilitación) when creating;
   when editing, it is shown as text and cannot be changed.
3. **"Activo" / "Active"** checkbox. A new block is active.
4. **"Días" / "Days"**: seven toggle buttons, Monday first, named with the full weekday
   ("lunes" / "Monday") and drawn as the initial. The block is proposed on the pressed days.
   A new block has all of them pressed. None pressed is valid (the block is never proposed).
5. **"Inicio" / "Start"** and **"Próxima revisión" / "Next review"**: optional dates, clearable.
   The review date is the one Today shows ("Revisión: …").
6. **"Ejercicios" / "Exercises"**: the list of the block's items. Each item has **"Nombre" /
   "Name"** (required), **"Dosis" / "Dose"** (free text, e.g. "2 × 30 s por pierna") and
   **"Veces por semana" / "Times per week"** (optional: "3" or "3-5"), and the buttons **"Subir"
   / "Up"**, **"Bajar" / "Down"** and **"Quitar" / "Remove"**, each named with the item
   ("Subir Rodillo en gemelo"). The seed names and doses are shown as text and become custom text
   if edited. **"Añadir ejercicio" / "Add exercise"** adds an empty item at the end.
7. **"Métricas diarias (0–10)" / "Daily values (0–10)"**: each with **"Nombre" / "Name"** and
   **"Límite" / "Limit"** (optional integer 0 to 9; above it is a warning), **"Quitar" /
   "Remove"** and **"Añadir métrica" / "Add value"**. The scale is always 0–10.
8. The block's **weekly values**, if it has any, as read-only text (**"Valores semanales: Test de
   la pared (cm): Izquierda, Derecha" / "Weekly values: Wall test (cm): Left, Right"**).
   They are not editable here; a new block has none.

**"Guardar" / "Save"** validates, saves and goes to the block's tracking page with the toast
**"Bloque guardado" / "Block saved"**; **"Cancelar" / "Cancel"** goes back without saving. Errors
are shown under the field and the first one takes focus: "Escribe un nombre." / "Enter a name.",
"Escribe el nombre de cada ejercicio." / "Enter the name of every exercise.", "Escribe el nombre
de cada métrica." / "Enter the name of every value.", "Usa un número o un rango, como 3 o 3-5." /
"Use a number or a range, like 3 or 3-5.", "El límite va de 0 a 9." / "The limit is between 0 and
9."

Rules for what is stored:

- Every item and metric keeps a stable id; the ticks and values already logged stay with it when
  it is renamed or moved. A new one gets an id made from its name (unique inside the block).
- Removing an item or a metric hides it everywhere (Today, tracking, charts); the old logs stay
  in the data (and in exports).
- Deactivating a block hides it from Today and keeps everything else. There is no "delete": a
  block is deactivated.
- A seed block that was edited is never overwritten by an app update.

### 2.5 Calf rule during rehab

While a block of type **rehab** is **active**, the suggestion of the exercise **"Elevaciones de
gemelo en hack"** (the first of every leg day) obeys one more rule on top of the general
progression (rules.md): it only goes up when going down stairs did not hurt.

- **Gate**: the weight may go up only if the value **"Dolor al bajar escaleras"** logged on a day
  **after** the reference session is **at most 3** (the block's limit). The latest such value
  counts.
- **Otherwise the weight stays** and the hint says **"Mantén <w> kg: solo se sube si al bajar
  escaleras el dolor es 3/10 o menos." / "Stay at <w> kg: go up only if the pain going down
  stairs is 3/10 or less."** The same hint shows when **no value** has been logged since the
  reference session (it says the same thing; it also makes the habit clear).
- The increase is the exercise's own (+5 kg) and never goes **above 80 kg**; at 80 kg or more the
  rule is not applied (the normal progression takes over). Week 1 at 60 kg is the plan's start,
  not something the app enforces.
- The rule does not apply in deload weeks (they never progress), with no rehab block active, or
  to other exercises.

## 3. Acceptance criteria

**AC-BLK-01 · The scale fits one row**
Given a 390×844 screen and the seed block active with its checklist on Today
Then the eleven buttons 0 to 10 of "Dolor al bajar escaleras" are on one row (the "10" has the
same top as the "0") and none is cut off horizontally, and the page does not scroll sideways
And the five buttons 1…5 of "¿Cómo llegas?" in a session are on one row too.

**AC-BLK-02 · Entry points**
When I open Settings
Then there is a card "Bloques opcionales" with "Gestionar bloques", which opens the list
And the list shows "Rehabilitación del tobillo" under "Activos" and "Estiramientos" under
"Inactivos" ("Sin ejercicios") and the button "Nuevo bloque"
And the block card on Today has "Ver seguimiento", which opens the block's page.

**AC-BLK-03 · Create a block**
When I press "Nuevo bloque", enter the name "Movilidad de cadera", leave the days as they are,
add the exercise "Sentadilla profunda" with dose "3 × 30 s" and press "Guardar"
Then I land on its page with "Bloque guardado" and the block is under "Activos"
And Today shows a card "Movilidad de cadera" with the checkbox "Sentadilla profunda" and its dose.

**AC-BLK-04 · Fill in the empty stretching block**
When I edit "Estiramientos", add two exercises, press "L", "X" and "V" only, check "Activo" and
save
Then the list shows it as active with "2 ejercicios · L, X, V"
And on a Monday Today shows its card, and on a Tuesday it does not.

**AC-BLK-05 · Edit exercises**
When I edit the seed block, rename "Rodillo en gemelo" to "Rodillo", move it down one place and
remove "Pogos"
Then Today shows "Rodillo" in the new place and not "Pogos", with the total "<done>/7"
And a tick given to "Rodillo" before the rename is still ticked.

**AC-BLK-06 · Deactivate and reactivate**
When I uncheck "Activo" on the seed block and save
Then Today shows no ankle card and the list shows the block under "Inactivos"
When I activate it again
Then the card is back with what was logged that day.

**AC-BLK-07 · Validation**
When I clear the name and press "Guardar"
Then "Escribe un nombre." is shown, the name field has focus and nothing is saved
And an exercise with an empty name, a "Veces por semana" of "abc" and a limit of 12 each show
their message.

**AC-BLK-08 · Chart with the 3/10 limit**
Given "Dolor al bajar escaleras" logged on several days, one of them with 5
When I open the block's page
Then the chart "Dolor al bajar escaleras" has a dashed line at 3 and the legend "Límite 3/10",
its description mentions the number of points and the range, and "Ver datos" lists the days with
"5 (por encima del límite)" on the right one
When I choose "Todo" after logging something 60 days ago
Then that older value appears, and with "30 días" it does not.

**AC-BLK-09 · Weekly wall test**
When I enter "9,5" in "Izquierda (cm)" and "11" in "Derecha (cm)" and press "Guardar"
Then the toast "Test de la pared guardado · <range>" appears and both fields keep their values
after reloading
And the charts "Izquierda" and "Derecha" show that week
When I enter "12" in "Derecha (cm)" and save again
Then the week has 12, not two values.

**AC-BLK-10 · Calf rule**
Given the rehab block active and the last session of "Elevaciones de gemelo en hack" at 60 kg with
every set at the top of the range
Then the suggestion for the next session reads "Mantén 60 kg: solo se sube si al bajar escaleras
el dolor es 3/10 o menos."
When "Dolor al bajar escaleras" is logged as 2 on a day after that session
Then the suggestion goes up to 65 kg
When it is logged as 5 instead
Then it stays at 60 kg.

**AC-BLK-11 · English and dark mode**
Given the app is in English and dark mode
Then the screens read "Optional blocks", "Manage blocks", "New block", "Limit 3/10", "Wall test"
And the axe check finds no violations on the list, the tracking page and the editor, in light
and dark.

**AC-BLK-12 · Offline**
Given the device is offline
When I create a block, log a value and save the wall test, and reload
Then everything is still there and the sync indicator shows changes waiting.

## 4. Edge cases

- **Block without exercises or metrics** (a new empty block): not shown on Today even if active;
  it is listed ("Sin ejercicios").
- **Today's logs** of items that were removed or metrics that were removed are ignored in the
  totals ("<done>/<total>" counts only the current items).
- **Two devices**: a block is one record; the latest save wins. Logs are one record per block
  and day.
- **Names**: a custom block's name, exercise names and doses are plain text; they are never
  translated.
- **Dates**: the review date follows today.md §2.3; a review date in the past shows nothing.
- **Reordering** the first item up or the last item down does nothing (the buttons are disabled).
- **Block ids** are never reused; a block cannot be deleted, so its logs never point to nothing.
- **Charts** never draw a day without a value; a single point is drawn as a dot with no line.
- **Small screen (390×844)**: no horizontal scroll; every button is at least 44 px high.

## 5. Out of scope

- Deleting a block, restoring the original seed block, and editing weekly values (wall test) in
  the editor; creating weekly values in a new block.
- Editing or backfilling a log on a day other than today, or a weekly value of a past week
  (the calendar does not show block logs either).
- More than one rehab rule (only the calf one) and a general rule list.
- A "once per week" cap on the calf increase: the rule only checks the pain.
- Reminders and notifications.
