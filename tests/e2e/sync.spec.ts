import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
  type TestInfo,
} from '@playwright/test';
import {
  createFakeSyncServer,
  E2E_SYNC_KEY,
  E2E_WRONG_KEY,
  type FakeSyncServer,
} from '../mocks/sync-server';
import { allUiText, boxOf, expectTheme, gotoReady, h1, setLanguage, themeButton } from './helpers';

// Spec: docs/spec/sync.md (Phase 4 — sync key, header indicator, attempt log, server backups).

const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures');
const SAMPLE = path.join(FIXTURES, 'certavi-backup-sample.json');

type Lang = 'es' | 'en';
type Rows = [string, string][];
type BackupRecord = Record<string, unknown>;

const ES = {
  card: 'Sincronización',
  cardText:
    'Copia tus datos en el servidor y en tus otros dispositivos. Sin conexión, los cambios esperan en el dispositivo.',
  keyLabel: 'Clave de sincronización',
  keyHint: 'La misma clave en todos tus dispositivos. Mínimo 32 caracteres.',
  showKey: 'Mostrar clave',
  saveKey: 'Guardar clave',
  shortKey: 'La clave debe tener al menos 32 caracteres.',
  keySaved: 'Clave guardada.',
  keyStored: 'Clave guardada en este dispositivo.',
  syncNow: 'Sincronizar ahora',
  changeKey: 'Cambiar clave',
  forgetKey: 'Olvidar clave',
  cancel: 'Cancelar',
  forgetTitle: '¿Olvidar la clave?',
  forgetText: 'Este dispositivo dejará de sincronizar. Tus datos se quedan en él.',
  forget: 'Olvidar',
  keyForgotten: 'Clave olvidada.',
  synced: 'Sincronizado.',
  logLink: 'Registro y copias del servidor',
  status: 'Estado',
  lastSync: 'Última sincronización',
  pending: 'Pendientes',
  never: 'Nunca',
  wrongKey: 'Clave incorrecta. Revísala en Ajustes.',
  unreachable: 'No se pudo conectar con el servidor.',
  serverError: 'Error del servidor. Se reintentará.',
  importCertavi: 'Importar copia de Certavi',
  exportJson: 'Exportar copia completa (.json)',
  confirmImport: 'Importar',
  back: 'Volver a Ajustes',
  log: 'Registro de intentos',
  logText: 'Los últimos 40 intentos de este dispositivo.',
  noAttempts: 'Todavía no hay intentos.',
  backups: 'Copias del servidor',
  backupsText: 'El servidor guarda una copia al día (hora de Madrid), las 14 últimas.',
  backupsNoKey: 'Guarda la clave de sincronización en Ajustes para ver las copias.',
  restoreText:
    'Tus datos volverán a como estaban ese día, también en tus otros dispositivos cuando sincronicen. Lo que hayas cambiado después se perderá. Si dudas, exporta antes una copia completa.',
  restore: 'Restaurar',
  ok: 'Correcto',
} as const;

const STATE_ES = {
  notSetUp: 'Sin configurar',
  syncing: 'Sincronizando…',
  offline: 'Sin conexión',
  error: 'Error',
  synced: 'Sincronizado',
} as const;

/** One timeout for every wait on the app: WebKit's local storage is seconds slower. */
const WAIT = 15_000;

/** The sync endpoint of the fake server (backups use other paths). */
const SYNC_PATH = '/api/v1/sync';

/** Datos card rows: [es, new device, after importing the sample file]. */
const DATA_ROWS: readonly (readonly [string, string, string])[] = [
  ['Ejercicios', '45', '45'],
  ['Rutinas', '6', '6'],
  ['Sesiones', '0', '3'],
  ['Series', '0', '11'],
  ['Notas de ejercicio', '0', '2'],
  ['Actividades', '0', '2'],
  ['Pesos semanales', '0', '2'],
  ['Semanas', '0', '2'],
  ['Bloques opcionales', '2', '2'],
  ['Registros de bloques', '0', '2'],
  ['Métricas semanales', '0', '1'],
  ['Pendientes de sincronizar', '0', '29'],
];

function dataCounts(when: 'new' | 'after', pending?: string): Rows {
  return DATA_ROWS.map(([label, n, a]) => [
    label,
    label === 'Pendientes de sincronizar' && pending !== undefined
      ? pending
      : when === 'new'
        ? n
        : a,
  ]);
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** The header indicator (a link named "Sincronización: …" / "Sync: …"). */
function indicator(page: Page): Locator {
  return page.getByRole('link', { name: /^(Sincronización|Sync): / });
}

/** The value next to a term of a description list (sync card rows). */
function rowValue(page: Page, term: string): Locator {
  return page
    .getByRole('term')
    .filter({ hasText: new RegExp(`^${term}$`) })
    .locator('xpath=following-sibling::*[1]');
}

function toast(page: Page, text: string | RegExp): Locator {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first();
}

function dialogOf(page: Page, name: string): Locator {
  return page
    .getByRole('dialog', { name, exact: true })
    .or(page.getByRole('alertdialog', { name, exact: true }));
}

function keyField(page: Page, lang: Lang = 'es'): Locator {
  return page.getByLabel(lang === 'es' ? ES.keyLabel : 'Sync key', { exact: true });
}

function button(scope: Page | Locator, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

async function saveKey(page: Page, key: string, lang: Lang = 'es'): Promise<void> {
  await keyField(page, lang).fill(key);
  // The field must hold the key before saving; a lost value would otherwise only show up later.
  await expect(keyField(page, lang)).toHaveValue(key);
  await button(page, lang === 'es' ? ES.saveKey : 'Save key').click();
}

/** Sync requests the fake server has received so far (failed ones included). */
function syncCount(server: FakeSyncServer): number {
  return server.requestCount(SYNC_PATH);
}

/**
 * Waits until the server has received a sync request after the first `after` ones, then until
 * the card and the indicator say "Sincronizado" with nothing pending ("Sincronizado" only
 * appears once the server has answered, spec §2.1). A visible text alone is not proof that the
 * server answered, so the server is checked first. Every step uses the same timeout.
 */
async function expectSynced(
  page: Page,
  server: FakeSyncServer,
  after: number,
  timeout = WAIT,
): Promise<void> {
  await expect
    .poll(() => syncCount(server), { timeout, message: 'a sync request reached the server' })
    .toBeGreaterThan(after);
  await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.synced, { timeout });
  await expect(rowValue(page, ES.pending)).toHaveText('0', { timeout });
  await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sincronizado', { timeout });
}

// --- Clock -----------------------------------------------------------------------------------
// The app's timers (the ~2 s wait after a change, the 4/8/15/30/60 s retries, the 45 s sync)
// are moved with `page.clock`, never waited for. Order that works: `page.clock.install()`
// before the first `goto` (time still flows, so the app loads normally), `pauseClock` only once
// the page is ready and the server has answered what the test expected.

/** Stops the page clock (installed before the first `goto`) a moment from now. */
async function pauseClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 500);
}

