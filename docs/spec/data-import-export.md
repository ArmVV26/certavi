# Data on the device, import and export

## 1. Purpose

Everything Certavi records is saved **on the device first**, so the app works without
coverage and never loses data, even if the page is reloaded or closed. Settings shows what is
stored on this device. In the second part of Phase 3, Settings also imports the data of the
previous app (gym_app), imports and exports Certavi backups, and exports spreadsheets (CSV)
for Excel.

The spec has two parts, delivered in two steps:

- **Part A — local data** (`feature/local-db`): the "Datos" card in Settings. Final.
- **Part B — import and export** (`feature/import-export`): draft, completed before that
  part is implemented.

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

## 3. Part B — import and export (draft)

> Draft: labels and messages are fixed when Part B is implemented. The behaviour below is
> what must hold.

All of this lives in the "Datos" card in Settings.

- **"Importar desde la app anterior"** — choose the full-copy JSON exported from gym_app
  ("Copia completa (.json)"). Certavi checks the file and shows a **preview** before saving
  anything: how many sessions, sets, notes, activities, body weights, weeks, routines,
  rehab logs, wall tests and exercise increments it will import, and how many records it
  ignores (deleted ones, internal settings). Confirm → it saves and shows a message; cancel →
  nothing changes. A file that is not a gym_app copy shows an error and changes nothing.
- **"Importar copia de Certavi"** — same flow with a file exported by Certavi.
- **"Exportar copia completa (.json)"** — downloads every record on this device. Importing it
  on an empty device gives the same counts.
- **"Exportar series (.csv)"** and **"Exportar actividad y peso (.csv)"** — spreadsheets that
  open correctly in Excel in Spanish (columns separated by `;`, decimal comma, accents shown
  correctly).
- Importing the same file twice does not duplicate anything. Importing never replaces a
  record edited later on this device.
- Imported records count as "Pendientes de sincronizar" until sync exists (Phase 4).
- Exporting one session or one week as JSON arrives with the session and calendar screens
  (Phases 5 and 7).

Draft acceptance criteria: AC-IMPORT-01 preview and confirm; AC-IMPORT-02 cancel changes
nothing; AC-IMPORT-03 invalid file; AC-IMPORT-04 importing twice; AC-IMPORT-05 reload after
importing keeps everything; AC-EXPORT-01 full copy round trip; AC-EXPORT-02 CSV format.
