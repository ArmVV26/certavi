# Data on the device, import and export

## 1. Purpose

Everything Certavi records is saved **on the device first**, so the app works without
coverage and never loses data, even if the page is reloaded or closed. Settings shows what is
stored on this device. In the second part of Phase 3, Settings also imports the data of the
previous app (gym_app), imports and exports Certavi backups, and exports spreadsheets (CSV)
for Excel.

The spec has two parts, delivered in two steps:

- **Part A — local data** (`feature/local-db`): the "Datos" card in Settings. Final.
- **Part B — import and export** (`feature/import-export`): import from gym_app, Certavi
  backups and CSV exports. Final.

## 2. Part A — the "Datos" / "Data" card

### Screens and elements

On **Ajustes / Settings** (`/settings`), a card with the heading **"Datos" / "Data"**, placed
after "Apariencia" and before "Desarrollo".

- Text: "Todo se guarda primero en este dispositivo." / "Everything is saved on this device
  first."
- While the data is loading: "Cargando…" / "Loading…".
- Then a list of what is stored on this device, one row per kind of record, with the number
  on the right, in this order:

  | Spanish                   | English             | On a new device |
  | ------------------------- | ------------------- | --------------- |
  | Ejercicios                | Exercises           | 45              |
  | Rutinas                   | Routines            | 6               |
  | Sesiones                  | Sessions            | 0               |
  | Series                    | Sets                | 0               |
  | Notas de ejercicio        | Exercise notes      | 0               |
  | Actividades               | Activities          | 0               |
  | Pesos semanales           | Weekly body weights | 0               |
  | Semanas                   | Weeks               | 0               |
  | Bloques opcionales        | Optional blocks     | 2               |
  | Registros de bloques      | Block logs          | 0               |
  | Métricas semanales        | Weekly metrics      | 0               |
  | Pendientes de sincronizar | Waiting to sync     | 0               |

  "On a new device" is what a first visit shows: the built-in catalog (45 exercises), the 6
  routines and the 2 optional blocks (ankle rehab and stretching). Built-in data is never
  "waiting to sync".

- A row **"Almacenamiento" / "Storage"** with one of:
  - "Persistente" / "Persistent" — the browser has promised not to delete the data;
  - "El navegador podría borrarlo si falta espacio" / "The browser may delete it if space runs
    low";
  - "Sin información del navegador" / "No information from the browser".

  On first start the app asks the browser to keep its data (some browsers decide on their
  own; none of them shows a question in Chromium or Safari).

Numbers use the active language's format (e.g. "12.345" in Spanish, "12,345" in English;
Spanish does not group four-digit numbers: "1234").

### Acceptance criteria

**AC-DATA-01 · The card shows the built-in data on a new device**
Given a browser that has never opened Certavi
When I open Ajustes
Then the card "Datos" lists Ejercicios 45, Rutinas 6, Bloques opcionales 2, and 0 for
Sesiones, Series, Notas de ejercicio, Actividades, Pesos semanales, Semanas, Registros de
bloques, Métricas semanales and Pendientes de sincronizar.

**AC-DATA-02 · Reloading keeps the data**
Given I opened Ajustes and saw the counts
When I reload the page (and also after closing the tab and opening the app again)
Then the counts are the same; the built-in data is not duplicated (Ejercicios is still 45).

**AC-DATA-03 · Storage row**
Given I am on Ajustes
Then the card has a row "Almacenamiento" with one of the three texts above.

**AC-DATA-04 · English**
Given the language is English
When I open Settings
Then the card is titled "Data" and its rows use the English labels of the table above.

**AC-DATA-05 · Accessible in light and dark**
Given Ajustes in light and in dark theme
Then the page has no accessibility violations (axe) and the card is readable at 390×844
without horizontal scrolling.

### Edge cases

- Offline: the card works the same (nothing comes from the network).
- Two tabs open at once: both show the same counts.
- Private browsing: the data may be lost when the private window closes; the storage row may
  say the browser could delete it.

### Out of scope (Part A)

Editing data from the UI (Phases 5–7), sync (Phase 4), import and export (Part B).

## 3. Part B — import and export

### Screens and elements

Inside the "Datos" / "Data" card, after the storage row, two groups with a level-3 heading:

