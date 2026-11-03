# Sync: key, status, attempt log and server backups

## 1. Purpose

Certavi saves everything on the device first. With a **sync key**, it also copies every change
to a small server and brings back the changes made on the user's other devices. Without
coverage nothing is lost: changes wait on the device and leave when the network comes back.
When two devices change the same record, the **most recent change wins** on both.

The server keeps **one backup a day** (Madrid time) and the **14 most recent ones**. From the
app they can be listed, downloaded and restored.

Data in this phase can only be created by importing (Settings → Datos → "Importar desde la app
anterior" / "Importar copia de Certavi", see [data-import-export.md](data-import-export.md)):
the screens to record workouts arrive in Phase 5.

## 2. Screens and elements

### 2.1 Header indicator

Every screen shows a **sync indicator** in the header, between the page title and the theme
button. It is a link to **Ajustes / Settings** with an icon and, when there are changes
waiting, their number as a badge. Its accessible name is
"Sincronización: <state>" / "Sync: <state>", followed by
" · <n> pendientes" / " · <n> pending" when there are changes waiting.

| State (es)          | State (en)      | When                                                      |
| ------------------- | --------------- | --------------------------------------------------------- |
| Sin configurar      | Not set up      | No sync key on this device                                |
| Sincronizando…      | Syncing…        | A sync is in progress                                     |
| Sin conexión        | Offline         | The device has no network                                 |
| Error               | Error           | The last attempt failed (the reason is shown in Settings) |
| Pendiente de enviar | Waiting to send | Changes are waiting and will be sent in a few seconds     |
| Sincronizado        | Synced          | The last attempt worked and nothing is waiting            |

When the state becomes "Sin conexión" or "Error", screen readers announce it once.

### 2.2 Settings → "Sincronización" / "Sync" card

The **first card** on Ajustes / Settings, before "Apariencia".

- Heading **"Sincronización" / "Sync"**.
- Text: "Copia tus datos en el servidor y en tus otros dispositivos. Sin conexión, los cambios
  esperan en el dispositivo." / "Copies your data to the server and to your other devices.
  Offline, changes wait on the device."
- A list of three rows:
  - **"Estado" / "Status"**: the state of §2.1.
  - **"Última sincronización" / "Last sync"**: date and time of the last attempt that worked,
    or "Nunca" / "Never".
  - **"Pendientes" / "Pending"**: changes waiting on this device.
- When the state is "Error", the reason below the list (table in §2.4).

**Without a key** the card shows a form:

- Password field **"Clave de sincronización" / "Sync key"** with the hint "La misma clave en
  todos tus dispositivos. Mínimo 32 caracteres." / "The same key on all your devices. At
  least 32 characters."
- Toggle button **"Mostrar clave" / "Show key"** (pressed: the key is visible as text; its
  name stays the same and its pressed state changes).
- Button **"Guardar clave" / "Save key"**. A key shorter than 32 characters (spaces at the
  ends do not count) is not saved and the field shows "La clave debe tener al menos 32
  caracteres." / "The key must have at least 32 characters."
- On save: toast "Clave guardada." / "Key saved." and the first sync starts right away.

**With a key** the card shows "Clave guardada en este dispositivo." / "Key saved on this
device." (the key itself is never shown again) and three buttons:

- **"Sincronizar ahora" / "Sync now"** — disabled while a sync is in progress. When it ends:
  toast "Sincronizado." / "Synced." or the reason of the error (§2.4).
- **"Cambiar clave" / "Change key"** — shows the form again, with a **"Cancelar" / "Cancel"**
  button that goes back without changing anything.
- **"Olvidar clave" / "Forget key"** — opens a confirmation dialog "¿Olvidar la clave?" /
  "Forget the key?" with the text "Este dispositivo dejará de sincronizar. Tus datos se quedan
  en él." / "This device will stop syncing. Your data stays on it." and the buttons
  "Cancelar" / "Cancel" (focused) and "Olvidar" / "Forget". Confirming: toast "Clave
  olvidada." / "Key forgotten." and the state becomes "Sin configurar".

Below, a link **"Registro y copias del servidor" / "Attempt log and server backups"** to
`/settings/sync`.

**Saving a key (new or changed)** sends everything this device has to the server again and
then receives everything the server has. The built-in catalog, routines and blocks are not
sent unless they were changed.

### 2.3 `/settings/sync` — attempt log and server backups

Page title (h1) **"Sincronización" / "Sync"**. A link **"Volver a Ajustes" / "Back to
Settings"** at the top. Two sections:

**"Registro de intentos" / "Attempt log"** (h2)

- Text: "Los últimos 40 intentos de este dispositivo." / "The last 40 attempts on this
  device."
- With no attempts: "Todavía no hay intentos." / "No attempts yet."
- A list, newest first, at most **40** items. Each item shows the date and time, the result
  ("Correcto" / "OK", or the reason of the error from §2.4) and
  "Enviados: <n> · Recibidos: <n> · <duration> s" / "Sent: <n> · Received: <n> ·
  <duration> s". "Recibidos" counts every record the server returned, including the ones this
  device had just sent.

**"Copias del servidor" / "Server backups"** (h2)

- Text: "El servidor guarda una copia al día (hora de Madrid), las 14 últimas." / "The server
  keeps one backup a day (Madrid time), the last 14."
- Without a key: "Guarda la clave de sincronización en Ajustes para ver las copias." / "Save
  the sync key in Settings to see the backups." and nothing else.
- With a key the list loads when the page opens: "Cargando copias…" / "Loading backups…",
  then one item per backup, newest first, or "Todavía no hay copias." / "No backups yet."
  If it fails, the reason (§2.4). A button **"Actualizar" / "Refresh"** loads it again.
- Each item: the date in long format ("2 de noviembre de 2026" / "2 November 2026"), the
  number of records ("1.532 registros" / "1,532 records"; "Registros: sin datos" / "Records:
  unknown" when the server does not know) and two buttons:
  - **"Descargar" / "Download"** (accessible name "Descargar la copia del <date>" /
    "Download the backup of <date>"): downloads `certavi-server-backup-<YYYY-MM-DD>.json`, a
    Certavi backup that "Importar copia de Certavi" accepts. It holds the live records of that
    day (no deleted ones).
  - **"Restaurar" / "Restore"** (accessible name "Restaurar la copia del <date>" / "Restore the
    backup of <date>"): opens a confirmation dialog "¿Restaurar la copia del <date>?" /
    "Restore the backup of <date>?" with the text "Tus datos volverán a como estaban ese día,
    también en tus otros dispositivos cuando sincronicen. Lo que hayas cambiado después se
    perderá. Si dudas, exporta antes una copia completa." / "Your data goes back to how it was
    that day, also on your other devices when they sync. Anything changed afterwards is lost.
    If in doubt, export a full backup first." and the buttons "Cancelar" / "Cancel" (focused)
    and "Restaurar" / "Restore".
- After restoring: toast "Copia restaurada. Registros cambiados: <n>" / "Backup restored.
  Records changed: <n>" and a sync starts. `<n>` counts every record that changed on this
  device: brought back, deleted, or reset to its built-in version. Records that did not exist that day are deleted;
  the built-in catalog, routines, blocks and settings go back to their original version if
  the backup does not have them. If restoring fails: "No se pudo restaurar la copia. No se ha
  cambiado nada." / "The backup could not be restored. Nothing was changed."

### 2.4 Error reasons

| Code                                                  | Spanish                                       | English                              |
| ----------------------------------------------------- | --------------------------------------------- | ------------------------------------ |
| wrong key                                             | Clave incorrecta. Revísala en Ajustes.        | Wrong key. Check it in Settings.     |
| server without key                                    | El servidor no tiene la clave configurada.    | The server has no key configured.    |
| no network / server unreachable                       | No se pudo conectar con el servidor.          | Could not reach the server.          |
| more than 15 s                                        | El servidor tardó demasiado en responder.     | The server took too long to answer.  |
| busy server (conflict)                                | El servidor estaba ocupado. Se reintentará.   | The server was busy. It will retry.  |
| server failure (500 and other 5xx)                    | Error del servidor. Se reintentará.           | Server error. It will retry.         |
| answer that is not the sync API                       | Respuesta inesperada del servidor.            | Unexpected answer from the server.   |
| backup not found                                      | No se ha encontrado la copia.                 | Backup not found.                    |
| request rejected as malformed, wrong date, too large… | Error interno de la app. Inténtalo más tarde. | Internal app error. Try again later. |

## 3. Behaviour

- **When it syncs** (with a key): when the app starts; a couple of seconds after a change;
  when the network comes back; when the app comes back to the foreground; every 45 s while
  changes are waiting; and with "Sincronizar ahora".
- **Retries:** after a failure that can be retried, it tries again after 4, 8, 15, 30 and 60
  seconds, then every 60 s. Coming back online or to the foreground retries at once.
- **Wrong key** or **server without key**: it stops retrying until the key is changed or
  "Sincronizar ahora" is pressed.
- **Offline**: no request is made; the state is "Sin conexión" and the pending count grows
  with every change. When the network returns, it syncs on its own.
- **Leaving the app** (another app, locking the phone, closing the tab): changes waiting are
  sent one last time in the background.
- **Nothing is lost**: a change leaves the pending list only once the server has stored it.
  If the request fails or is cut halfway, the change stays pending and is sent again.
- **Two devices**: the most recent change of each record wins on both devices once both have
  synced. Changes that arrive from the server and are not newer than this device's are
  ignored.

## 4. Acceptance criteria

```
AC-SYNC-01 · Not set up
Given a new device
Then the header indicator is "Sincronización: Sin configurar"
And Settings shows the "Sincronización" card first, with the key form
And no request is made to /api/v1/
```

```
AC-SYNC-02 · Short key
Given the key form
When I type a key of 31 characters and press "Guardar clave"
Then the field shows "La clave debe tener al menos 32 caracteres."
And the key is not saved
```

```
AC-SYNC-03 · Save the key and sync
Given a device with the gym_app sample imported (29 changes waiting)
When I save the right key
Then "Clave guardada." is shown
And within a few seconds the state is "Sincronizado", "Pendientes" is 0 and "Última
sincronización" shows today
And the server holds the 29 records
And the attempt log shows one "Correcto" attempt with "Enviados: 29"
```

```
AC-SYNC-04 · Wrong key
Given a key the server does not accept
When I save it
Then the state is "Error" and the reason "Clave incorrecta. Revísala en Ajustes."
And no new attempt is made on its own afterwards
And the changes stay pending
```

```
AC-SYNC-05 · Offline, then back online
Given a device with the key saved and synced
When the device goes offline and I import more data
Then the indicator is "Sin conexión" with the number of pending changes
And when the network comes back, it syncs on its own and "Pendientes" becomes 0
```

```
AC-SYNC-06 · Failed requests are retried and lose nothing
Given the server cuts the connection (or answers 500) for the next attempt
When I import data with the key saved
Then the state is "Error" with the reason, and the changes stay pending
And a later attempt sends them and "Pendientes" becomes 0
```

```
AC-SYNC-07 · Reload with changes waiting
Given changes waiting while offline
When I reload the page and the network comes back
Then the changes are still pending after the reload and are sent afterwards
```

```
AC-SYNC-08 · Second device
Given device A synced the gym_app sample
When device B (empty) saves the same key
Then device B's "Datos" card shows the same counts as device A
And device B has nothing pending
```

```
AC-SYNC-09 · Same record changed on two devices
Given devices A and B synced with each other
When A imports a version of a record and later B imports a newer version of the same record
And both sync (A after B)
Then both devices hold B's version (export a full backup to check)
```

```
AC-SYNC-10 · Forget the key
Given a saved key
When I press "Olvidar clave" and confirm
Then "Clave olvidada." is shown, the state is "Sin configurar" and the key form is back
And "Cancelar" in the dialog keeps the key
```

```
AC-SYNC-11 · Attempt log
Given more than 40 attempts
Then /settings/sync lists exactly 40, newest first
```

```
AC-SYNC-12 · Server backups: list and download
Given the server has backups for two days
When I open /settings/sync
Then both are listed newest first with their date and number of records
And "Descargar" downloads certavi-server-backup-<date>.json, which "Importar copia de Certavi"
accepts
```

```
AC-SYNC-13 · Restore a backup
Given the server has a backup with fewer records than the device
When I restore it and confirm
Then "Copia restaurada. Registros cambiados: <n>" is shown
And the "Datos" counts match the backup (built-in data counts as on a new device)
And after syncing, another device with the same key shows the same counts
```

```
AC-SYNC-14 · Accessibility and languages
Then the card, the indicator and /settings/sync have no axe violations in light and dark
And every text of this spec appears in English when the language is English
```

## 5. Edge cases

- Saving the same key again does nothing new (no full re-send).
- A key with spaces at the ends is saved without them.
- A request that never answers is cut after 15 s and retried.
- The echo of what this device just sent does not change anything on the screen.
- While a sync runs, new changes wait and are sent right after it.
- More than 300 changes waiting are sent in several requests in one attempt.
- Private mode or blocked site data: the key cannot be saved; the app keeps working without
  sync.

## 6. Testing aids (e2e only)

`tests/mocks/sync-server.ts` is a fake sync server for Playwright. It runs the **real server
code** with storage in memory and answers every request to `/api/v1/**` of the browser
contexts it is attached to (no extra process or port). One fake server attached to two
contexts plays the role of two devices sharing one server. See the file for its API: the key
it accepts, cutting or failing the next requests, slowing them down, reading what it stores
and adding backups.

## 7. Out of scope

- Several users or accounts (one key per installation).
- Changes made on another device appearing while a session screen is open with unsaved input
  (Phase 5: "aviso de cambios remotos").
- Restoring part of a backup.
