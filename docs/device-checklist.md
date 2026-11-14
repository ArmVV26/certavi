# Device checklist (iPhone)

Manual checks on the **real iPhone**, with the app installed from Safari ("Add to Home Screen").
Playwright's WebKit is not Safari on iOS: it only shows differences of the engine, never how the
phone behaves (storage, the lock screen, the home-screen app, the network switching off). This
list is what closes those questions.

Do it after every release that changes the app on the phone, at least before `v1.0.0`. It takes
about 30 minutes. Everything runs on **synthetic or your own gym data**; never paste your sync key
or exports anywhere.

## Before you start

1. Note the **app version** (Ajustes → Acerca de) and the **iOS version** (Ajustes de iOS → General → Información).
2. Settings → **Diagnóstico**: switch **Medir el rendimiento** on. Use "Borrar mediciones" first so
   the numbers are only from this run.
3. Have a sync key set (Ajustes → Sincronización) and a second device or browser ready for the
   sync checks (D-4).
4. **Close the app and open it once** so `Apertura de la base de datos` is measured (it is taken
   when the app starts).

Reference for the Diagnostics numbers: **under 300 ms is fine, over 1 s is a problem**
(docs/spec/diagnostics.md).

## Checks

Mark each one **OK**, **FAIL** (and write what happened) or **n/a**.

### D-1 · Installing and updating the app

| #     | Do                                                                                    | Expected                                                                                     |
| ----- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| D-1.1 | In Safari open the deployed site and choose Compartir → "Añadir a pantalla de inicio" | The icon is Certavi's; it opens full screen, with no Safari bars                             |
| D-1.2 | Open it from the home screen; Today shows; switch to airplane mode and reopen it      | It opens offline with the same data                                                          |
| D-1.3 | After a new version is deployed, open the app online                                  | The banner "Hay una versión nueva" appears; **Más tarde** closes it and changes nothing      |
| D-1.4 | Open it again and tap **Actualizar**                                                  | The app reloads with the new version (Ajustes → Acerca de); nothing saved or pending is lost |
| D-1.5 | Open the app with a session in progress when a new version is waiting                 | The banner never reloads the page by itself in the middle of the session                     |

### D-2 · Offline with a forced close

| #     | Do                                                                                        | Expected                                                                         |
| ----- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| D-2.1 | Airplane mode on. Start a session, tick two sets with weights and reps                    | The sets show as done at once; the header shows "Sin conexión" / pending changes |
| D-2.2 | Swipe the app away in the app switcher (**force close**) and open it again, still offline | The session is there with both sets; nothing lost                                |
| D-2.3 | Tick one more set, note the time it takes to show (Diagnóstico → "De ✓ a serie visible")  | The set shows at once; the measurement is under 300 ms                           |
| D-2.4 | Finish the session. Add a body weight and an activity on Today. Force close and reopen    | Session, weight and activity are all there                                       |

### D-3 · Drafts (what is typed but not saved)

| #     | Do                                                                                                          | Expected                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| D-3.1 | In a session type a weight and reps **without ticking ✓**; switch to another app for a minute and come back | The typed values are still there                                                |
| D-3.2 | Do the same and force close the app, then reopen it                                                         | The typed values are still there                                                |
| D-3.3 | Tick ✓ on that row, then finish the session                                                                 | The drafts of that session are gone (a new session starts with empty fields)    |
| D-3.4 | With the rest timer running and a weight field open, tap each tab of the bar                                | Every tab opens; the session screen can be left (backlog: report of 2026-11-11) |

### D-4 · Sync when the network comes back

| #     | Do                                                                   | Expected                                                                               |
| ----- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| D-4.1 | Ajustes → Sincronización: save the key (first time on this phone)    | The indicator goes "Sincronizando…" then "Sincronizado" (backlog: Phase 4)             |
| D-4.2 | Airplane mode on, make two changes (a set, a body weight)            | "Sin conexión" with the pending count                                                  |
| D-4.3 | Airplane mode off, wait a few seconds without touching anything      | It syncs by itself and ends "Sincronizado"; the attempt log shows a "Correcto" attempt |
| D-4.4 | Make a change and **lock the phone / go to the home screen at once** | The change is sent anyway (check on the second device)                                 |
| D-4.5 | On the second device, change the same record later; open the phone   | The newer change wins on both                                                          |