- **"Importar" / "Import"**
  - Button **"Importar desde la app anterior"** / "Import from the previous app" — opens the
    file picker for the full-copy JSON exported by gym_app ("Copia completa (.json)").
  - Button **"Importar copia de Certavi"** / "Import a Certavi backup" — opens the file picker
    for a JSON exported by Certavi.
- **"Exportar" / "Export"**
  - **"Exportar copia completa (.json)"** / "Export full backup (.json)" — downloads
    `certavi-backup-<today>.json` with every record on this device.
  - **"Exportar series (.csv)"** / "Export sets (.csv)" — downloads `certavi-sets-<today>.csv`.
  - **"Exportar actividad y peso (.csv)"** / "Export activity and weight (.csv)" — downloads
    `certavi-activity-weight-<today>.csv`.

`<today>` is the local date as `YYYY-MM-DD`.

#### Import preview

After choosing a valid file, a dialog opens **before anything is saved**:

- Title: the name of the button that opened it.
- Text: "Se guardará en este dispositivo:" / "This will be saved on this device:".
- A list labelled **"Resumen de la importación"** / "Import summary" with one row per kind of
  record that will be written (same labels as the counts list, e.g. "Sesiones 3"), only for
  kinds with at least one record, followed by — when not zero:
  - "Sin cambios (ya estaban)" / "Unchanged (already here)": records this device already has
    in the same or a newer version;
  - "Ignorados (borrados o ajustes internos)" / "Ignored (deleted or internal settings)";
  - "No válidos (no se importan)" / "Invalid (not imported)".
- Buttons **"Cancelar"** / "Cancel" and **"Importar"** / "Import". Focus starts on Cancel.
- If there is nothing new, the text is "No hay nada nuevo que importar." / "There is nothing
  new to import." and the only button is **"Cerrar"** / "Close".

"Importar" saves everything in one go and shows the message **"Registros importados: N"** /
"Records imported: N". The counts of the card update at once.

#### Errors

A message (notification) appears and nothing is saved:

- in "Importar desde la app anterior", a file that is not JSON or not a gym_app full copy:
  "Este archivo no es una copia completa de la app anterior." / "This file is not a full
  backup of the previous app.";
- in "Importar copia de Certavi", a file that is not a Certavi backup: "Este archivo no es una
  copia de Certavi." / "This file is not a Certavi backup.";
- if saving fails: "No se pudo importar. No se ha guardado nada." / "The import failed.
  Nothing was saved."

#### What the gym_app import brings

| gym_app                                 | Certavi                                         |
| --------------------------------------- | ----------------------------------------------- |
| sessions (free sessions included)       | Sesiones                                        |
| sets (warm-ups and extra sets included) | Series                                          |
| exercise notes                          | Notas de ejercicio                              |
| activities                              | Actividades                                     |
| weekly body weight                      | Pesos semanales                                 |
| weeks (hiking, deload, closed plan)     | Semanas                                         |
| edited routines                         | Rutinas (replace the built-in routine)          |
| per-exercise increments                 | Ejercicios (the increment of that exercise)     |
| ankle recovery days                     | Registros de bloques (ankle rehab block)        |
| wall tests                              | Métricas semanales (ankle rehab block)          |
| recovery settings                       | Bloques opcionales (ankle rehab: active, dates) |
| deleted records, internal settings      | Ignorados                                       |

The old exercise "abdomen" is imported as "Crunch en máquina".

#### Sample file for tests

`tests/fixtures/gym-app-sample.json` is a synthetic gym_app full copy (no real data). On a new
device its preview shows: Ejercicios 2, Rutinas 1, Sesiones 3, Series 11, Notas de ejercicio 2,
Actividades 2, Pesos semanales 2, Semanas 2, Bloques opcionales 1, Registros de bloques 2,
Métricas semanales 1, and Ignorados 5. After importing ("Registros importados: 29"), the card
shows Ejercicios 45, Rutinas 6, Sesiones 3, Series 11, Notas de ejercicio 2, Actividades 2,
Pesos semanales 2, Semanas 2, Bloques opcionales 2, Registros de bloques 2, Métricas
semanales 1 and Pendientes de sincronizar 29.

