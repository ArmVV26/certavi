# Empty and error states

## 1. Purpose

No screen is left blank or shows a technical error. When there is nothing to show, the screen
says so and offers the next step; when something fails, the message says what happened and what
to do, in Spanish and English. Data on the device is never lost because of a message.

## 2. Screens and elements

### 2.1 A screen cannot be shown

If a screen fails (its code could not be downloaded without network or just after a new version
was published, or reading the local data failed), **that screen** is replaced by a message; the
header and the tab bar stay usable.

| Element | Spanish                                                                                                           | English                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Title   | No se pudo mostrar esta pantalla                                                                                  | This screen could not be shown                                                                  |
| Text    | Puede que no tengas conexión o que haya una versión nueva de la app. Tus datos están a salvo en este dispositivo. | You may be offline, or there may be a new version of the app. Your data is safe on this device. |
| Button  | Reintentar (reloads the app)                                                                                      | Try again                                                                                       |
| Link    | Volver a Hoy                                                                                                      | Back to Today                                                                                   |

### 2.2 The local data cannot be opened

If the browser does not let Certavi open its local database (private mode, blocked storage,
another tab holding it), the whole app is replaced by a message with a **Reintentar / Try again**
button. Title: "No se pueden abrir los datos de este dispositivo" / "The data on this device
cannot be opened".

### 2.3 Lists with nothing in them

| Screen                     | Spanish                                                   | English                |
| -------------------------- | --------------------------------------------------------- | ---------------------- |
| Optional blocks, no blocks | Todavía no tienes bloques (+ "Nuevo bloque" button stays) | You have no blocks yet |

The other lists already have their own empty message (see each spec: calendar day, exercises,
progress sections, attempt log, server backups, session without exercises).

### 2.4 A write fails

Settings → Descanso: if a rest time cannot be saved, a notification says
"No se pudo guardar el descanso. Inténtalo de nuevo." / "The rest time could not be saved. Try
again." (the other screens already show their own "No se pudo guardar" message).

## 3. Acceptance criteria

```
AC-STATE-01 · Screen that fails
Given a screen whose content cannot be shown
Then I see "No se pudo mostrar esta pantalla" with "Reintentar" and "Volver a Hoy"
And the tab bar is still there and I can open another tab
```

```
AC-STATE-02 · Local data cannot be opened
Given the browser blocks the local database
When the app starts
Then I see "No se pueden abrir los datos de este dispositivo" and a "Reintentar" button
And no empty-looking screen
```

```
AC-STATE-03 · No optional blocks
Given there are no optional blocks
When I open Ajustes → Gestionar bloques
Then I see "Todavía no tienes bloques" and the "Nuevo bloque" button
```

```
AC-STATE-04 · Rest time not saved
Given a rest time that cannot be written to the device
When I change it and leave the field
Then a notification says "No se pudo guardar el descanso. Inténtalo de nuevo."
```

## 4. Edge cases

- English shows the same messages translated; dark mode uses the app's colours.
- AC-STATE-02 is also covered end to end (`tests/e2e/theme.spec.ts`, blocking IndexedDB); the
  other states are covered by component tests, because they need a failing browser.

## 5. Out of scope

- Reporting errors to a server (the app sends nothing but sync data).