### D-5 · Sound with the screen locked

The rest timer sound can only start after a tap and iOS may stop web audio when the screen locks.

| #     | Do                                                                                                        | Expected (write what really happens)             |
| ----- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| D-5.1 | Ajustes → Descanso: **Sonido** on, ringer switch on, volume up. Set the compound rest to 15 s. Tick a set | The bar counts down and a sound plays at the end |
| D-5.2 | Tick a set and **lock the screen** with the timer running; wait for it to end                             | Note: sound / no sound / sound when unlocking    |
| D-5.3 | Tick a set and switch to another app; wait for it to end                                                  | Note: sound / no sound                           |
| D-5.4 | Same as D-5.1 with the ringer switch off                                                                  | Note what happens (iOS may silence web audio)    |
| D-5.5 | **Vibración** on (the app says it does not work on iPhone)                                                | No vibration, and nothing breaks                 |

### D-6 · Speed (Diagnóstico) and the weight of the data

With the switch on and the checks above done, open each screen a few times:

1. Open **Hoy** (cold start: force close, open the app) — `todayLoad`, `dbOpen`.
2. Open **Progreso** from the tab bar, five times — `progressLoad`.
3. Tick sets in a session, five times — `setVisible`.
4. Ajustes → Datos: note whether the card loads in about a second (in desktop WebKit the first
   read took over 7 s; backlog, Phase 5). Try an **Importar copia de Certavi** preview with a
   backup and note how long it takes.
5. Ajustes → Diagnóstico → **Copiar mediciones** and paste the text into the result table below.

| Measurement    | Fine     | Problem | If it is slow, note                           |
| -------------- | -------- | ------- | --------------------------------------------- |
| `dbOpen`       | < 300 ms | > 1 s   | first launch after install, or any launch     |
| `todayLoad`    | < 300 ms | > 1 s   | cold start or after switching tab             |
| `setVisible`   | < 300 ms | > 1 s   | the row where it was slow, with the rest bar? |
| `progressLoad` | < 300 ms | > 1 s   | how many sessions are on the phone            |

## Results

One row per run. `Measurements` holds the **median** of each measurement from "Copiar mediciones"
(`dbOpen / todayLoad / setVisible / progressLoad`, in ms). Add a line under the table for every
FAIL (what, when, how to repeat it) and move the real problems to `docs/backlog.md`.

| Date       | App version | iOS                                                                    | D-1     | D-2     | D-3     | D-4     | D-5     | Measurements (median ms) | Notes                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ----------- | ---------------------------------------------------------------------- | ------- | ------- | ------- | ------- | ------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-13 | 0.10.1      | iPhone, Safari 26.6.1 (the user agent freezes the iOS version at 18_7) | pending | pending | pending | pending | pending | 37 / 47 / 40 / 46        | Partial run over HTTP (`npm run preview -- --host`, no service worker, almost empty database). Only D-6 done: all four are "Good" (max 119 / 203 / 81 / 73 ms). 4, 17, 8 and 11 samples.                                                                                                                                                                  |
| 2026-11-13 | 0.10.1      | iPhone, Safari 26.6.1 (the user agent freezes the iOS version at 18_7) | OK      | OK      | OK      | OK      | FAIL    | 55 / 59 / 70 / 77.5      | Installed app, own data, HTTPS deploy of `dev`. D-5.1 to D-5.4: no sound on the iPhone (it does play on desktop). D-5.5: no vibration, as the app says. D-3.4: OK, but the rest counter disappears. Speed all "Good" except two `todayLoad` of 458 and 411 ms ("Fair"); max `dbOpen` 67, `setVisible` 87, `progressLoad` 118 ms. 10, 20, 9 and 8 samples. |

## After the run

- Close the two open questions of the backlog (§1 «Manual checks») that this list answers:
  IndexedDB speed on the phone and sound / offline flow. Remove them from `docs/backlog.md` and
  note the result in the table above.
- Switch **Medir el rendimiento** off if you do not need it: it only keeps numbers on the phone,
  but there is no reason to leave it on.
