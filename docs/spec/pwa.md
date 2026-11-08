# Installable app: manifest, offline start and "new version" prompt

## 1. Purpose

Certavi can be **installed as an app** (on the iPhone: Safari → Share → "Add to Home Screen"; on
Android and desktop Chrome: "Install app"). Once installed it opens full screen, without the
browser bars, with its own icon. After it has been opened once with a network, it **starts
without coverage**: any screen can be reloaded offline and shows the data saved on the device.
When a new version has been published, the app **tells the user** and lets them update when it
suits them, so a workout in progress is never interrupted.

## 2. Screens and elements

### 2.1 Manifest and icons

The site publishes a web app manifest at `/manifest.webmanifest`, linked from every page.

| Field              | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| `name`             | Certavi                                                   |
| `short_name`       | Certavi                                                   |
| `lang`             | `es`                                                      |
| `display`          | `standalone`                                              |
| `start_url`        | `/`                                                       |
| `scope`            | `/`                                                       |
| `orientation`      | `portrait`                                                |
| `theme_color`      | `#f4f5f7` (the light background of the app)               |
| `background_color` | `#f4f5f7`                                                 |
| `icons`            | PNG 192×192 and 512×512 (`any`), PNG 512×512 (`maskable`) |

The icon has a solid background (no transparency, iOS does not honour it), no text and stays
legible at 60 px. For iOS the page also links an `apple-touch-icon` (180×180) and declares the
web-app metas (`apple-mobile-web-app-capable`, `mobile-web-app-capable`,
`apple-mobile-web-app-title` = "Certavi", status bar style) so the home-screen app opens without
Safari's bars.

### 2.2 Standalone layout

In the installed app the five navigation tabs (Hoy, Calendario, Rutinas, Progreso, Ajustes /
Today, Calendar, Routines, Progress, Settings) are all reachable. The bottom tab bar stays above
the home indicator of the phone and the header stays below the notch / status bar; nothing is
cut off or hidden behind the system UI.

### 2.3 "New version" prompt

When a new version of the app is available, a **banner** appears right under the header, stays in view while
the page scrolls and **stays until the user answers**; it does not disappear on its own. It
never covers the bottom tab bar, the rest timer or the notifications.

| Element          | Spanish               | English                    |
| ---------------- | --------------------- | -------------------------- |
| Message          | Hay una versión nueva | A new version is available |
| Primary button   | Actualizar            | Update                     |
| Secondary button | Más tarde             | Later                      |

- **Actualizar / Update** reloads the app with the new version. Everything saved on the device
  and every change waiting to be sent is kept.
- **Más tarde / Later** closes the banner and changes nothing. The app keeps working with the
  version it has. The banner comes back the next time the app is opened or reloaded while the new
  version is still waiting.

The app checks for a new version when it starts, when the user comes back to it after leaving
it, and every hour while it stays open. The check needs a network; offline nothing happens.

### 2.4 What is and is not stored for offline use

Only the app itself (its code, styles, fonts and icons) is stored for offline use. **Data
requests to the server (`/api/v1/**`) are never answered from that store**: sync always talks to
the real server, and when there is no network it fails as it did before and retries later (see
[sync.md](sync.md)).

## 3. Acceptance criteria

```
AC-PWA-01 · Manifest published
Given the app is served
When I open /manifest.webmanifest
Then I get a valid manifest with name "Certavi", display "standalone", start_url "/",
  scope "/" and the 192, 512 and maskable 512 icons
And every icon URL in it answers with an image
```

```
AC-PWA-02 · Manifest linked
Given any page of the app
Then the page links /manifest.webmanifest and an apple-touch-icon
And it declares the iOS web-app metas
```

```
AC-PWA-03 · Starts offline
Given I opened the app once with a network
When I go offline and reload any route (for example /calendar and /settings)
Then the app loads, with the same data as before, and shows its normal header and tab bar
```

```
AC-PWA-04 · Pending changes survive an offline reload
Given a sync key is set and I made a change while offline (it is waiting to be sent)
When I reload the page, still offline
Then the change is still pending
When the network comes back
Then the change is sent and the indicator ends as "Sincronizado" / "Synced"
```

```
AC-PWA-05 · Sync is never served from the cache
Given the app is installed and was used online
When sync runs again
Then the request to /api/v1/sync reaches the server (it is never answered by the
  stored copy of the app)
And while offline the indicator shows "Sin conexión" / "Offline", not "Sincronizado"
```

```
AC-PWA-06 · New version prompt
Given a new version of the app has been published
When the app checks for updates
Then the banner "Hay una versión nueva" with "Actualizar" and "Más tarde" appears
And it stays on screen until I press one of the buttons
```

```
AC-PWA-07 · Update
Given the banner is shown
When I press "Actualizar"
Then the app reloads running the new version
And my data and my pending changes are still there
```

```
AC-PWA-08 · Later
Given the banner is shown
When I press "Más tarde"
Then the banner closes and the screen I was on does not change
And no data is lost
```

```
AC-PWA-09 · Banner texts in English
Given the language is English and the banner is shown
Then it reads "A new version is available" with "Update" and "Later"
```

```
AC-PWA-10 · Installed on the iPhone (manual)
Given Certavi added to the home screen from Safari
When I open it from the icon
Then it opens without Safari's address bar and buttons, with the Certavi icon
And I can reach the five tabs from the bottom bar
```

## 4. Edge cases

- **First visit without network:** the app cannot load (there is nothing stored yet); it must be
  opened once online.
- **Several tabs / windows open:** the banner may appear in each; updating one reloads only that
  one.
- **Update with a session in progress:** the banner never reloads by itself, so the user
  finishes the set they are logging first; the data of the session is on the device anyway.
- **Dark mode + English** together work as each one alone; the banner uses the app's colours
  and meets contrast AA.
- **Reduced motion:** the banner appears without animation.
- **Small screens:** at 390×844 the banner does not push the header out of view and its two buttons fit
  on the row (or stack) without horizontal scroll.
- **Storage blocked / service workers unavailable** (private mode in some browsers): the app
  works as an ordinary web page, online only.

## 5. Out of scope

- Push notifications, background sync and sharing to the app.
- Storing data requests or exercise images for offline use (data lives in the local database).
- Lighthouse scores and code splitting (Phase 8, second branch).

## 6. Testing notes

- E2E (Chromium only, service workers allowed in that spec): AC-PWA-01 to AC-PWA-05. The
  service worker of WebKit under Playwright is not reliable, and iOS is checked by hand
  (AC-PWA-10). All other specs run with service workers blocked.
- AC-PWA-06 to AC-PWA-09 are covered by component tests (the update check is mocked); a real
  new deploy is checked by hand.
