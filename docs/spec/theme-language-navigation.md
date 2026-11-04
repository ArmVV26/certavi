# Theme, language and navigation

Phase 1 · `v0.2.0`

## Purpose

The app shell every later screen lives in: a header with the page title and a theme button, a
main navigation with five sections, a light / dark / automatic theme that follows the phone, and
the whole interface in Spanish (default) or English. It also covers the base components shown on
the internal catalog page `/dev/ui` (dialogs, bottom sheet, notifications, number fields…).

Calendar, Routines and Progress are empty for now: each shows a short text and a "Próximamente" /
"Coming soon" label. Today has its real content since Phase 5 ([today.md](today.md)).

## Screens and elements

### Header (every page)

- The **page title** as the main heading (level 1).
- A **theme button** on the right. Its accessible name says the current theme and the next one:

| Current theme | Spanish name                      | English name                     |
| ------------- | --------------------------------- | -------------------------------- |
| automatic     | Tema automático. Cambiar a claro  | Automatic theme. Switch to light |
| light         | Tema claro. Cambiar a oscuro      | Light theme. Switch to dark      |
| dark          | Tema oscuro. Cambiar a automático | Dark theme. Switch to automatic  |

- A **skip link** "Saltar al contenido" / "Skip to content", visible only when focused with the
  keyboard, that jumps to the main content.

### Main navigation

A navigation landmark named "Principal" / "Main" with five links, in this order:

| Path        | Spanish    | English  |
| ----------- | ---------- | -------- |
| `/`         | Hoy        | Today    |
| `/calendar` | Calendario | Calendar |
| `/routines` | Rutinas    | Routines |
| `/progress` | Progreso   | Progress |
| `/settings` | Ajustes    | Settings |

- On a phone (narrower than 768 px) it is a **bar fixed at the bottom** of the screen.
- On wider screens it sits **at the top**, in the header.
- The link of the current section is marked as the current page (`aria-current="page"`) and
  highlighted.

### Pages

