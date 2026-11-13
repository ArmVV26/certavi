# Diagnostics

## 1. Purpose

Certavi is used on an iPhone in the gym, often without coverage, and nobody had measured how fast
it really is on that phone. **Settings → Diagnóstico / Diagnostics** lets the user switch on a
few timers, use the app as usual and then copy the last measurements to see if anything is slow.

Diagnostics is a **device-only** setting, like the theme: it is never synced, never sent anywhere
and does not change what is saved or shown in the rest of the app. Timers are off by default.

## 2. Screens and elements

### 2.1 The card

A card in **Ajustes / Settings**, between "Datos" and the "Desarrollo" / "Acerca de" cards. It is
always visible; the measurements are only taken while the switch is on.

| Element            | Spanish                                                                                               | English                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Heading            | Diagnóstico                                                                                           | Diagnostics                                                                         |
| Switch             | Medir el rendimiento                                                                                  | Measure performance                                                                 |
| Switch description | Guarda en este dispositivo el tiempo de cuatro acciones. No se sincroniza ni se envía a ningún sitio. | Saves on this device how long four actions take. It is not synced or sent anywhere. |
| Empty text         | Todavía no hay mediciones. Activa el interruptor y usa la app con normalidad.                         | There are no measurements yet. Switch it on and use the app as usual.               |
| Reference          | Referencia: menos de 300 ms va bien; más de 1 s es un problema.                                       | Reference: under 300 ms is fine; over 1 s is a problem.                             |
| Copy button        | Copiar mediciones                                                                                     | Copy measurements                                                                   |
| Clear button       | Borrar mediciones                                                                                     | Clear measurements                                                                  |
| Copied             | Mediciones copiadas                                                                                   | Measurements copied                                                                 |
| Copy failed        | No se pudo copiar. Selecciona el texto de abajo y cópialo a mano.                                     | Could not copy. Select the text below and copy it by hand.                          |

The switch keeps its state after closing the app. Turning it off stops new measurements but
**keeps** the ones already taken (so they can still be copied); "Borrar mediciones" removes them.

### 2.2 What is measured

Four measurements, each in milliseconds (`performance.now()`), the last **20** of each kept on
this device (the oldest is dropped when there are more).

| Id             | Spanish                      | English              | Starts…                                                 | …ends                                                              |
| -------------- | ---------------------------- | -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| `dbOpen`       | Apertura de la base de datos | Opening the database | when the app starts opening its local database          | when it is open (before the seed and sync)                         |
| `todayLoad`    | Carga de Hoy                 | Loading Today        | when the Today screen starts to show                    | when its content is on screen (once per time the screen is opened) |
| `setVisible`   | De ✓ a serie visible         | From ✓ to set shown  | when "Marcar serie como hecha" is tapped on a valid row | when the saved set is on screen                                    |
| `progressLoad` | Carga de Progreso            | Loading Progress     | when the Progress screen starts to show                 | when its content (or its empty message) is on screen               |

Notes:

- `dbOpen` happens when the app starts, so switching the switch on takes effect from the **next
  time the app is opened**; the other three start at once.
- A tap on ✓ that does not save (empty weight or reps, a write that fails) records nothing.
- The first time the app opens (empty database) `todayLoad` also includes writing the seed.

### 2.3 The measurements list

When there is at least one measurement, each of the four measurements that has data shows, in the
order of the table above:

- its name,
- a tag with the rating of its **median**: **Bien / Good** (under 300 ms), **Aceptable / Fair**
  (300 ms to 1 s) or **Problema / Problem** (over 1 s). The rating is always written, never only
  a colour,
- the text "Última: 120 ms · Mediana: 140 ms · Máx.: 310 ms · 12 mediciones" /
  "Last: 120 ms · Median: 140 ms · Max: 310 ms · 12 measurements" (numbers use the decimal
  comma in Spanish; one measurement reads "1 medición" / "1 measurement").

A measurement with no data is not listed.

### 2.4 Copy

"Copiar mediciones" puts on the clipboard a JSON text with the app version, the date and the
measurements, and shows the notification "Mediciones copiadas". It is disabled while there is
nothing to copy.

```json
{
  "app": "Certavi",
  "version": "0.10.1",
  "copiedAt": "2026-11-13T10:15:00.000Z",
  "userAgent": "Mozilla/5.0 …",
  "measurements": {
    "dbOpen": [{ "ms": 41.2, "at": "2026-11-13T10:00:01.000Z" }],
    "todayLoad": [],
    "setVisible": [],
    "progressLoad": []
  }
}
```

Every measurement appears (an empty list when it has none), oldest first. If the browser does not
let Certavi write to the clipboard, the same text is shown in a read-only box under the buttons
together with the "No se pudo copiar…" message, so it can be selected by hand.

## 3. Acceptance criteria

```
AC-DIAG-01 · The card is there and off by default
Given a new device
When I open Ajustes
Then I see the card "Diagnóstico" with the switch "Medir el rendimiento" off
And the text "Todavía no hay mediciones…"
And "Copiar mediciones" and "Borrar mediciones" are disabled
```

```
AC-DIAG-02 · Nothing is measured while it is off
Given the switch is off
When I open Today, a session and Progress and tick a set
Then Ajustes still shows "Todavía no hay mediciones…"
```

```
AC-DIAG-03 · The switch is remembered
Given I switch "Medir el rendimiento" on
When I reload the app and open Ajustes
Then the switch is on
And it is not part of what is synced or exported
```

```
AC-DIAG-04 · Today, Progress and a set are measured
Given the switch is on and a session of today is in progress
When I open Today, then Progress, then the session, and tick a set with valid values
And I open Ajustes
Then the list shows "Carga de Hoy", "Carga de Progreso" and "De ✓ a serie visible",
  each with a rating tag and "1 medición"
```

```
AC-DIAG-05 · Only the last 20 are kept
Given the switch is on
When I open Progress 25 times
Then "Carga de Progreso" says "20 mediciones"
And the copied text holds 20 entries for it
```

```
AC-DIAG-06 · Copy
Given there are measurements
When I tap "Copiar mediciones"
Then the notification "Mediciones copiadas" appears
And the clipboard holds the JSON of 2.4 with the current app version
```

```
AC-DIAG-07 · Clear
Given there are measurements
When I tap "Borrar mediciones"
Then the list disappears and "Todavía no hay mediciones…" is back
And the switch keeps its state
```

```
AC-DIAG-08 · Turning it off keeps what was measured
Given there are measurements and the switch is on
When I switch it off and use the app
Then the list is unchanged
And "Copiar mediciones" still works
```

```
AC-DIAG-09 · Ratings
Given a measurement whose median is 250 ms, 300 ms, 1000 ms or 1001 ms
Then its tag reads "Bien", "Aceptable", "Aceptable" and "Problema" respectively
```

## 4. Edge cases

- **Storage blocked** (private mode): the switch cannot be remembered and nothing is measured
  (the measurements live in that same storage); the app never fails because of it.
- **Offline**: nothing here needs a network.
- **English** and **dark / no-colour mode**: same texts translated, readable in every theme; the
  rating is never conveyed by colour alone.
- **Small screens (390 px)**: the buttons and the list fit without horizontal scrolling.
- A corrupt saved list (edited by hand) is ignored and starts empty.
- The timers must not change what the app does or noticeably slow it: with the switch off they
  only read one setting.

## 5. Out of scope

- Sending measurements anywhere (no analytics, no sync).
- Charts or history beyond the last 20 of each measurement.
- Measuring sync, writes other than ticking a set, or the other screens.
- Safari's own tools: the numbers come from the app, in the real phone.
