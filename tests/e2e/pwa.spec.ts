import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { createFakeSyncServer, E2E_SYNC_KEY, type FakeSyncServer } from '../mocks/sync-server';
import { expectTheme, gotoReady, h1, mainNav, NAV_EN, NAV_ES, setLanguage } from './helpers';

// Spec: docs/spec/pwa.md (Phase 8 — manifest, offline start, sync never served from the cache).
// AC-PWA-01 to AC-PWA-05. Chromium only (not tagged @all-engines): the service worker of WebKit
// under Playwright is not reliable (spec §6). AC-PWA-06..09 are component-tested, 10 is manual.

// playwright.config.ts blocks service workers for every spec; this one needs the real thing.
test.use({ serviceWorkers: 'allow' });

const GYM_SAMPLE = path.join(process.cwd(), 'tests', 'fixtures', 'gym-app-sample.json');
const SYNC_PATH = '/api/v1/sync';

/** One timeout for every wait on the app. */
const WAIT = 15_000;

const PNG_SIGNATURE = '89504e470d0a1a0a';

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

interface Manifest {
  name?: string;
  short_name?: string;
  lang?: string;
  display?: string;
  start_url?: string;
  scope?: string;
  orientation?: string;
  theme_color?: string;
  background_color?: string;
  icons?: ManifestIcon[];
}

/** Fetches a URL and checks it is a PNG of the given size (signature + IHDR). */
async function expectPng(
  request: APIRequestContext,
  url: string,
  size: number,
  label: string,
): Promise<void> {
  const response = await request.get(url);
  expect(response.status(), `${label}: HTTP status of ${url}`).toBe(200);
  expect(response.headers()['content-type'] ?? '', `${label}: content type`).toMatch(/^image\//);
  const body = await response.body();
  expect(body.subarray(0, 8).toString('hex'), `${label}: PNG signature`).toBe(PNG_SIGNATURE);
  expect(
    [body.readUInt32BE(16), body.readUInt32BE(20)],
    `${label}: width x height of ${url}`,
  ).toEqual([size, size]);
}

/**
 * Opens a route, waits until the service worker is active (which means the app is precached:
 * a worker is only activated once its install, the precache, succeeded) and reloads once so the
 * page is controlled by it. Nothing waits for time: every step is a web-first assertion.
 */
async function openInstalled(page: Page, route: string, title: string): Promise<void> {
  await gotoReady(page, route, title);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state ?? 'none';
        }),
      { timeout: WAIT, message: 'the service worker is activated' },
    )
    .toBe('activated');
  await page.reload();
  await expect(h1(page, title)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: WAIT,
      message: 'the page is controlled by the service worker',
    })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).length), {
      timeout: WAIT,
      message: 'the app is stored for offline use',
    })
    .toBeGreaterThan(0);
}

/** The header indicator (a link named "Sincronización: …" / "Sync: …"). */
function indicator(page: Page): Locator {
  return page.getByRole('link', { name: /^(Sincronización|Sync): / });
}

/** The value next to a term of a description list (Settings cards). */
function rowValue(page: Page, term: string): Locator {
  return page
    .getByRole('term')
    .filter({ hasText: new RegExp(`^${term}$`) })
    .locator('xpath=following-sibling::*[1]');
}

function button(scope: Page | Locator, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

function toast(page: Page, text: string): Locator {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first();
}

function syncCount(server: FakeSyncServer): number {
  return server.requestCount(SYNC_PATH);
}

async function saveKey(page: Page, key: string): Promise<void> {
  const field = page.getByLabel('Clave de sincronización', { exact: true });
  await field.fill(key);
  await expect(field).toHaveValue(key);
  await button(page, 'Guardar clave').click();
}

/** Imports a gym_app file from Settings and waits for "Registros importados: n". */
async function importGym(page: Page, file: string, n: number): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await button(page, 'Importar desde la app anterior').click();
  await (await chooser).setFiles(file);
  const dialog = page
    .getByRole('dialog', { name: 'Importar desde la app anterior', exact: true })
    .or(page.getByRole('alertdialog', { name: 'Importar desde la app anterior', exact: true }));
  await expect(dialog).toBeVisible();
  await button(dialog, 'Importar').click();
  await expect(toast(page, `Registros importados: ${String(n)}`)).toBeVisible();
  await expect(dialog).toBeHidden();
}