| Path        | Title (es / en)                       | Content                                                                                                                                               |
| ----------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`         | Hoy / Today                           | Today's date (e.g. "lunes, 2 de noviembre" / "Monday 2 November"), heading "La sesión de hoy" / "Today's session" (Phase 5: see [today.md](today.md)) |
| `/calendar` | Calendario / Calendar                 | Heading "Tu calendario" / "Your calendar", "Próximamente"                                                                                             |
| `/routines` | Rutinas / Routines                    | Heading "Tus rutinas" / "Your routines", "Próximamente"                                                                                               |
| `/progress` | Progreso / Progress                   | Heading "Tu progreso" / "Your progress", "Próximamente"                                                                                               |
| `/settings` | Ajustes / Settings                    | See below                                                                                                                                             |
| `/dev/ui`   | Componentes / Components              | Component catalog (see below). **Not** in the navigation bar                                                                                          |
| any other   | Página no encontrada / Page not found | Text and a link "Volver a Hoy" / "Back to Today"                                                                                                      |

The browser tab title is "<page title> · Certavi", e.g. "Hoy · Certavi".

### Settings

Card **"Apariencia" / "Appearance"** with two groups of options (radio buttons):

- **"Tema" / "Theme":** "Automático" / "Automatic", "Claro" / "Light", "Oscuro" / "Dark".
- **"Idioma" / "Language":** "Español", "English" (each in its own language).

Card **"Desarrollo" / "Developer"** with a link **"Catálogo de componentes" / "Component
catalog"** to `/dev/ui`.

### Component catalog (`/dev/ui`)

Sections, each with a level-2 heading (Spanish / English):

| Section                                 | What you can do                                                                                                                                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Botones / Buttons                       | Buttons "Empezar sesión", "Otra rutina", "Cancelar", "Quitar serie", and a disabled "Desactivado"                                                                                                                                                                            |
| Botones de icono / Icon buttons         | Icon-only buttons named "Añadir serie", "Quitar", "Quitar serie", and a disabled "Cerrar"                                                                                                                                                                                    |
| Chips y etiquetas / Chips and tags      | Toggle chips "Straps" (on at start), "Banda", "Creados por mí"; tags including the warm-up symbol **C** (es) / **W** (en), whose tooltip is "Calentamiento" / "Warm-up"                                                                                                      |
| Tarjeta / Card                          | A sample exercise card                                                                                                                                                                                                                                                       |
| Campos numéricos / Number fields        | Field **"Peso (kg)"** / "Weight (kg)" with buttons "Disminuir Peso" / "Aumentar Peso" (step 2,5 kg, minimum 0, maximum 500, suggested value 27,5 shown in grey), and field "Repeticiones" / "Reps". Under each field: "Valor: …" / "Value: …" ("vacío" / "empty" when empty) |
| Selector segmentado / Segmented control | Group "Periodo" / "Period": "Esta semana", "Pasada", "Media 4 sem."                                                                                                                                                                                                          |
| Interruptor / Switch                    | Switches "Sonido al acabar el descanso" (on) and "Vibración" (off, with a description)                                                                                                                                                                                       |
| Diálogo / Dialog                        | Button "Quitar serie…" / "Remove set…" opens a confirmation                                                                                                                                                                                                                  |
| Hoja inferior / Bottom sheet            | Button "Añadir ejercicio" / "Add exercise" opens a panel from the bottom                                                                                                                                                                                                     |
| Avisos / Notifications                  | Button "Mostrar aviso" / "Show notification" shows "Guardado en el móvil" / "Saved on this phone"                                                                                                                                                                            |
| Estado vacío / Empty state              | Sample empty state                                                                                                                                                                                                                                                           |
| Fechas y números / Dates and numbers    | "Hoy: <today's date>" and "Número: 1234,5" (es) / "Number: 1,234.5" (en)                                                                                                                                                                                                     |

## Acceptance criteria

### Navigation

**AC-NAV-01 · Opens on Today**
Given the app is opened at `/` on a 390×844 screen
Then the main heading is "Hoy" and the tab title is "Hoy · Certavi"
And the navigation "Principal" shows Hoy, Calendario, Rutinas, Progreso, Ajustes, in that order
And "Hoy" is marked as the current page.

**AC-NAV-02 · Navigate with the bar**
Given I am on Today
When I tap "Calendario" in the navigation
Then the URL is `/calendar`, the heading is "Calendario" and "Calendario" is the current page
And keyboard focus is on the new page heading.

**AC-NAV-03 · Every section has its title**
For each path in the pages table, opening it directly shows its title as the main heading and in
the tab title.

**AC-NAV-04 · Reload keeps the page**
Given I am on `/progress`
When I reload
Then I am still on Progress.

**AC-NAV-05 · Unknown address**
Given I open `/no-such-page`
Then the heading is "Página no encontrada"
When I tap "Volver a Hoy"
Then I am on Today.

**AC-NAV-06 · Back button**
Given I went Today → Rutinas → Ajustes
When I press the browser's back button
Then I am on Rutinas.

**AC-NAV-07 · Layout on a phone**
Given a 390×844 screen
Then the navigation bar is at the bottom of the viewport and stays there when the page scrolls
And the page has no horizontal scroll.

**AC-NAV-08 · Layout on a wide screen**
Given a screen 1024 px wide
Then the navigation is at the top, in the header, not at the bottom.

**AC-NAV-09 · Skip link**
Given I am on any page
When I press Tab once
Then "Saltar al contenido" is focused and visible
When I press Enter
Then focus moves to the main content.

**AC-NAV-10 · Component catalog**
Given I am on Ajustes
When I tap "Catálogo de componentes"
Then I am on `/dev/ui` with the heading "Componentes"
And the navigation bar has no link to it.

### Theme

**AC-THEME-01 · Follows the phone on first use**
Given a fresh install and the phone in dark mode
When I open the app
Then it is shown in the dark theme, and the theme button reads "Tema automático. Cambiar a claro".
(Same with light mode → light theme.)

**AC-THEME-02 · Follows a live change**
Given the theme is automatic and the app is open
When the phone switches between light and dark
Then the app switches too, without reloading.

**AC-THEME-03 · Header button cycles**
Given the theme is automatic
When I tap the theme button three times
Then the theme goes light → dark → automatic, and the button name changes as in the header table.

**AC-THEME-04 · Remembered**
Given I chose dark
When I reload the app (or close and open it)
Then it is still dark, even if the phone is in light mode.

**AC-THEME-05 · A forced theme ignores the phone**
Given I chose light
When the phone switches to dark
Then the app stays light.

**AC-THEME-06 · Settings and button agree**
Given I am on Ajustes
When I choose "Oscuro"
Then the app is dark and the header button reads "Tema oscuro. Cambiar a automático"
When I then tap the header button
Then "Automático" is selected in Ajustes.

**AC-THEME-07 · Browser colour**
The page's `theme-color` matches the background: `#f4f5f7` in light, `#0b0f14` in dark.