/** Waits for something on the page; `check` receives the timeout it must use. */
type Settle = (check: (timeout: number) => Promise<unknown>) => Promise<void>;

/** Clock flowing: one check with the usual timeout. */
const live: Settle = async (check) => {
  await check(WAIT);
};

/**
 * Clock paused: retries `check` while moving the clock on in `step` ms steps, at most `budget`
 * ms in total. The small steps let the page's zero-delay timers run (local storage
 * notifications, first queries of a new screen), as they would with time flowing; the budget
 * guarantees that no timer due later than that (a retry, the wait after a change) runs behind
 * the test's back.
 */
function paused(page: Page, budget = 1_000, step = 100): Settle {
  return async (check) => {
    for (let spent = 0; ; spent += step) {
      try {
        await check(1_000);
        return;
      } catch (error) {
        if (spent >= budget) throw error;
      }
      await page.clock.runFor(step);
    }
  };
}

/** Clock paused: waits until the server has received more than `after` sync requests. */
async function serverGotSync(page: Page, server: FakeSyncServer, after: number): Promise<void> {
  await paused(
    page,
    2_500,
    250,
  )((timeout) => expect.poll(() => syncCount(server), { timeout }).toBeGreaterThan(after));
}

/** The counts list of the Datos card (the one with "Pendientes de sincronizar"). */
function countsList(page: Page): Locator {
  return page.locator('dl').filter({
    has: page
      .getByRole('term', { includeHidden: true })
      .filter({ hasText: /^Pendientes de sincronizar$/ }),
  });
}

async function readCounts(page: Page): Promise<Rows> {
  const list = countsList(page);
  const t = (await list.getByRole('term', { includeHidden: true }).allInnerTexts()).map((s) =>
    s.trim(),
  );
  const d = (await list.getByRole('definition', { includeHidden: true }).allInnerTexts()).map((s) =>
    s.trim(),
  );
  return t
    .map((term, i): [string, string] => [term, d[i] ?? ''])
    .filter(([term]) => term !== 'Almacenamiento');
}

/** Waits for the Datos card to load, then for its counts (same timeout for both steps). */
async function expectCounts(page: Page, expected: Rows, timeout = WAIT): Promise<void> {
  await expect(page.getByText('Cargando…', { exact: true })).toHaveCount(0, { timeout });
  await expect.poll(() => readCounts(page), { timeout }).toEqual(expected);
}

async function chooseFile(page: Page, buttonName: string, file: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await button(page, buttonName).click();
  await (await chooser).setFiles(file);
}

/**
 * Imports a Certavi backup from Settings and checks "Registros importados: n". With a paused
 * clock pass `paused(page)` as `settle`.
 */
async function importBackup(page: Page, file: string, n: number, settle = live): Promise<void> {
  await chooseFile(page, ES.importCertavi, file);
  const dialog = dialogOf(page, ES.importCertavi);
  await settle((timeout) => expect(dialog).toBeVisible({ timeout }));
  await button(dialog, ES.confirmImport).click();
  await settle(async (timeout) => {
    await expect(toast(page, `Registros importados: ${String(n)}`)).toBeVisible({ timeout });
    await expect(dialog).toBeHidden({ timeout });
  });
}

async function download(
  page: Page,
  buttonName: string | RegExp,
  testInfo: TestInfo,
  prefix = '',
): Promise<{ name: string; file: string }> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  const dl = await pending;
  const name = dl.suggestedFilename();
  const file = testInfo.outputPath(`${prefix}${name}`);
  await dl.saveAs(file);
  return { name, file };
}

/** A synthetic Certavi full copy: the sample file, changed by `mutate`. */
function backupVariant(
  testInfo: TestInfo,
  name: string,
  mutate: (records: BackupRecord[]) => void,
) {
  const sample = JSON.parse(readFileSync(SAMPLE, 'utf8')) as { records: BackupRecord[] };
  mutate(sample.records);
  const file = testInfo.outputPath(name);
  writeFileSync(file, JSON.stringify(sample, null, 2));
  return file;
}

/** The sample plus one new activity (one more record to import). */
function sampleWithExtraActivity(testInfo: TestInfo, id: string): string {
  return backupVariant(testInfo, `${id}.json`, (records) => {
    records.push({
      id,
      type: 'activity',
      updatedAt: 1792800000000,
      date: '2026-10-27',
      kind: 'football',
      minutes: 45,
      note: `E2E ${id}`,
    });
  });
}

async function newDevice(
  browser: Browser,
  testInfo: TestInfo,
  server: FakeSyncServer,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 390, height: 844 },
  });
  await server.attach(context);
  const page = await context.newPage();
  return { context, page };
}

/** Date strings today could be written as in `locale` (lower case). */
async function todayForms(page: Page, locale: string): Promise<string[]> {
  return page.evaluate((loc) => {
    const d = new Date();
    const opts: Intl.DateTimeFormatOptions[] = [
      { dateStyle: 'short' },
      { dateStyle: 'medium' },
      { dateStyle: 'long' },
      { dateStyle: 'full' },
      { day: 'numeric', month: 'short' },
      { day: 'numeric', month: 'long' },
      { day: '2-digit', month: '2-digit' },
      { day: 'numeric', month: 'numeric' },
    ];
    return opts.map((o) => new Intl.DateTimeFormat(loc, o).format(d).toLowerCase());
  }, locale);
}

/** Attempt items of /settings/sync (each shows "Enviados: n · Recibidos: n · x s"). */
function attemptItems(page: Page, lang: Lang = 'es'): Locator {
  return page.getByRole('listitem').filter({
    hasText: lang === 'es' ? /Enviados: \d+ · Recibidos: \d+ · / : /Sent: \d+ · Received: \d+ · /,
  });
}

/** Backup items of /settings/sync (each has a "Descargar"/"Download" button). */
function backupItems(page: Page): Locator {
  return page.getByRole('listitem').filter({
    has: page.getByRole('button', { name: /^(Descargar la copia del|Download the backup of) / }),
  });
}