/** The gym_app sample plus one new activity (one more record to import). */
function oneActivityFile(testInfo: TestInfo, id: string, note: string): string {
  const sample = JSON.parse(readFileSync(GYM_SAMPLE, 'utf8')) as {
    records: Record<string, unknown>[];
  };
  sample.records.push({
    id,
    t: 'act',
    u: 1792800000000,
    date: '2026-10-27',
    kind: 'futbol',
    min: 45,
    note,
  });
  const file = testInfo.outputPath(`${id}.json`);
  writeFileSync(file, JSON.stringify(sample, null, 2));
  return file;
}

/**
 * Waits until the server has received a sync request after the first `after` ones, then until
 * the Settings card and the header indicator say "Sincronizado" with nothing pending.
 */
async function expectSynced(page: Page, server: FakeSyncServer, after: number): Promise<void> {
  await expect
    .poll(() => syncCount(server), { timeout: WAIT, message: 'a sync request reached the server' })
    .toBeGreaterThan(after);
  await expect(rowValue(page, 'Estado')).toHaveText('Sincronizado', { timeout: WAIT });
  await expect(rowValue(page, 'Pendientes')).toHaveText('0', { timeout: WAIT });
  await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sincronizado', {
    timeout: WAIT,
  });
}

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

test.describe('pwa', () => {
  test('AC-PWA-01 · the manifest is published with the spec fields and every icon answers with a PNG of its size', async ({
    request,
  }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('json');
    const manifest = (await response.json()) as Manifest;

    expect(manifest).toMatchObject({
      name: 'Certavi',
      short_name: 'Certavi',
      lang: 'es',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      orientation: 'portrait',
      theme_color: '#f4f5f7',
      background_color: '#f4f5f7',
    });

    const icons = manifest.icons ?? [];
    const purposes = (icon: ManifestIcon) => (icon.purpose ?? 'any').split(/\s+/);
    const any192 = icons.find((i) => i.sizes === '192x192' && purposes(i).includes('any'));
    const any512 = icons.find((i) => i.sizes === '512x512' && purposes(i).includes('any'));
    const maskable = icons.find((i) => i.sizes === '512x512' && purposes(i).includes('maskable'));
    expect(any192, 'a 192x192 icon with purpose any').toBeDefined();
    expect(any512, 'a 512x512 icon with purpose any').toBeDefined();
    expect(maskable, 'a 512x512 icon with purpose maskable').toBeDefined();

    // Every icon of the manifest (resolved against the manifest URL) answers with a PNG of the
    // size it declares.
    expect(icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of icons) {
      const size = Number.parseInt((icon.sizes ?? '').split('x')[0] ?? '', 10);
      expect(Number.isInteger(size), `icon ${icon.src} declares its size`).toBe(true);
      const url = new URL(icon.src, new URL('/manifest.webmanifest', response.url())).href;
      await expectPng(request, url, size, `icon ${icon.src}`);
    }
  });

  test('AC-PWA-02 · every page links the manifest and an apple-touch-icon and declares the iOS web-app metas', async ({
    page,
    request,
  }) => {
    for (const [route, title] of [
      ['/', 'Hoy'],
      ['/calendar', 'Calendario'],
      ['/settings', 'Ajustes'],
    ] as const) {
      await gotoReady(page, route, title);

      const manifestLink = page.locator('link[rel="manifest"]');
      await expect(manifestLink, `${route}: manifest link`).toHaveCount(1);
      const manifestHref = (await manifestLink.getAttribute('href')) ?? '';
      expect(new URL(manifestHref, page.url()).pathname, `${route}: manifest href`).toBe(
        '/manifest.webmanifest',
      );

      const touchIcon = page.locator('link[rel="apple-touch-icon"]');
      await expect(touchIcon, `${route}: apple-touch-icon link`).toHaveCount(1);
      const touchHref = (await touchIcon.getAttribute('href')) ?? '';
      await expectPng(request, new URL(touchHref, page.url()).href, 180, `${route}: touch icon`);

      await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
        'content',
        'yes',
      );
      await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
        'content',
        'yes',
      );
      await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
        'content',
        'Certavi',
      );
      await expect(
        page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
      ).toHaveAttribute('content', /^(default|black|black-translucent)$/);
    }
  });

  test('AC-PWA-03 · offline, any route loads from the stored app with its header, tab bar and the data of the device', async ({
    page,
    context,
  }) => {
    await openInstalled(page, '/settings', 'Ajustes');
    await importGym(page, GYM_SAMPLE, 29);
    await expect(rowValue(page, 'Sesiones')).toHaveText('3');
    await expect(rowValue(page, 'Series')).toHaveText('11');

    await context.setOffline(true);

    const routes = [
      ['/calendar', 'Calendario'],
      ['/settings', 'Ajustes'],
      ['/', 'Hoy'],
      ['/routines', 'Rutinas'],
      ['/progress', 'Progreso'],
    ] as const;
    for (const [route, title] of routes) {
      // Typing the address (a new navigation) and then reloading it, both without network.
      await page.goto(route);
      await expect(h1(page, title), `${route}: opened offline`).toBeVisible();
      await page.reload();
      await expect(h1(page, title), `${route}: reloaded offline`).toBeVisible();
      const nav = mainNav(page);
      for (const name of NAV_ES) {
        await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
      }
    }

    // The data saved on the device is there, unchanged.
    await page.goto('/settings');
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expect(rowValue(page, 'Sesiones')).toHaveText('3');
    await expect(rowValue(page, 'Series')).toHaveText('11');
    await expect(rowValue(page, 'Ejercicios')).toHaveText('45');
  });

  test('AC-PWA-03 · offline reload keeps the English language and the dark theme; an unknown route shows the app shell', async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openInstalled(page, '/', 'Hoy');
    await setLanguage(page, 'en');
    await expectTheme(page, 'dark');

    await context.setOffline(true);

    for (const [route, title] of [
      ['/progress', 'Progress'],
      ['/routines', 'Routines'],
      ['/no-such-page', 'Page not found'],
    ] as const) {
      await page.goto(route);
      await expect(h1(page, title), `${route}: opened offline`).toBeVisible();
      await page.reload();
      await expect(h1(page, title), `${route}: reloaded offline`).toBeVisible();
      await expectTheme(page, 'dark');
      const nav = mainNav(page, 'en');
      for (const name of NAV_EN) {
        await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
      }
    }
  });

  test('AC-PWA-04 · a change made offline survives an offline reload and is sent when the network comes back', async ({
    page,
    context,
  }, testInfo) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await page.clock.install();
    const note = 'E2E pwa offline change';

    await openInstalled(page, '/settings', 'Ajustes');
    await importGym(page, GYM_SAMPLE, 29);
    const beforeKey = syncCount(server);
    await saveKey(page, E2E_SYNC_KEY);
    await expect(toast(page, 'Clave guardada.')).toBeVisible();
    await expectSynced(page, server, beforeKey);

    // A change while offline: it waits on the device.
    await context.setOffline(true);
    await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sin conexión');
    const offlineCount = syncCount(server);
    await importGym(page, oneActivityFile(testInfo, 'act_e2e_pwa_0001', note), 1);
    await expect(indicator(page)).toHaveAccessibleName(
      'Sincronización: Sin conexión · 1 pendiente',
    );
    await expect(rowValue(page, 'Pendientes')).toHaveText('1');

    // Reload, still offline: the app starts from the stored copy and the change is still pending.
    await page.reload();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expect(indicator(page)).toHaveAccessibleName(
      /^Sincronización: Sin conexión · \d+ pendientes?$/,
    );
    await expect(rowValue(page, 'Estado')).toHaveText('Sin conexión');
    await expect(rowValue(page, 'Pendientes')).not.toHaveText('0');
    // Past the start sync, the wait after a change and the first retries: nothing is sent.
    await page.clock.runFor(10_000);
    expect(syncCount(server), 'no sync request while offline').toBe(offlineCount);
    await expect(rowValue(page, 'Pendientes')).not.toHaveText('0');
    expect(JSON.stringify(await server.records())).not.toContain(note);

    // The network comes back: everything is sent and the indicator ends "Sincronizado".
    await context.setOffline(false);
    await expectSynced(page, server, offlineCount);
    expect(JSON.stringify(await server.records())).toContain(note);
    expect((await server.records()).length).toBeGreaterThanOrEqual(30);
  });

  test('AC-PWA-05 · with the service worker active, sync requests reach the server and are never stored; offline shows "Sin conexión"', async ({
    page,
    context,
  }) => {
    const server = createFakeSyncServer();
    await server.attach(context);

    await openInstalled(page, '/settings', 'Ajustes');
    let before = syncCount(server);
    await saveKey(page, E2E_SYNC_KEY);
    await expectSynced(page, server, before);

    // Sync again: a new request reaches the (fake) server each time.
    before = syncCount(server);
    await button(page, 'Sincronizar ahora').click();
    await expect(toast(page, 'Sincronizado.')).toBeVisible({ timeout: WAIT });
    await expect
      .poll(() => syncCount(server), {
        timeout: WAIT,
        message: 'the second sync reached the server',
      })
      .toBeGreaterThan(before);

    // A request made by the page itself also goes to the server, twice in a row (the second one
    // is not answered with a copy of the first).
    for (let i = 1; i <= 2; i++) {
      before = syncCount(server);
      await page.evaluate(() => fetch('/api/v1/sync', { method: 'POST', body: '{}' }));
      await expect
        .poll(() => syncCount(server), { timeout: WAIT, message: `direct request ${String(i)}` })
        .toBeGreaterThan(before);
    }

    // Nothing under /api/ is in any of the stored copies of the app.
    const stored = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(request.url);
      }
      return urls;
    });
    expect(stored.length, 'the app is stored').toBeGreaterThan(0);
    expect(stored.filter((url) => url.includes('/api/'))).toEqual([]);

    // Offline: the indicator and the card say so, never "Sincronizado".
    await context.setOffline(true);
    await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sin conexión');
    await expect(rowValue(page, 'Estado')).toHaveText('Sin conexión');
    // A request to the sync URL is never answered by the stored app (that would be index.html,
    // status 200, HTML). Limit of the observation: Playwright's context.route answers requests
    // even in offline mode, so here the fake server may answer (401 JSON, no key sent) instead
    // of the request failing; either is fine, the stored copy is not. Each answer must be
    // counted by the fake server.
    const beforeOffline = syncCount(server);
    const outcomes = await page.evaluate(async () => {
      const outcome = async (p: Promise<Response>) => {
        try {
          const r = await p;
          return { failed: false, status: r.status, type: r.headers.get('content-type') ?? '' };
        } catch {
          return { failed: true, status: 0, type: '' };
        }
      };
      return [
        await outcome(fetch('/api/v1/sync', { method: 'POST', body: '{}' })),
        await outcome(fetch('/api/v1/sync')),
      ];
    });
    for (const o of outcomes) {
      expect(o.type, 'never the HTML of the stored app').not.toContain('text/html');
      expect(o.status, 'never a 200 from a stored copy').not.toBe(200);
    }
    expect(syncCount(server) - beforeOffline, 'answers all came from the server').toBe(
      outcomes.filter((o) => !o.failed).length,
    );
    const onlineCount = syncCount(server);

    // Reload offline: still "Sin conexión", never "Sincronizado".
    await page.reload();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sin conexión');
    await expect(rowValue(page, 'Estado')).toHaveText('Sin conexión');
    await expect(indicator(page)).not.toHaveAccessibleName(/Sincronizado/);
    expect(syncCount(server), 'no sync request reached the server while offline').toBe(onlineCount);
  });
});