**AC-THEME-08 · Readable in both themes**
Every page passes an automatic accessibility check (axe) with no serious or critical issues,
including colour contrast, in light and in dark.

### Language

**AC-LANG-01 · Spanish by default**
Given a fresh install (whatever the phone's language)
Then the interface is in Spanish and the page language is `es`.

**AC-LANG-02 · Switch to English**
Given I am on Ajustes
When I choose "English"
Then the heading is "Settings", the navigation is "Main" with Today, Calendar, Routines,
Progress, Settings, the tab title is "Settings · Certavi", and the page language is `en`
And no Spanish text remains on screen (except "Español" in the language choice).

**AC-LANG-03 · Remembered**
Given I chose English
When I reload
Then the app is still in English.

**AC-LANG-04 · Dates and numbers follow the language**
Given Spanish, then English
Then Today shows the date as "lunes, 2 de noviembre" / "Monday 2 November" (today's date)
And `/dev/ui` shows "Número: 1234,5" / "Number: 1,234.5".

**AC-LANG-05 · Warm-up symbol**
In `/dev/ui` the warm-up tag shows **C** in Spanish and **W** in English.

### Dialogs, sheet and notifications (`/dev/ui`)

**AC-DIALOG-01 · Confirmation dialog**
When I tap "Quitar serie…"
Then an alert dialog named "¿Quitar esta serie?" opens with the text "La serie 2 de Remo en T se
quitará de esta sesión."
And focus is on "Cancelar".

**AC-DIALOG-02 · Focus stays inside**
Given the dialog is open
When I press Tab repeatedly (and Shift+Tab)
Then focus only moves between "Cancelar" and "Quitar"
And nothing behind the dialog can be clicked.

**AC-DIALOG-03 · Escape cancels**
Given the dialog is open
When I press Escape
Then it closes, nothing is removed, and focus returns to "Quitar serie…".

**AC-DIALOG-04 · Confirm and undo**
Given the dialog is open
When I tap "Quitar"
Then the dialog closes and a notification "Serie quitada" with a "Deshacer" button appears
When I tap "Deshacer"
Then a notification "Serie recuperada" appears.

**AC-DIALOG-05 · Notifications go away**
A notification without a button disappears after about 4 seconds; with a button ("Deshacer"),
after about 6 seconds. Each one also has a "Cerrar" button. They appear above the navigation bar.

**AC-SHEET-01 · Bottom sheet**
When I tap "Añadir ejercicio"
Then a panel named "Añadir ejercicio" slides up from the bottom
And it closes with "Cerrar", with Escape, or by tapping outside it; focus returns to the button.

### Number fields (`/dev/ui`)

**AC-NUM-01 · Decimal comma or point**
Typing "27,5" or "27.5" in "Peso (kg)" shows "Valor: 27,5". After leaving the field it shows
"27,5" (Spanish) / "27.5" (English).

**AC-NUM-02 · Zero is a value**
Typing "0" shows "Valor: 0" (not "vacío").

**AC-NUM-03 · Only numbers**
Letters and a second decimal separator are ignored while typing.

**AC-NUM-04 · Buttons and limits**
With the field empty, "Aumentar Peso" sets 30 (from the suggested 27,5). With 0, "Disminuir Peso"
is disabled. Typing 600 and leaving the field sets 500.

**AC-NUM-05 · Phone keyboard**
The field asks for the decimal keyboard (`inputmode="decimal"`).

## Edge cases

- **Offline:** not in scope yet (the service worker arrives in Phase 8); the shell itself makes no
  network requests after loading.
- **Storage blocked** (private mode, cleared site data): the app still works with the defaults
  (automatic theme, Spanish); the choice is simply not remembered.
- **Reduced motion:** with "reduce motion" on, dialogs, sheets and notifications appear without
  animation.
- **Small screens:** at 390×844 the five navigation labels fit without overlapping and nothing
  scrolls horizontally, in both languages.
- **Dark mode + English** together work as each one alone.

## Out of scope

- Real content of Today, Calendar, Routines and Progress (Phases 5–7).
- Sync status in the header (Phase 4).
- Installing as an app, offline mode and the "new version" prompt (Phase 8).