#### CSV files

Made for Excel in Spanish, whatever the app language: UTF-8 with BOM (accents show
correctly), columns separated by `;`, decimal comma (`27,5`), one row per line (CRLF), and
values with `;`, quotes or line breaks are quoted. Headers follow the app language.

- **Sets** — columns (es):
  `fecha;sesion;ejercicio;tipo_serie;orden;peso_kg;reps;rir;straps;banda;e1rm_kg;cuenta_como_efectiva;nota_ejercicio;nota_sesion`
  (en:
  `date;session;exercise;set_type;order;weight_kg;reps;rir;straps;band;e1rm_kg;counts_as_effective;exercise_note;session_note`).
  One row per set, sessions by date; inside a session, exercises in session order and, per
  exercise, warm-ups, planned sets and extra sets (`orden` counts from 1 per exercise). Free
  sessions say "Sesión libre". `e1rm_kg` is empty for warm-ups and approach sets; `straps` and
  `cuenta_como_efectiva` are `sí`/`no` (en: `yes`/`no`); the exercise note is on every row of
  that exercise and the session note only on the first row of the session.
- **Activity and weight** — columns (es): `fecha;tipo;actividad;minutos;peso_kg;nota`
  (en: `date;type;activity;minutes;weight_kg;note`). Activities first (`tipo` = `actividad`),
  then one row per weekly body weight (`tipo` = `peso_medio_semana`, `fecha` = the Monday).

### Acceptance criteria

**AC-IMPORT-01 · Preview and confirm**
Given a new device
When I tap "Importar desde la app anterior" and choose `tests/fixtures/gym-app-sample.json`
Then a dialog "Importar desde la app anterior" shows the summary of the sample file above
And the card counts have not changed
When I tap "Importar"
Then the message "Registros importados: 29" appears and the card shows the counts after
importing listed above.

**AC-IMPORT-02 · Cancel changes nothing**
Given the preview dialog of the sample file
When I tap "Cancelar" (or press Escape)
Then the dialog closes and every count is unchanged.

**AC-IMPORT-03 · Wrong file**
Given I choose a file that is not a gym_app copy (a text file, or a Certavi backup) in
"Importar desde la app anterior"
Then the message "Este archivo no es una copia completa de la app anterior." appears, no
dialog opens and every count is unchanged. The same with a file that is not a Certavi backup
in "Importar copia de Certavi" ("Este archivo no es una copia de Certavi.").

**AC-IMPORT-04 · Importing twice**
Given I imported the sample file
When I import it again
Then the preview says "No hay nada nuevo que importar." with "Sin cambios (ya estaban) 29",
and after closing it the counts are the same as before.

**AC-IMPORT-05 · Reload after importing**
Given I imported the sample file
When I reload the page
Then the card shows the same counts.

**AC-EXPORT-01 · Full backup round trip**
Given I imported the sample file
When I tap "Exportar copia completa (.json)"
Then a file `certavi-backup-<today>.json` is downloaded
When I import that file with "Importar copia de Certavi" on a new device and confirm
Then the card shows the same counts as on the first device.

**AC-EXPORT-02 · CSV for Excel**
Given I imported the sample file
When I tap "Exportar series (.csv)"
Then `certavi-sets-<today>.csv` is downloaded; it starts with a UTF-8 BOM, its first line is
the Spanish header above, it has 11 data rows, and the 27.5 kg back-off sets show `27,5`.
When I tap "Exportar actividad y peso (.csv)"
Then `certavi-activity-weight-<today>.csv` has the header above, 2 activity rows and 2 weight
rows.

**AC-IMPORT-06 · English**
Given the language is English
Then the buttons, the preview and the messages use the English texts above.

### Edge cases

- Offline: import and export work the same (everything happens on the device).
- Importing never replaces a record edited later on this device: the newer version wins.
- Imported records count as "Pendientes de sincronizar" until sync exists (Phase 4).
- Cancelling the file picker does nothing.

### Out of scope (Part B)

Exporting one session or one week as JSON from a screen (the functions exist and are
unit-tested; the buttons arrive with the session and calendar screens in Phases 5 and 7); a
readable summary inside those files; the recovery CSV of gym_app (with the blocks screens,
Phase 7).