async function axe(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const summary = serious.map(
    (v) =>
      `${v.id} [${String(v.impact)}]: ${v.help}\n` +
      v.nodes
        .slice(0, 5)
        .map((n) => `   - ${n.target.join(' ')} :: ${n.failureSummary ?? ''}`)
        .join('\n'),
  );
  expect(serious, `${label}\n${summary.join('\n')}`).toEqual([]);
}

/** Opens Ajustes, imports the sample (29 records) and saves the right key: synced. */
async function syncedWithSample(page: Page, server: FakeSyncServer): Promise<void> {
  await gotoReady(page, '/settings', 'Ajustes');
  await importBackup(page, SAMPLE, 29);
  const before = syncCount(server);
  await saveKey(page, E2E_SYNC_KEY);
  await expect(toast(page, ES.keySaved)).toBeVisible();
  await expectSynced(page, server, before);
}

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

test.describe('sync', { tag: '@all-engines' }, () => {
  test('AC-SYNC-01 · a new device is "Sin configurar", the card comes first with the key form, no request is made', async ({
    page,
    context,
  }) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await page.clock.install();

    await gotoReady(page, '/', 'Hoy');
    const link = indicator(page);
    await expect(link).toHaveAccessibleName('Sincronización: Sin configurar');
    // Between the page title and the theme button.
    const title = await boxOf(h1(page));
    const ind = await boxOf(link);
    const theme = await boxOf(themeButton(page));
    expect(ind.x).toBeGreaterThan(title.x);
    expect(ind.x).toBeLessThan(theme.x);

    // It is a link to Ajustes.
    await link.click();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expect(page).toHaveURL(/\/settings$/);

    // The "Sincronización" card is the first one, before "Apariencia".
    const card = page.getByRole('heading', { name: ES.card, exact: true });
    await expect(card).toBeVisible();
    const cardBox = await boxOf(card);
    const appearance = await boxOf(page.getByText('Apariencia', { exact: true }).first());
    expect(cardBox.y).toBeLessThan(appearance.y);
    await expect(page.getByText(ES.cardText, { exact: true })).toBeVisible();
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.notSetUp);
    await expect(rowValue(page, ES.lastSync)).toHaveText(ES.never);
    await expect(rowValue(page, ES.pending)).toHaveText('0');

    // The key form.
    await expect(keyField(page)).toBeVisible();
    await expect(keyField(page)).toHaveAttribute('type', 'password');
    await expect(page.getByText(ES.keyHint, { exact: true })).toBeVisible();
    await expect(button(page, ES.showKey)).toBeVisible();
    await expect(button(page, ES.saveKey)).toBeVisible();
    await expect(button(page, ES.syncNow)).toHaveCount(0);

    // /settings/sync without a key.
    await page.getByRole('link', { name: ES.logLink, exact: true }).click();
    await expect(h1(page, ES.card)).toBeVisible();
    await expect(page.getByText(ES.noAttempts, { exact: true })).toBeVisible();
    await expect(page.getByText(ES.backupsNoKey, { exact: true })).toBeVisible();

    // Past the start sync, the ~2 s wait after a change and the first retry.
    await page.clock.runFor(10_000);
    expect(server.requestCount(), 'requests to /api/v1/ without a key').toBe(0);
    await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sin configurar');
  });

  test('AC-SYNC-02 · a 31-character key is not saved; "Mostrar clave" toggles; a key with spaces at the ends is trimmed', async ({
    page,
    context,
  }) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await gotoReady(page, '/settings', 'Ajustes');

    // Show / hide the key: same name, pressed state changes.
    const show = button(page, ES.showKey);
    await expect(show).toHaveAttribute('aria-pressed', 'false');
    await show.click();
    await expect(button(page, ES.showKey)).toHaveAttribute('aria-pressed', 'true');
    await expect(keyField(page)).toHaveAttribute('type', 'text');
    await button(page, ES.showKey).click();
    await expect(keyField(page)).toHaveAttribute('type', 'password');

    // 31 characters.
    await saveKey(page, 'a'.repeat(31));
    await expect(page.getByText(ES.shortKey, { exact: true })).toBeVisible();
    await expect(page.getByText(ES.keyStored, { exact: true })).toHaveCount(0);
    await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sin configurar');

    // 31 characters padded with spaces at the ends: the spaces do not count.
    await saveKey(page, `  ${'b'.repeat(31)}  `);
    await expect(page.getByText(ES.shortKey, { exact: true })).toBeVisible();
    await expect(page.getByText(ES.keySaved, { exact: true })).toHaveCount(0);

    // Not saved: after a reload the form is still there.
    await page.reload();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expect(keyField(page)).toBeVisible();
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.notSetUp);
    expect(server.requestCount()).toBe(0);

    // The right key with spaces at the ends: saved without them (the server accepts it).
    await saveKey(page, `  ${E2E_SYNC_KEY}  `);
    await expect(toast(page, ES.keySaved)).toBeVisible();
    await expect(page.getByText(ES.keyStored, { exact: true })).toBeVisible();
    await expectSynced(page, server, 0);
  });

  test('AC-SYNC-03 · saving the right key sends the 29 imported records; log shows one "Correcto" attempt', async ({
    page,
    context,
  }) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await gotoReady(page, '/settings', 'Ajustes');
    await importBackup(page, SAMPLE, 29);
    await expect(rowValue(page, ES.pending)).toHaveText('29');
    await expect(indicator(page)).toHaveAccessibleName(
      /^Sincronización: Sin configurar( · 29 pendientes)?$/,
    );
    await expect(rowValue(page, ES.lastSync)).toHaveText(ES.never);

    // The server holds its answer for 2 s: until it answers the state must be "Sincronizando…",
    // never "Sincronizado" (spec §2.1).
    const status = rowValue(page, ES.status);
    const syncingName = /^Sincronización: Sincronizando…( · 29 pendientes)?$/;
    server.setDelay(2_000);
    await saveKey(page, E2E_SYNC_KEY);
    await expect(toast(page, ES.keySaved)).toBeVisible();
    await expect(status).toHaveText(STATE_ES.syncing);
    await expect(indicator(page)).toHaveAccessibleName(syncingName);
    const seen = new Set<string>();
    await expect
      .poll(
        async () => {
          seen.add((await status.innerText()).trim());
          return syncCount(server);
        },
        { timeout: WAIT, message: 'the first sync reached the server' },
      )
      .toBeGreaterThan(0);
    server.setDelay(0); // only the first request is held
    // The answer is still held.
    await expect(status).toHaveText(STATE_ES.syncing);
    await expect(indicator(page)).toHaveAccessibleName(syncingName);
    expect([...seen], 'states shown before the server had the request').toEqual([STATE_ES.syncing]);

    await expectSynced(page, server, 0);
    await expectCounts(page, dataCounts('after', '0'));

    // "Última sincronización" shows today.
    const last = (await rowValue(page, ES.lastSync).innerText()).trim().toLowerCase();
    const forms = [...(await todayForms(page, 'es-ES')), 'hoy'];
    expect(
      forms.some((f) => last.includes(f)),
      `"${last}" should show today (${forms.join(' | ')})`,
    ).toBe(true);

    expect(await server.records()).toHaveLength(29);

    await page.getByRole('link', { name: ES.logLink, exact: true }).click();
    await expect(h1(page, ES.card)).toBeVisible();
    const items = attemptItems(page);
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText(ES.ok);
    await expect(items.first()).toContainText(/Enviados: 29 · Recibidos: 29 · [\d.,]+ s/);
  });

  test('AC-SYNC-04 · a wrong key shows "Clave incorrecta", stops retrying and keeps the changes pending', async ({
    page,
    context,
  }) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await page.clock.install();
    await gotoReady(page, '/settings', 'Ajustes');
    await importBackup(page, SAMPLE, 29);

    await saveKey(page, E2E_WRONG_KEY);
    await expect
      .poll(() => syncCount(server), { timeout: WAIT, message: 'the server got the wrong key' })
      .toBeGreaterThan(0);
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.error, { timeout: WAIT });
    await expect(page.getByText(ES.wrongKey, { exact: true }).first()).toBeVisible();
    await expect(indicator(page)).toHaveAccessibleName('Sincronización: Error · 29 pendientes');
    await expect(rowValue(page, ES.pending)).toHaveText('29');

    // No new attempt on its own: past the 4, 8 and 15 s retries and the 45 s sync of changes
    // waiting.
    const afterError = server.requestCount();
    await page.clock.runFor(60_000);
    expect(server.requestCount(), 'no retry after a wrong key').toBe(afterError);
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.error);
    expect(await server.records()).toHaveLength(0);
    await expect(rowValue(page, ES.pending)).toHaveText('29');

    // "Sincronizar ahora" does try again (and fails the same way).
    await button(page, ES.syncNow).click();
    await expect.poll(() => server.requestCount(), { timeout: WAIT }).toBeGreaterThan(afterError);
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.error, { timeout: WAIT });
    await expect(rowValue(page, ES.pending)).toHaveText('29');

    // Changing the key to the right one sends everything.
    await button(page, ES.changeKey).click();
    const before = syncCount(server);
    await saveKey(page, E2E_SYNC_KEY);
    await expectSynced(page, server, before);
    expect(await server.records()).toHaveLength(29);
  });

  test('AC-SYNC-05 · offline: "Sin conexión" with pending count, no request; back online it syncs on its own', async ({
    page,
    context,
  }, testInfo) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await page.clock.install();
    await syncedWithSample(page, server);
    const extra = sampleWithExtraActivity(testInfo, 'act_e2e_offline_0001');

    await context.setOffline(true);
    await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sin conexión');
    const before = server.requestCount();
    await importBackup(page, extra, 1);
    await expect(indicator(page)).toHaveAccessibleName(
      'Sincronización: Sin conexión · 1 pendiente',
    );
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.offline);
    await expect(rowValue(page, ES.pending)).toHaveText('1');
    // Past the "couple of seconds after a change" (and the first retry).
    await page.clock.runFor(5_000);
    expect(server.requestCount(), 'no request while offline').toBe(before);
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.offline);
    await expect(rowValue(page, ES.pending)).toHaveText('1');

    await context.setOffline(false);
    await expectSynced(page, server, before);
    expect(await server.records()).toHaveLength(30);
    await expectCounts(
      page,
      dataCounts('after', '0').map(([l, n]) => [l, l === 'Actividades' ? '3' : n]),
    );
  });

  test('AC-SYNC-06 · a cut connection and a 500 show the reason, keep the changes, and a later attempt sends them', async ({
    page,
    context,
  }, testInfo) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await page.clock.install();
    await gotoReady(page, '/settings', 'Ajustes');
    await saveKey(page, E2E_SYNC_KEY);
    // The key's first sync (an empty batch) has been answered: the next request is the import's.
    await expectSynced(page, server, 0);

    // From here the clock is still while failures are checked: the ~2 s wait after a change
    // and the 4 s retry only run when the test moves the clock, so the failure lands on the
    // import's sync and the error is seen before any retry can fix it.
    const still = paused(page);
    await pauseClock(page);

    // The connection is cut on the next attempt.
    let before = syncCount(server);
    server.failNext('abort');
    await importBackup(page, SAMPLE, 29, still);
    await page.clock.runFor(2_500); // past the ~2 s wait after a change
    await serverGotSync(page, server, before);
    await still(async (timeout) => {
      await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.error, { timeout });
      await expect(page.getByText(ES.unreachable, { exact: true }).first()).toBeVisible({
        timeout,
      });
      await expect(rowValue(page, ES.pending)).toHaveText('29', { timeout });
    });
    expect(await server.records()).toHaveLength(0);
    expect(syncCount(server), 'no retry while the clock is still').toBe(before + 1);

    // The automatic retry, 4 s after the failure, sends them.
    before = syncCount(server);
    await page.clock.runFor(4_500);
    await serverGotSync(page, server, before);
    await page.clock.resume();
    await expectSynced(page, server, before);
    expect(await server.records()).toHaveLength(29);

    // The server answers 500 on the next attempt (the previous one was answered: "Sincronizado").
    await pauseClock(page);
    before = syncCount(server);
    server.failNext(500);
    await importBackup(page, sampleWithExtraActivity(testInfo, 'act_e2e_retry_0001'), 1, still);
    await page.clock.runFor(2_500); // past the ~2 s wait after a change
    await serverGotSync(page, server, before);
    await still(async (timeout) => {
      await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.error, { timeout });
      await expect(page.getByText(ES.serverError, { exact: true }).first()).toBeVisible({
        timeout,
      });
      await expect(rowValue(page, ES.pending)).toHaveText('1', { timeout });
    });
    expect(await server.records()).toHaveLength(29);
    expect(syncCount(server), 'no retry while the clock is still').toBe(before + 1);

    // "Sincronizar ahora" sends it.
    await page.clock.resume();
    before = syncCount(server);
    await button(page, ES.syncNow).click();
    await expect(toast(page, ES.synced)).toBeVisible({ timeout: WAIT });
    await expectSynced(page, server, before);
    expect(await server.records()).toHaveLength(30);
  });

  test('AC-SYNC-07 · changes waiting offline survive a reload and are sent when the network comes back', async ({
    page,
    context,
  }, testInfo) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await syncedWithSample(page, server);

    await context.setOffline(true);
    await importBackup(page, sampleWithExtraActivity(testInfo, 'act_e2e_reload_0001'), 1);
    await expect(indicator(page)).toHaveAccessibleName(
      'Sincronización: Sin conexión · 1 pendiente',
    );

    // Reload while the server is still unreachable. The page itself needs the network to load
    // (no service worker yet in this phase), so only /api/v1/ stays cut during the reload.
    const unreachable = (route: Route) => route.abort('internetdisconnected');
    await context.route('**/api/v1/**', unreachable);
    await context.setOffline(false);
    await page.reload();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    // Starting the app closes the finished weeks that have data and no frozen plan yet
    // (calendar.md): each one is one more week and one more change waiting to sync, next to the
    // activity. The exact figure depends on the sample dates, so only the relation is checked.
    const count = (rows: Rows, label: string) =>
      Number(rows.find(([term]) => term === label)?.[1] ?? Number.NaN);
    await expect
      .poll(
        async () => {
          const rows = await readCounts(page);
          const closed = count(rows, 'Semanas') - 2;
          return closed > 0 && count(rows, 'Pendientes de sincronizar') >= 1 + closed;
        },
        { timeout: WAIT },
      )
      .toBe(true);
    await expect(rowValue(page, ES.pending)).not.toHaveText('0');
    expect(await server.records()).toHaveLength(29);

    // The network comes back.
    const before = syncCount(server);
    await context.unroute('**/api/v1/**', unreachable);
    await context.setOffline(true);
    await context.setOffline(false);
    await expectSynced(page, server, before);
    expect((await server.records()).length).toBeGreaterThan(29);
  });

  test('AC-SYNC-08 · a second, empty device with the same key gets the same data and nothing pending', async ({
    page,
    context,
    browser,
  }, testInfo) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await syncedWithSample(page, server);
    await expectCounts(page, dataCounts('after', '0'));
    const countsA = await readCounts(page);

    const b = await newDevice(browser, testInfo, server);
    try {
      await gotoReady(b.page, '/settings', 'Ajustes');
      await expectCounts(b.page, dataCounts('new'));
      const before = syncCount(server);
      await saveKey(b.page, E2E_SYNC_KEY);
      await expect(toast(b.page, ES.keySaved)).toBeVisible();
      await expectSynced(b.page, server, before);
      await expectCounts(b.page, countsA);
    } finally {
      await b.context.close();
    }
  });

  test('AC-SYNC-09 · the same record changed on two devices: the newer change (B) wins on both', async ({
    page,
    context,
    browser,
  }, testInfo) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    const ACT = 'act_mg2a3b4c5d6e7f8g9h';
    const version = (who: 'A' | 'B', plus: number) =>
      backupVariant(testInfo, `version-${who}.json`, (records) => {
        const act = records.find((r) => r.id === ACT);
        if (!act) throw new Error('activity not in the sample');
        act.updatedAt = (act.updatedAt as number) + plus;
        act.note = `E2E versión ${who}`;
      });

    await syncedWithSample(page, server);
    const b = await newDevice(browser, testInfo, server);
    try {
      await b.page.clock.install();
      await gotoReady(b.page, '/settings', 'Ajustes');
      let before = syncCount(server);
      await saveKey(b.page, E2E_SYNC_KEY);
      await expect(toast(b.page, ES.keySaved)).toBeVisible();
      await expectSynced(b.page, server, before);
      await expectCounts(b.page, dataCounts('after', '0'));

      // A changes the activity while offline; later B changes it too and syncs first.
      await context.setOffline(true);
      await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sin conexión');
      await importBackup(page, version('A', 1000), 1);
      await expect(rowValue(page, ES.pending)).toHaveText('1');
      before = syncCount(server); // A is offline: only B can reach the server now
      await importBackup(b.page, version('B', 2000), 1);
      await b.page.clock.runFor(2_500); // past B's ~2 s wait after a change
      await expectSynced(b.page, server, before);
      await expect
        .poll(async () => JSON.stringify(await server.records()), { timeout: WAIT })
        .toContain('E2E versión B');

      // A syncs after B.
      before = syncCount(server);
      await context.setOffline(false);
      await expectSynced(page, server, before);
      before = syncCount(server);
      await button(b.page, ES.syncNow).click();
      await expect(toast(b.page, ES.synced)).toBeVisible({ timeout: WAIT });
      await expectSynced(b.page, server, before);

      const onServer = JSON.stringify(await server.records());
      expect(onServer).toContain('E2E versión B');
      expect(onServer).not.toContain('E2E versión A');
      for (const [who, p] of [
        ['A', page],
        ['B', b.page],
      ] as const) {
        const backup = await download(p, ES.exportJson, testInfo, `device-${who}-`);
        const text = readFileSync(backup.file, 'utf8');
        expect(text, `device ${who} holds B's version`).toContain('E2E versión B');
        expect(text, `device ${who} no longer holds A's version`).not.toContain('E2E versión A');
      }
      await expectCounts(page, dataCounts('after', '0'));
      await expectCounts(b.page, dataCounts('after', '0'));
    } finally {
      await b.context.close();
    }
  });

  test('AC-SYNC-10 · "Cambiar clave" can be cancelled; "Olvidar clave": Cancel keeps it, confirm forgets it', async ({
    page,
    context,
  }) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await page.clock.install();
    await syncedWithSample(page, server);
    await expect(page.getByText(ES.keyStored, { exact: true })).toBeVisible();
    // The key itself is never shown again.
    await expect(page.getByText(E2E_SYNC_KEY)).toHaveCount(0);

    // Change key → form with Cancel → back without changes.
    await button(page, ES.changeKey).click();
    await expect(keyField(page)).toBeVisible();
    await button(page, ES.cancel).click();
    await expect(keyField(page)).toHaveCount(0);
    await expect(page.getByText(ES.keyStored, { exact: true })).toBeVisible();

    // Forget → Cancel (focused) keeps the key.
    await button(page, ES.forgetKey).click();
    const dialog = dialogOf(page, ES.forgetTitle);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(ES.forgetText, { exact: true })).toBeVisible();
    await expect(button(dialog, ES.cancel)).toBeFocused();
    await expect(button(dialog, ES.forget)).toBeVisible();
    await button(dialog, ES.cancel).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(ES.keyStored, { exact: true })).toBeVisible();
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.synced);

    // Forget → confirm.
    await button(page, ES.forgetKey).click();
    await expect(dialog).toBeVisible();
    await button(dialog, ES.forget).click();
    await expect(toast(page, ES.keyForgotten)).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.notSetUp);
    await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sin configurar');
    await expect(keyField(page)).toBeVisible();
    await expect(button(page, ES.syncNow)).toHaveCount(0);
    // The data stays on the device.
    await expectCounts(page, dataCounts('after', '0'));

    // Still forgotten after a reload, and no more requests.
    const count = server.requestCount();
    await page.reload();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.notSetUp);
    // Past the start sync and the first retry.
    await page.clock.runFor(10_000);
    expect(server.requestCount(), 'no request after forgetting the key').toBe(count);
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.notSetUp);
  });

  test('AC-SYNC-11 · the attempt log lists every attempt newest first, with the failed one on top', async ({
    page,
    context,
  }) => {
    // Three attempts. That the log keeps only the last 40 is covered by the unit tests of the
    // attempt log (src/data/sync/attemptLog.test.ts): 42 clicks here cost a minute in WebKit.
    const server = createFakeSyncServer();
    await server.attach(context);
    await syncedWithSample(page, server); // attempt 1: "Enviados: 29"

    const syncNow = button(page, ES.syncNow);
    // Attempt 2 is answered before the failure is queued.
    let before = syncCount(server);
    await syncNow.click();
    await expect.poll(() => syncCount(server), { timeout: WAIT }).toBeGreaterThan(before);
    await expect(syncNow).toBeEnabled({ timeout: WAIT });
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.synced, { timeout: WAIT });
    // Attempt 3, the newest, fails with a wrong key (no retries afterwards).
    before = syncCount(server);
    server.failNext(401);
    await syncNow.click();
    await expect.poll(() => syncCount(server), { timeout: WAIT }).toBeGreaterThan(before);
    await expect(rowValue(page, ES.status)).toHaveText(STATE_ES.error, { timeout: WAIT });

    await page.getByRole('link', { name: ES.logLink, exact: true }).click();
    await expect(h1(page, ES.card)).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: ES.log, exact: true })).toBeVisible();
    await expect(page.getByText(ES.logText, { exact: true })).toBeVisible();
    const items = attemptItems(page);
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText(ES.wrongKey);
    await expect(items.nth(1)).toContainText(ES.ok);
    // The first attempt, the oldest, sent the 29 records of the sample.
    await expect(items.nth(2)).toContainText('Enviados: 29');
  });

  test('AC-SYNC-12 · two server backups are listed newest first; "Descargar" gives a file Certavi imports', async ({
    page,
    context,
    browser,
  }, testInfo) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await syncedWithSample(page, server);
    const countsA = await readCounts(page);
    const all = await server.records();
    expect(all).toHaveLength(29);
    await server.addBackup('2026-11-01', all.slice(0, 10));
    await server.addBackup('2026-11-02', all);

    await page.getByRole('link', { name: ES.logLink, exact: true }).click();
    await expect(h1(page, ES.card)).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: ES.backups, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(ES.backupsText, { exact: true })).toBeVisible();
    await expect(button(page, 'Actualizar')).toBeVisible();
    const items = backupItems(page);
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('2 de noviembre de 2026');
    await expect(items.nth(0)).toContainText('29 registros');
    await expect(items.nth(1)).toContainText('1 de noviembre de 2026');
    await expect(items.nth(1)).toContainText('10 registros');
    await expect(button(page, 'Restaurar la copia del 2 de noviembre de 2026')).toBeVisible();

    const file = await download(page, 'Descargar la copia del 2 de noviembre de 2026', testInfo);
    expect(file.name).toBe('certavi-server-backup-2026-11-02.json');
    expect(() => JSON.parse(readFileSync(file.file, 'utf8')) as unknown).not.toThrow();

    // A new device without a key accepts it with "Importar copia de Certavi".
    const other = await newDevice(browser, testInfo, server);
    try {
      await gotoReady(other.page, '/settings', 'Ajustes');
      await expectCounts(other.page, dataCounts('new'));
      await chooseFile(other.page, ES.importCertavi, file.file);
      const dialog = dialogOf(other.page, ES.importCertavi);
      await expect(dialog).toBeVisible();
      await button(dialog, ES.confirmImport).click();
      await expect(toast(other.page, /^Registros importados: \d+$/)).toBeVisible();
      await expect(dialog).toBeHidden();
      const withoutPending = (rows: Rows) =>
        rows.filter(([l]) => l !== 'Pendientes de sincronizar');
      await expect
        .poll(async () => withoutPending(await readCounts(other.page)))
        .toEqual(withoutPending(countsA));
    } finally {
      await other.context.close();
    }
  });

  test('AC-SYNC-13 · restoring a smaller backup: confirm dialog, toast, counts match it here and on another device', async ({
    page,
    context,
    browser,
  }, testInfo) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await syncedWithSample(page, server);
    // The backup holds only the sessions and sets (14 of the 29 records).
    const small = (await server.records()).filter((r) => r.type === 'session' || r.type === 'set');
    expect(small, 'sessions + sets on the server').toHaveLength(14);
    await server.addBackup('2026-11-02', small);

    await page.getByRole('link', { name: ES.logLink, exact: true }).click();
    await expect(h1(page, ES.card)).toBeVisible();
    await expect(backupItems(page)).toHaveCount(1);

    const title = '¿Restaurar la copia del 2 de noviembre de 2026?';
    const dialog = dialogOf(page, title);
    // Cancel changes nothing.
    await button(page, 'Restaurar la copia del 2 de noviembre de 2026').click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(ES.restoreText, { exact: true })).toBeVisible();
    await expect(button(dialog, ES.cancel)).toBeFocused();
    await button(dialog, ES.cancel).click();
    await expect(dialog).toBeHidden();

    await button(page, 'Restaurar la copia del 2 de noviembre de 2026').click();
    await expect(dialog).toBeVisible();
    const beforeRestore = syncCount(server); // restoring starts a sync
    await button(dialog, ES.restore).click();
    const restored = toast(page, /^Copia restaurada\. Registros cambiados: \d+$/);
    await expect(restored).toBeVisible();
    const n = Number(/(\d+)$/.exec(await restored.innerText())?.[1]);
    testInfo.annotations.push({ type: 'records changed', description: String(n) });
    expect(n).toBeGreaterThan(0);

    const expected: Rows = [
      ['Ejercicios', '45'],
      ['Rutinas', '6'],
      ['Sesiones', '3'],
      ['Series', '11'],
      ['Notas de ejercicio', '0'],
      ['Actividades', '0'],
      ['Pesos semanales', '0'],
      ['Semanas', '0'],
      ['Bloques opcionales', '2'],
      ['Registros de bloques', '0'],
      ['Métricas semanales', '0'],
      ['Pendientes de sincronizar', '0'],
    ];
    await page.getByRole('link', { name: ES.back, exact: true }).click();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expectSynced(page, server, beforeRestore);
    await expectCounts(page, expected);

    const other = await newDevice(browser, testInfo, server);
    try {
      await gotoReady(other.page, '/settings', 'Ajustes');
      const before = syncCount(server);
      await saveKey(other.page, E2E_SYNC_KEY);
      await expectSynced(other.page, server, before);
      await expectCounts(other.page, expected);
    } finally {
      await other.context.close();
    }
  });

  // AC-SYNC-15: leaving the app sends what is waiting, without the usual few seconds, with
  // keepalive. The page clock is paused right after the first sync, so the ~2 s wait after a
  // change can only run if the test moves it, and the test never does before the assertion.
  const LEAVE_WAYS = [
    [
      'the page becomes hidden (visibilitychange)',
      () => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'hidden',
        });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      },
    ],
    [
      'the page is closed (pagehide)',
      () => {
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
      },
    ],
  ] as const;

  for (const [way, leave] of LEAVE_WAYS) {
    test(
      `AC-SYNC-15 · with a change waiting, ${way} sends it right away, with keepalive`,
      {
        tag: '@all-engines',
      },
      async ({ page, context }, testInfo) => {
        const server = createFakeSyncServer();
        await server.attach(context);
        // Records how the page calls fetch, to see whether the request is marked keepalive.
        await page.addInitScript(() => {
          const log: { url: string; keepalive: boolean }[] = [];
          (window as unknown as { __fetchLog: typeof log }).__fetchLog = log;
          const original = window.fetch.bind(window);
          window.fetch = (input, init) => {
            const keepalive =
              init?.keepalive ?? (input instanceof Request ? input.keepalive : false);
            log.push({
              url: input instanceof Request ? input.url : input.toString(),
              keepalive,
            });
            return original(input, init);
          };
        });
        const fetchLog = () =>
          page.evaluate(
            (syncPath) =>
              (
                window as unknown as { __fetchLog: { url: string; keepalive: boolean }[] }
              ).__fetchLog
                .filter((entry) => entry.url.includes(syncPath))
                .map((entry) => entry.keepalive),
            SYNC_PATH,
          );

        await page.clock.install();
        await syncedWithSample(page, server);

        // The clock stops: from here no timer runs unless the test moves it.
        const still = paused(page);
        await pauseClock(page);
        const before = syncCount(server);
        const sentBefore = (await fetchLog()).length;
        await importBackup(page, sampleWithExtraActivity(testInfo, 'act_e2e_leave_0001'), 1, still);
        await still(async (timeout) => {
          await expect(indicator(page)).toHaveAccessibleName(
            /^Sincronización: Pendiente de enviar( · 1 pendiente)?$/,
            { timeout },
          );
          await expect(rowValue(page, ES.pending)).toHaveText('1', { timeout });
        });
        expect(syncCount(server), 'nothing sent yet: the few seconds have not passed').toBe(before);
        const onServerBefore = (await server.records()).length;

        // The app goes to the background / is closed. The clock stays paused.
        await page.evaluate(leave);
        await expect
          .poll(() => syncCount(server), {
            timeout: WAIT,
            message: 'the change reached the server without moving the clock',
          })
          .toBeGreaterThan(before);
        await expect
          .poll(async () => (await server.records()).length, { timeout: WAIT })
          .toBe(onServerBefore + 1);

        // That request was marked keepalive.
        const sent = (await fetchLog()).slice(sentBefore);
        expect(sent, 'sync requests made after the change').not.toHaveLength(0);
        expect(sent.at(-1), 'the request made on leaving has keepalive').toBe(true);

        // The server answered: the indicator ends "Sincronizado" with nothing pending.
        await page.clock.resume();
        await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sincronizado', {
          timeout: WAIT,
        });
        await expect(rowValue(page, ES.pending)).toHaveText('0', { timeout: WAIT });
      },
    );
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`AC-SYNC-14 · the card, the indicator and /settings/sync have no serious axe issues (${scheme})`, async ({
      page,
      context,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'axe runs once, in Chromium');
      const server = createFakeSyncServer();
      await server.attach(context);
      await page.emulateMedia({ colorScheme: scheme });
      await gotoReady(page, '/settings', 'Ajustes');
      await expectTheme(page, scheme);
      await expect(keyField(page)).toBeVisible();
      await expect(page.getByText('Cargando…', { exact: true })).toHaveCount(0);
      await axe(page, `/settings, key form (${scheme})`);

      await saveKey(page, E2E_SYNC_KEY);
      await expectSynced(page, server, 0);
      await axe(page, `/settings, key saved (${scheme})`);

      await server.addBackup('2026-11-02', [{ id: 'e2e-a' }, { id: 'e2e-b' }]);
      await server.addBackup('2026-11-01', [{ id: 'e2e-a' }]);
      await page.getByRole('link', { name: ES.logLink, exact: true }).click();
      await expect(h1(page, ES.card)).toBeVisible();
      await expect(backupItems(page)).toHaveCount(2);
      await expect(attemptItems(page)).toHaveCount(1);
      await axe(page, `/settings/sync (${scheme})`);
    });
  }

  test('AC-SYNC-14 · every text of the sync screens is in English when the language is English', async ({
    page,
    context,
  }) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await setLanguage(page, 'en');

    await expect(indicator(page)).toHaveAccessibleName('Sync: Not set up');
    await expect(page.getByRole('heading', { name: 'Sync', exact: true })).toBeVisible();
    await expect(
      page.getByText(
        'Copies your data to the server and to your other devices. Offline, changes wait on the device.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(rowValue(page, 'Status')).toHaveText('Not set up');
    await expect(rowValue(page, 'Last sync')).toHaveText('Never');
    await expect(rowValue(page, 'Pending')).toHaveText('0');
    await expect(keyField(page, 'en')).toBeVisible();
    await expect(
      page.getByText('The same key on all your devices. At least 32 characters.', { exact: true }),
    ).toBeVisible();
    await button(page, 'Show key').click();
    await expect(button(page, 'Show key')).toHaveAttribute('aria-pressed', 'true');
    await saveKey(page, 'k'.repeat(31), 'en');
    await expect(
      page.getByText('The key must have at least 32 characters.', { exact: true }),
    ).toBeVisible();

    // /settings/sync without a key.
    await page.getByRole('link', { name: 'Attempt log and server backups', exact: true }).click();
    await expect(h1(page, 'Sync')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Settings', exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Attempt log', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('The last 40 attempts on this device.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('No attempts yet.', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Server backups', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('The server keeps one backup a day (Madrid time), the last 14.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText('Save the sync key in Settings to see the backups.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back to Settings', exact: true }).click();
    await expect(h1(page, 'Settings')).toBeVisible();

    // Save the key, sync now, an error.
    await saveKey(page, E2E_SYNC_KEY, 'en');
    await expect(toast(page, 'Key saved.')).toBeVisible();
    await expect(page.getByText('Key saved on this device.', { exact: true })).toBeVisible();
    await expect.poll(() => syncCount(server), { timeout: WAIT }).toBeGreaterThan(0);
    await expect(rowValue(page, 'Status')).toHaveText('Synced', { timeout: WAIT });
    await expect(indicator(page)).toHaveAccessibleName('Sync: Synced');
    let before = syncCount(server);
    await button(page, 'Sync now').click();
    await expect(toast(page, 'Synced.')).toBeVisible({ timeout: WAIT });
    // That attempt was answered before the failure is queued.
    expect(syncCount(server)).toBeGreaterThan(before);
    await expect(button(page, 'Sync now')).toBeEnabled({ timeout: WAIT });
    before = syncCount(server);
    server.failNext(401);
    await button(page, 'Sync now').click();
    await expect.poll(() => syncCount(server), { timeout: WAIT }).toBeGreaterThan(before);
    await expect(rowValue(page, 'Status')).toHaveText('Error', { timeout: WAIT });
    await expect(
      page.getByText('Wrong key. Check it in Settings.', { exact: true }).first(),
    ).toBeVisible();
    await expect(indicator(page)).toHaveAccessibleName('Sync: Error');
    await button(page, 'Sync now').click();
    await expect(rowValue(page, 'Status')).toHaveText('Synced', { timeout: WAIT });

    // Change key → Cancel.
    await button(page, 'Change key').click();
    await expect(keyField(page, 'en')).toBeVisible();
    await button(page, 'Cancel').click();
    await expect(page.getByText('Key saved on this device.', { exact: true })).toBeVisible();

    // /settings/sync with a key: attempts and backups.
    await page.getByRole('link', { name: 'Attempt log and server backups', exact: true }).click();
    await expect(h1(page, 'Sync')).toBeVisible();
    await expect(page.getByText('No backups yet.', { exact: true })).toBeVisible();
    const items = attemptItems(page, 'en');
    // At least the four attempts of this test. When the key is saved, the engine re-queues every
    // record; if that queue change reaches it while the first attempt is already running (slow
    // IndexedDB, as in WebKit), it runs one more attempt right after. So the count is not exact,
    // but the newest two are always the ones the test made last.
    await expect.poll(() => items.count()).toBeGreaterThanOrEqual(4);
    await expect(items.filter({ hasText: 'Wrong key. Check it in Settings.' })).toHaveCount(1);
    await expect(items.nth(0)).toContainText('OK');
    await expect(items.nth(1)).toContainText('Wrong key. Check it in Settings.');
    await expect(items.nth(0)).toContainText(/Sent: \d+ · Received: \d+ · [\d.,]+ s/);

    await server.addBackup(
      '2026-11-02',
      Array.from({ length: 1532 }, (_, i) => ({ id: `e2e-${String(i)}` })),
    );
    await button(page, 'Refresh').click();
    const backups = backupItems(page);
    await expect(backups).toHaveCount(1);
    await expect(backups.first()).toContainText('2 November 2026');
    await expect(backups.first()).toContainText('1,532 records');
    await expect(button(page, 'Download the backup of 2 November 2026')).toBeVisible();
    await button(page, 'Restore the backup of 2 November 2026').click();
    const restore = dialogOf(page, 'Restore the backup of 2 November 2026?');
    await expect(restore).toBeVisible();
    await expect(
      restore.getByText(
        'Your data goes back to how it was that day, also on your other devices when they sync. Anything changed afterwards is lost. If in doubt, export a full backup first.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(button(restore, 'Cancel')).toBeFocused();
    await expect(button(restore, 'Restore')).toBeVisible();
    await button(restore, 'Cancel').click();
    await expect(restore).toBeHidden();

    const spanish = [
      'Sincronización',
      'Registro de intentos',
      'Copias del servidor',
      'Volver a Ajustes',
      'Correcto',
      'Enviados',
      'Recibidos',
      'registros',
      'Descargar',
      'Restaurar',
      'Actualizar',
      'noviembre',
      'Clave incorrecta',
    ];
    const text = await allUiText(page);
    expect(spanish.filter((w) => text.includes(w))).toEqual([]);

    // Forget the key.
    await page.getByRole('link', { name: 'Back to Settings', exact: true }).click();
    await expect(h1(page, 'Settings')).toBeVisible();
    await button(page, 'Forget key').click();
    const forget = dialogOf(page, 'Forget the key?');
    await expect(forget).toBeVisible();
    await expect(
      forget.getByText('This device will stop syncing. Your data stays on it.', { exact: true }),
    ).toBeVisible();
    await expect(button(forget, 'Cancel')).toBeFocused();
    await button(forget, 'Forget').click();
    await expect(toast(page, 'Key forgotten.')).toBeVisible();
    await expect(rowValue(page, 'Status')).toHaveText('Not set up');
    await expect(indicator(page)).toHaveAccessibleName('Sync: Not set up');
    const settingsText = await allUiText(page);
    expect(
      [
        'Sincronización',
        'Clave de sincronización',
        'Guardar clave',
        'Estado',
        'Pendientes',
        'Nunca',
      ].filter((w) => settingsText.includes(w)),
    ).toEqual([]);
  });
});
