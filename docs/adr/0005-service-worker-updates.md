# ADR-0005 — Service worker, offline start and updates

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Armando Vaquero Vargas

## Context

Certavi is used in the gym, often without coverage (ADR-0002, ADR-0003): data is written to the
device first and synced later. Until Phase 8 the app had no manifest and no service worker, so
(a) it could not start without a network, because the page itself was not stored, and (b) on the
iPhone it opened as a Safari tab whose bars hid the fixed tab bar. Phase 8 makes it an
installable PWA. The decisions below fix what the service worker stores and how a new version
reaches the user, while keeping the backend replaceable (only the sync contract matters).

## Decision

1. **Tool.** `vite-plugin-pwa` (Workbox, `generateSW` strategy) generates `sw.js` and
   `manifest.webmanifest` at build time. Registration code is not injected
   (`injectRegister: null`): the app registers the worker itself through the adapter
   `src/app/pwa/useAppUpdate.ts`, which wraps `virtual:pwa-register/react` so the rest of the UI
   and its tests do not depend on the plugin.
2. **Precache only.** The worker stores the build output (`js`, `css`, `html`, `woff2`, `svg`,
   `png`, the manifest) and nothing else. There is **no runtime caching**: no `fetch` handler
   stores or answers any request that is not part of the build.
3. **Nothing from `/api/**`.** Navigation fallback is `index.html` (single-page app) with
   `navigateFallbackDenylist: [/^\/api\//]`, and there is no runtime route for the API. Sync
   requests always reach the network and fail like before when offline; the sync engine
   (ADR-0004) already queues and retries. Serving sync from a cache could show stale data as if
   it were current, or hide a failed push.
4. **Updates are prompted** (`registerType: 'prompt'`). A new worker installs in the background
   and waits. The user is shown a **persistent** banner («Actualizar» / «Más tarde») in
   `Layout`; `Actualizar` activates the waiting worker and reloads. A toast was rejected: it
   disappears after a few seconds and in the gym nobody would see it. `autoUpdate` was
   rejected: reloading by itself in the middle of a set is worse than running an old version
   for a while. «Más tarde» only hides the banner for the current page load.
5. **Version checks.** The browser re-checks `sw.js` on navigation by itself, but an installed
   app can stay open for days, so the adapter also calls `registration.update()` when the app
   becomes visible again and every hour. Both are skipped while offline.
6. **Cache headers.** Netlify serves `/sw.js` and `/manifest.webmanifest` with
   `Cache-Control: no-cache` (always revalidated, like `index.html`); hashed files under
   `/assets/` stay immutable. The existing CSP already allows `worker-src 'self'` and
   `manifest-src 'self'`.
7. **Tests.** Playwright blocks service workers by default (`serviceWorkers: 'block'`), so no
   existing spec depends on the cache; only `tests/e2e/pwa.spec.ts` allows them, in Chromium
   (the service worker of WebKit under Playwright is not reliable; iOS is checked by hand).
   The banner is tested at component level with the adapter mocked.

## Consequences

- The first visit needs a network; from then on the app starts offline on every route.
- Adding a file type to the build that should work offline means extending `globPatterns`.
- A user who always presses «Más tarde» keeps an old version until they reload; acceptable for a
  personal app, and the data model is backwards compatible by design (ADR-0003).
- Data in IndexedDB is never touched by the worker, so updating cannot lose data.
- Changing the backend does not affect the worker: it never handles API traffic.

## Alternatives considered

- **Hand-written service worker:** more control, but it reimplements precache versioning and
  cleanup that Workbox gets right; the app has no need for custom routing.
- **`NetworkFirst` for the API:** rejected, see decision 3.
- **`autoUpdate` / `skipWaiting` on install:** rejected, see decision 4.
