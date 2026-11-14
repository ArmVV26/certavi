import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { createFakeSyncServer, E2E_SYNC_KEY, type FakeSyncServer } from '../mocks/sync-server';
import {
  allUiText,
  boxOf,
  expectTheme,
  findSpanishWords,
  gotoReady,
  h1,
  hasHorizontalScroll,
  mainNav,
  setLanguage,
  viewportOf,
} from './helpers';

// Spec: docs/spec/session.md §2.6-2.9 (AC-SESSION-24 to 36) and docs/spec/theme-language-navigation.md
// (AC-REST-01 / 02). The device date is Monday 2 November 2026 (`page.clock.install` before the
// first `goto`; time keeps flowing). App timers (debounces, the rest countdown, the sync wait) are
// moved with `page.clock.runFor`, never waited for.

const MON = new Date(2026, 10, 2, 9, 30);
const DEBOUNCE = 2_000;
/** One timeout for every wait on the app that involves local storage or the fake server. */
const WAIT = 10_000;

const BENCH = 'Press de pecho en máquina vertical';
const INCLINE = 'Press inclinado con mancuernas';

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const TYPE = /^(Tipo de (la )?serie|Type of set)/;
const DONE = /^(Marcar serie hecha|Serie hecha|Mark set done|Set done)/;
const KG = /^(Peso|Lastre|Weight|Added)/i;
const REPS = /^(Repeticiones|Repetitions|Reps)/i;
const RIR = /RIR/;

async function openToday(page: Page, lang: 'es' | 'en' = 'es'): Promise<void> {
  await page.clock.install({ time: MON });
  if (lang === 'en') {
    await setLanguage(page, 'en');
    await gotoReady(page, '/', 'Today');
  } else {
    await gotoReady(page, '/', 'Hoy');
  }
}

interface StoredRest {
  compound: number;
  isolation: number;
}

/** The rest times as they are in IndexedDB (null until the settings record exists). */
async function storedRest(page: Page): Promise<StoredRest | null> {
  return page.evaluate(
    () =>
      new Promise<StoredRest | null>((resolve, reject) => {
        const opening = indexedDB.open('certavi');
        opening.onerror = () => {
          reject(new Error(opening.error?.message ?? 'cannot open the database'));
        };
        opening.onsuccess = () => {
          const db = opening.result;
          const reading = db.transaction('settings').objectStore('settings').get('settings');
          reading.onsuccess = () => {
            db.close();
            const row = reading.result as { rest?: StoredRest } | undefined;
            resolve(row?.rest ?? null);
          };
          reading.onerror = () => {
            db.close();
            reject(new Error(reading.error?.message ?? 'cannot read the settings'));
          };
        };
      }),
  );
}

/** Waits (by state, not by time) until the database holds these rest times. */
async function expectStoredRest(page: Page, expected: StoredRest): Promise<void> {
  await expect
    .poll(() => storedRest(page), { message: 'rest times in IndexedDB', timeout: 20_000 })
    .toEqual(expected);
}

async function backToToday(page: Page): Promise<void> {
  await mainNav(page).getByRole('link', { name: 'Hoy', exact: true }).click();
  await expect(h1(page, 'Hoy')).toBeVisible();
}

async function expectSession(page: Page, heading: string, title = 'Sesión'): Promise<void> {
  await expect(page).toHaveURL(/\/session\/[^/]+$/);
  await expect(h1(page, title)).toBeVisible();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

async function startRoutine(page: Page, routine: string): Promise<void> {
  await page.getByRole('button', { name: `Empezar ${routine}`, exact: true }).click();
  await expectSession(page, routine);
}

/** Starts a routine (or "Sesión libre") from "Otra sesión u otro día", optionally on a date. */
async function startOther(page: Page, routine: string, date?: string): Promise<void> {
  if (date) await page.getByLabel('Fecha', { exact: true }).fill(date);
  const other = await exCard(page, 'Otra sesión u otro día');
  await other.getByRole('button', { name: routine, exact: true }).click();
  await expectSession(page, routine);
}

/** The card of an exercise: the outermost ancestor of its heading that holds no other heading. */
async function exCard(page: Page, name: string): Promise<Locator> {
  const heading = page.getByRole('heading', { name, exact: true });
  await expect(heading).toBeVisible();
  const tag = await heading.evaluate((el) => el.tagName.toLowerCase());
  const same = /^h[1-6]$/.test(tag) ? tag : '*[@role="heading"]';
  return heading.locator(`xpath=ancestor::*[count(.//${same}) = 1][last()]`);
}

/** Unfolds a card that folded by itself (all its working rows saved). */
async function ensureOpen(card: Locator, name: string): Promise<void> {
  const heading = card.getByRole('button', { name, exact: true });
  if ((await heading.getAttribute('aria-expanded')) === 'false') await heading.click();
  await expect(heading).toHaveAttribute('aria-expanded', 'true');
}

function numberInput(card: Locator, name: RegExp): Locator {
  return card.getByRole('spinbutton', { name }).or(card.getByRole('textbox', { name }));
}

function rows(card: Locator) {
  const types = card.getByRole('button', { name: TYPE });
  const dones = card.getByRole('button', { name: DONE });
  return {
    count: () => types.count(),
    kg: (i: number) => numberInput(card, KG).nth(i),
    reps: (i: number) => numberInput(card, REPS).nth(i),
    rir: (i: number) => card.getByRole('combobox', { name: RIR }).nth(i),
    done: (i: number) => dones.nth(i),
  };
}

async function logSet(card: Locator, i: number, kg: string, reps: string): Promise<void> {
  const r = rows(card);
  await r.kg(i).fill(kg);
  await r.reps(i).fill(reps);
  await r.done(i).click();
  // Saved: the ✓ says so, or the card folded because it was the last working row ("Completo").
  await expect
    .poll(
      async () => {
        if ((await card.getByText(/^(Completo|Done)$/).count()) > 0) return true;
        if ((await r.done(i).count()) === 0) return false;
        return /^(Serie hecha|Set done)/.test((await r.done(i).getAttribute('aria-label')) ?? '');
      },
      { timeout: WAIT },
    )
    .toBe(true);
}

function progress(page: Page, done: number | string, total: number | string): Locator {
  return page.getByRole('main').getByText(`${String(done)} de ${String(total)} hechas`, {
    exact: true,
  });
}

function summary(page: Page): Locator {
  return page.getByRole('main').getByText(/^\d+ ejercicios? · \d+ series$/);
}

async function summaryNumbers(page: Page): Promise<{ exercises: number; sets: number }> {
  const text = (await summary(page).innerText()).trim();
  const m = /^(\d+) ejercicios? · (\d+) series$/.exec(text);
  return { exercises: Number(m?.[1]), sets: Number(m?.[2]) };
}

function dialogOf(page: Page, name: string): Locator {
  return page
    .getByRole('dialog', { name, exact: true })
    .or(page.getByRole('alertdialog', { name, exact: true }));
}

function toast(page: Page, text: string): Locator {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first();
}

function button(scope: Page | Locator, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

/** The main action of Today when it opens an existing session: a button or a link. */
function sessionAction(scope: Page | Locator, name: string): Locator {
  return scope
    .getByRole('button', { name, exact: true })
    .or(scope.getByRole('link', { name, exact: true }));
}

/** Names of the exercise cards, top to bottom, read from their "Subir …" buttons. */
async function exerciseOrder(page: Page): Promise<string[]> {
  const ups = page.getByRole('button', { name: /^Subir / });
  const n = await ups.count();
  const names: string[] = [];
  for (let i = 0; i < n; i++) {
    const snap = await ups.nth(i).ariaSnapshot();
    const m = /button "Subir (.+?)"/.exec(snap);
    names.push(m?.[1] ?? snap);
  }
  return names;
}

async function openSheet(page: Page, opener: string, title: string): Promise<Locator> {
  await button(page, opener).click();
  const sheet = dialogOf(page, title);
  await expect(sheet).toBeVisible();
  return sheet;
}

/** Adds an exercise from the "Añadir ejercicio" sheet by searching its name. */
async function addExercise(page: Page, search: string, shown: string): Promise<void> {
  const sheet = await openSheet(page, '+ Añadir ejercicio', 'Añadir ejercicio');
  await sheet.getByLabel('Buscar ejercicio', { exact: true }).fill(search);
  await sheet.getByText(shown).first().click();
  await expect(sheet).toBeHidden();
}

/** Stops the page clock (installed before the first `goto`) a moment from now. */
async function pauseClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 500);
}

/**
 * Clicks "Deshacer" on the toast. The toast disappears after 6 s of page time and the clock runs
 * in real time, so in WebKit on CI the click (waiting for the toast animation to settle) took
 * longer than that and the toast was detached mid-click (AC-SESSION-27 / 28, 2026-11-06). The
 * clock is stopped only for the click, once the removal is already drawn: with it stopped the
 * live queries do not redraw in WebKit, so the app must not be left waiting on it.
 */
async function clickUndo(page: Page): Promise<void> {
  await pauseClock(page);
  await button(page, 'Deshacer').click();
  await page.clock.resume();
}

// --- Rest bar --------------------------------------------------------------------------------

function closeRest(page: Page): Locator {
  return page.getByRole('button', { name: /^(Cerrar descanso|Close rest)$/ });
}

/** The rest bar: the innermost element with the close button and the word "Descanso" / "Rest". */
function restBar(page: Page): Locator {
  return page
    .locator('div, section, aside, form')
    .filter({ has: closeRest(page) })
    .filter({ hasText: /Descanso|Rest/ })
    .last();
}

/** Seconds shown by the rest bar (m:ss), or -1 when there is no bar. */
async function restSecs(page: Page): Promise<number> {
  if ((await closeRest(page).count()) === 0) return -1;
  const text = await restBar(page).innerText();
  const m = /(\d+):(\d{2})/.exec(text);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -2;
}

async function expectSecs(page: Page, min: number, max: number): Promise<void> {
  await expect.poll(() => restSecs(page), { timeout: WAIT }).toBeGreaterThanOrEqual(min);
  await expect.poll(() => restSecs(page), { timeout: WAIT }).toBeLessThanOrEqual(max);
}

async function axe(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const detail = serious.map(
    (v) =>
      `${v.id} [${String(v.impact)}]: ${v.help}\n` +
      v.nodes
        .slice(0, 5)
        .map((n) => `   - ${n.target.join(' ')} :: ${n.failureSummary ?? ''}`)
        .join('\n'),
  );
  expect(serious, `${label}\n${detail.join('\n')}`).toEqual([]);
}

// --- Sync (two devices) ------------------------------------------------------------------------

const SYNC_PATH = '/api/v1/sync';

function indicator(page: Page): Locator {
  return page.getByRole('link', { name: /^(Sincronización|Sync): / });
}

async function saveKeyAndSync(page: Page, server: FakeSyncServer): Promise<void> {
  await gotoReady(page, '/settings', 'Ajustes');
  const before = server.requestCount(SYNC_PATH);
  const field = page.getByLabel('Clave de sincronización', { exact: true });
  await field.fill(E2E_SYNC_KEY);
  await expect(field).toHaveValue(E2E_SYNC_KEY);
  await button(page, 'Guardar clave').click();
  await expect
    .poll(() => server.requestCount(SYNC_PATH), { timeout: WAIT })
    .toBeGreaterThan(before);
  await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sincronizado', {
    timeout: WAIT,
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
  await page.clock.install({ time: MON });
  return { context, page };
}

/** What a user returning to the app does: the app syncs on focus / visible / online. */
async function returnToApp(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(5_000);
}

async function setRecords(server: FakeSyncServer): Promise<number> {
  return (await server.records()).filter((r) => r.type === 'set').length;
}

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

test.describe('session tools', () => {
  test('AC-SESSION-24 / 25 / 26 · add an exercise to a free session and to Push; the filters narrow the list', async ({
    page,
  }) => {
    await openToday(page);
    await startOther(page, 'Sesión libre');
    const main = page.getByRole('main');
    await expect(main.getByText('Sin ejercicios todavía.', { exact: true })).toBeVisible();

    // AC-25: search and chips.
    const sheet = await openSheet(page, '+ Añadir ejercicio', 'Añadir ejercicio');
    const search = sheet.getByLabel('Buscar ejercicio', { exact: true });
    const chip = (name: string) => button(sheet, name);
    const listed = async () => (await sheet.innerText()).includes('Remo en T');
    await expect(search).toBeVisible();
    for (const name of ['Básico', 'Aislamiento', 'Straps', 'Creados por mí', 'En alguna rutina']) {
      await expect(chip(name)).toHaveAttribute('aria-pressed', 'false');
    }
    await search.fill('REMO');
    await expect.poll(listed).toBe(true);
    await expect(sheet).not.toContainText(BENCH);
    // Accents are ignored: "maquina" finds "máquina".
    await search.fill('maquina');
    await expect(sheet).toContainText(BENCH);
    await search.fill('remo');
    await expect(sheet).not.toContainText(BENCH);

    await chip('Espalda').click();
    await expect(chip('Espalda')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(listed).toBe(true);
    await chip('Straps').click();
    await expect(chip('Straps')).toHaveAttribute('aria-pressed', 'true');
    await chip('Straps').click();
    await expect(chip('Straps')).toHaveAttribute('aria-pressed', 'false');
    // "Remo en T" is either basic or isolation, never both.
    await chip('Básico').click();
    await expect(chip('Básico')).toHaveAttribute('aria-pressed', 'true');
    const inBasic = await listed();
    await chip('Aislamiento').click();
    await expect(chip('Aislamiento')).toHaveAttribute('aria-pressed', 'true');
    const inIsolation = await listed();
    expect(inBasic !== inIsolation, 'Remo en T is in exactly one of Básico / Aislamiento').toBe(
      true,
    );
    await chip('Aislamiento').click();
    await expect(chip('Aislamiento')).toHaveAttribute('aria-pressed', 'false');
    // A fresh install has no exercise created by me.
    await chip('Creados por mí').click();
    await expect(sheet.getByText('Ningún ejercicio coincide', { exact: true })).toBeVisible();
    await chip('Creados por mí').click();
    await expect(chip('Creados por mí')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(listed).toBe(true);
    await chip('En alguna rutina').click();
    await expect(chip('En alguna rutina')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(listed).toBe(true);
    await chip('En alguna rutina').click();
    await chip('Espalda').click();
    await expect(chip('Espalda')).toHaveAttribute('aria-pressed', 'false');

    // AC-24: choosing it adds it at the end, closes the sheet.
    await search.fill('remo en t');
    await sheet.getByText('Remo en T').first().click();
    await expect(sheet).toBeHidden();
    const remo = await exCard(page, 'Remo en T');
    await expect(remo.getByText('Fuera de la rutina', { exact: true })).toHaveCount(0);
    // AC-SESSION-24: the singular form.
    await expect(summary(page)).toHaveText(/^1 ejercicio · \d+ series$/);
    await expect(main.getByText('Sin ejercicios todavía.', { exact: true })).toHaveCount(0);
    await logSet(remo, 0, '40', '10');

    // Already in the session: shown, not selectable.
    const again = await openSheet(page, '+ Añadir ejercicio', 'Añadir ejercicio');
    await again.getByLabel('Buscar ejercicio', { exact: true }).fill('remo en t');
    await expect(again.getByText('Ya está en la sesión', { exact: true })).toBeVisible();
    await expect(again.getByRole('button', { name: /^Remo en T/ }).first()).toBeDisabled();
    await expect(summary(page)).toHaveText(/^1 ejercicios? · \d+ series$/);
    await page.keyboard.press('Escape');
    await expect(again).toBeHidden();

    await page.reload();
    await expect(h1(page, 'Sesión')).toBeVisible();
    const afterReload = await exCard(page, 'Remo en T');
    await expect(rows(afterReload).kg(0)).toHaveValue('40');

    // AC-26: in a session of Push the added exercise is "Fuera de la rutina".
    await backToToday(page);
    await startRoutine(page, 'Push');
    await expect(summary(page)).toHaveText('7 ejercicios · 19 series');
    await addExercise(page, 'remo en t', 'Remo en T');
    const pushRemo = await exCard(page, 'Remo en T');
    await expect(pushRemo.getByText('Fuera de la rutina', { exact: true })).toBeVisible();
    await expect(summary(page)).toHaveText(/^8 ejercicios · \d+ series$/);
    const order = await exerciseOrder(page);
    expect(order.at(-1), 'the added exercise goes at the end').toBe('Remo en T');
    await page.reload();
    await expect(h1(page, 'Sesión')).toBeVisible();
    await expect(
      (await exCard(page, 'Remo en T')).getByText('Fuera de la rutina', { exact: true }),
    ).toBeVisible();

    // The routine itself did not change.
    await backToToday(page);
    await startOther(page, 'Push', '2026-10-26');
    await expect(summary(page)).toHaveText('7 ejercicios · 19 series');
  });

  test('AC-SESSION-27 / 28 · move exercises and remove one with its sets and note, then Deshacer', async ({
    page,
  }) => {
    await openToday(page);
    await startOther(page, 'Pull');
    const order = await exerciseOrder(page);
    expect(order.length).toBeGreaterThanOrEqual(3);
    const [a, b, c] = order as [string, string, string];

    // AC-27: first cannot go up, last cannot go down.
    await expect(button(page, `Subir ${a}`)).toBeDisabled();
    await expect(button(page, `Bajar ${order[order.length - 1] ?? ''}`)).toBeDisabled();
    await button(page, `Bajar ${a}`).click();
    await expect.poll(() => exerciseOrder(page)).toEqual([b, a, ...order.slice(2)]);
    await page.clock.runFor(DEBOUNCE);
    await page.reload();
    await expect(h1(page, 'Sesión')).toBeVisible();
    await expect.poll(() => exerciseOrder(page)).toEqual([b, a, ...order.slice(2)]);
    await button(page, `Subir ${c}`).click();
    const moved = [b, c, a, ...order.slice(3)];
    await expect.poll(() => exerciseOrder(page)).toEqual(moved);

    // AC-28: "Remo en T" with 2 saved sets and a note.
    const remo = await exCard(page, 'Remo en T');
    await logSet(remo, 0, '40', '10');
    await logSet(remo, 1, '45', '8');
    await button(remo, 'Nota').click();
    await remo.getByLabel('Nota del ejercicio', { exact: true }).fill('Nota E2E del remo');
    await page.clock.runFor(DEBOUNCE);
    await expect(button(remo, 'Nota ✎')).toBeVisible();
    const before = await summaryNumbers(page);
    const position = (await exerciseOrder(page)).indexOf('Remo en T');
    expect(position).toBeGreaterThanOrEqual(0);

    await button(remo, 'Quitar ejercicio').click();
    const confirm = dialogOf(page, '¿Quitar Remo en T de esta sesión?');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('Se borrarán sus 2 series y su nota. La rutina no cambia.');
    await button(confirm, 'Cancelar').click();
    await expect(confirm).toBeHidden();
    await expect(remo).toBeVisible();
    expect((await summaryNumbers(page)).exercises).toBe(before.exercises);

    await button(remo, 'Quitar ejercicio').click();
    await button(confirm, 'Quitar').click();
    await expect(toast(page, 'Ejercicio quitado')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Remo en T', exact: true })).toHaveCount(0);
    await expect
      .poll(async () => (await summaryNumbers(page)).exercises)
      .toBe(before.exercises - 1);
    expect((await summaryNumbers(page)).sets).toBeLessThan(before.sets);

    await clickUndo(page);
    await expect(toast(page, 'Ejercicio recuperado')).toBeVisible();
    for (const reload of [false, true]) {
      if (reload) {
        await page.clock.runFor(DEBOUNCE);
        await page.reload();
        await expect(h1(page, 'Sesión')).toBeVisible();
      }
      const back = await exCard(page, 'Remo en T');
      await expect.poll(() => exerciseOrder(page)).toHaveLength(order.length);
      expect((await exerciseOrder(page)).indexOf('Remo en T'), 'same place').toBe(position);
      await expect.poll(() => rows(back).count()).toBe(3);
      await expect(rows(back).done(0)).toHaveAccessibleName(/^Serie hecha/);
      await expect(rows(back).done(1)).toHaveAccessibleName(/^Serie hecha/);
      await expect(rows(back).kg(1)).toHaveValue('45');
      await expect(button(back, 'Nota ✎')).toBeVisible();
    }
    expect(await summaryNumbers(page)).toEqual(before);

    // An exercise with nothing saved goes without a dialog, also with Deshacer.
    const first = moved[1] ?? c;
    const firstCard = await exCard(page, first);
    await button(firstCard, 'Quitar ejercicio').click();
    await expect(toast(page, 'Ejercicio quitado')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: first, exact: true })).toHaveCount(0);
    await clickUndo(page);
    await expect(toast(page, 'Ejercicio recuperado')).toBeVisible();
    await expect(page.getByRole('heading', { name: first, exact: true })).toBeVisible();
  });

  test(
    'AC-SESSION-29 / 30 · change the routine (with confirmation) and edit date and hours',
    { tag: '@all-engines' },
    async ({ page }) => {
      await openToday(page);
      await startRoutine(page, 'Push');
      const inc = await exCard(page, INCLINE);
      await logSet(inc, 0, '20', '10');

      // AC-30: Push → Pull. In progress: no "Fin".
      let sheet = await openSheet(page, 'Datos de la sesión', 'Datos de la sesión');
      await expect(sheet.getByLabel('Fin', { exact: true })).toHaveCount(0);
      const chooseRoutine = async (name: string) => {
        const combo = sheet.getByRole('combobox', { name: 'Rutina', exact: true });
        if ((await combo.count()) > 0) await combo.selectOption({ label: name });
        else
          await sheet
            .getByRole('radio', { name, exact: true })
            .or(sheet.getByRole('button', { name, exact: true }))
            .first()
            .click();
      };
      await chooseRoutine('Pull');
      await button(sheet, 'Guardar').click();
      const confirm = dialogOf(page, '¿Cambiar la sesión a Pull?');
      await expect(confirm).toBeVisible();
      await expect(confirm).toContainText(
        'La lista de ejercicios pasará a ser la de esa rutina. Las series ya apuntadas se mantienen.',
      );
      await button(confirm, 'Cancelar').click();
      await expect(confirm).toBeHidden();
      // Cancelling changes nothing: still Push, with its exercises.
      if (await sheet.isVisible()) await button(sheet, 'Cancelar').click();
      await expect(sheet).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Push', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: BENCH, exact: true })).toBeVisible();

      sheet = await openSheet(page, 'Datos de la sesión', 'Datos de la sesión');
      await chooseRoutine('Pull');
      await button(sheet, 'Guardar').click();
      await button(confirm, 'Cambiar').click();
      await expect(page.getByRole('heading', { name: 'Pull', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Remo en T', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: BENCH, exact: true })).toHaveCount(0);
      const kept = await exCard(page, INCLINE);
      await expect(kept.getByText('Fuera de la rutina', { exact: true })).toBeVisible();
      await expect(rows(kept).kg(0)).toHaveValue('20');
      await expect(page.getByRole('main').getByText(/^1 de \d+ hechas$/)).toBeVisible();
      expect((await exerciseOrder(page)).at(-1), 'kept exercise goes to the end').toBe(INCLINE);

      // Pull → Sesión libre: only the exercise with saved sets stays, without the tag.
      sheet = await openSheet(page, 'Datos de la sesión', 'Datos de la sesión');
      await chooseRoutine('Sesión libre');
      await button(sheet, 'Guardar').click();
      await button(page, 'Cambiar').click();
      await expect(page.getByRole('heading', { name: 'Sesión libre', exact: true })).toBeVisible();
      const free = await exCard(page, INCLINE);
      await expect(free.getByText('Fuera de la rutina', { exact: true })).toHaveCount(0);
      await expect(rows(free).kg(0)).toHaveValue('20');
      await expect(page.getByRole('heading', { name: 'Remo en T', exact: true })).toHaveCount(0);
      await expect(summary(page)).toHaveText(/^1 ejercicios? · \d+ series$/);

      // AC-29: finish, then date and hours. First the two errors.
      await button(page, 'Terminar sesión').click();
      await expect(page.getByRole('main').getByText('Terminada', { exact: true })).toBeVisible();
      sheet = await openSheet(page, 'Datos de la sesión', 'Datos de la sesión');
      const start = sheet.getByLabel('Inicio', { exact: true });
      const end = sheet.getByLabel('Fin', { exact: true });
      await expect(end).toBeVisible();
      await start.fill('18:00');
      await end.fill('17:00');
      await button(sheet, 'Guardar').click();
      await expect(
        page.getByText('El fin no puede ser anterior al inicio', { exact: true }),
      ).toBeVisible();
      await expect(sheet).toBeVisible();
      await sheet.getByLabel('Fecha', { exact: true }).fill('2026-11-03');
      await end.fill('19:15');
      await button(sheet, 'Guardar').click();
      await expect(page.getByText('La fecha no puede ser futura', { exact: true })).toBeVisible();
      await expect(sheet).toBeVisible();

      await sheet.getByLabel('Fecha', { exact: true }).fill('2026-11-01');
      await start.fill('17:30');
      await end.fill('18:45');
      await button(sheet, 'Guardar').click();
      await expect(sheet).toBeHidden();
      const main = page.getByRole('main');
      await expect(main).toContainText('1 de noviembre');
      await expect(main).toContainText('17:30');
      await page.clock.runFor(DEBOUNCE);
      await page.reload();
      await expect(h1(page, 'Sesión')).toBeVisible();
      await expect(page.getByRole('main')).toContainText('1 de noviembre');
      await expect(page.getByRole('main')).toContainText('17:30');

      // Today no longer counts it as today's.
      await backToToday(page);
      await expect(page.getByRole('main')).not.toContainText('También hoy: Sesión libre');
    },
  );

  test(
    'AC-SESSION-32 / 33 / 34 · the rest timer starts after a new set, ±15 s, ends, closes and does not start when it should not',
    { tag: '@all-engines' },
    async ({ page }) => {
      await openToday(page);
      await startRoutine(page, 'Push');
      const banca = await exCard(page, BENCH);
      const r = rows(banca);
      await expect(closeRest(page)).toHaveCount(0);

      // AC-32: the top row of a basic exercise rests 180 s + 30 s.
      await logSet(banca, 0, '60', '8');
      await expect(closeRest(page)).toBeVisible();
      const bar = restBar(page);
      await expect(bar).toContainText(/Descanso/);
      await expect(bar).toContainText(/Siguiente: .+/);
      await expectSecs(page, 205, 210);
      // A warm-up restarts it at 1:00.
      const rowsBefore = await r.count();
      await button(banca, '+ Calentamiento').click();
      // The new row is drawn at the top: wait for it before typing, or row 0 is still the top set.
      await expect.poll(() => r.count()).toBe(rowsBefore + 1);
      await expect(
        banca.getByRole('button', { name: /^Tipo de (la )?serie .*calentamiento/i }),
      ).toBeVisible();
      await logSet(banca, 0, '20', '10');
      await expectSecs(page, 55, 60);

      // AC-33: from here on the clock is still, so the time is exact.
      await pauseClock(page);
      const t0 = await restSecs(page);
      expect(t0).toBeGreaterThan(50);
      await button(page, '+15 s').click();
      await expectSecs(page, t0 + 14, t0 + 16);
      await button(page, '−15 s').click();
      await button(page, '−15 s').click();
      await expectSecs(page, t0 - 16, t0 - 14);
      for (let i = 0; i < 5; i++) await button(page, '−15 s').click();
      await expectSecs(page, 14, 15); // never below 0:15 while counting

      await page.clock.runFor(16_000);
      await expect(restBar(page)).toContainText('¡A por la siguiente serie!');
      await button(page, '+15 s').click();
      await expect(restBar(page)).not.toContainText('¡A por la siguiente serie!');
      await expectSecs(page, 14, 15);
      await page.clock.runFor(16_000);
      await expect(restBar(page)).toContainText('¡A por la siguiente serie!');
      await page.clock.runFor(31_000);
      await expect(closeRest(page)).toHaveCount(0);
      await page.clock.resume();

      // The close button closes it at any moment.
      await logSet(banca, 2, '55', '8');
      await expect(closeRest(page)).toBeVisible();
      await expectSecs(page, 150, 180); // back-off of a basic exercise: 3:00
      await closeRest(page).click();
      await expect(closeRest(page)).toHaveCount(0);

      // AC-34: correcting a saved set does not start it.
      await r.reps(2).fill('9');
      await r.reps(2).blur();
      await expect(r.done(2)).toHaveAccessibleName(/^Serie hecha/);
      await page.clock.runFor(500);
      await expect(closeRest(page)).toHaveCount(0);

      // Finishing closes it.
      // The last working row folds the card, so the ✓ is checked through "Completo" and the bar.
      await r.kg(3).fill('55');
      await r.reps(3).fill('8');
      await r.done(3).click();
      await expect(banca.getByText('Completo', { exact: true })).toBeVisible();
      await expect(closeRest(page)).toBeVisible();
      await button(page, 'Terminar sesión').click();
      await expect(page.getByRole('main').getByText('Terminada', { exact: true })).toBeVisible();
      await expect(closeRest(page)).toHaveCount(0);

      // A set saved in a finished session does not start it.
      await ensureOpen(banca, BENCH);
      await button(banca, '+ Serie extra').click();
      await expect.poll(() => r.count()).toBe(5);
      await expect(r.kg(4)).toBeFocused(); // typed values are only safe once the row is focused
      await logSet(banca, 4, '50', '10');
      await page.clock.runFor(500);
      await expect(closeRest(page)).toHaveCount(0);

      // Back in progress it starts again, and a reload drops it.
      await button(page, 'Marcar como en curso').click();
      await expect(page.getByRole('main').getByText('En curso', { exact: true })).toBeVisible();
      await ensureOpen(banca, BENCH);
      await button(banca, '+ Serie extra').click();
      await expect.poll(() => r.count()).toBe(6);
      await expect(r.kg(5)).toBeFocused();
      await logSet(banca, 5, '50', '10');
      await expect(closeRest(page)).toBeVisible();
      await page.reload();
      await expect(h1(page, 'Sesión')).toBeVisible();
      await expect(page.getByRole('heading', { name: BENCH, exact: true })).toBeVisible();
      await expect(closeRest(page)).toHaveCount(0);
    },
  );

  test(
    'AC-REST-01 / 02 · rest times and sound / vibration are kept after a reload, and the new time is used',
    { tag: '@all-engines' },
    async ({ page }) => {
      await page.clock.install({ time: MON });
      await gotoReady(page, '/settings', 'Ajustes');
      const basic = () =>
        page
          .getByRole('spinbutton', { name: 'Descanso en ejercicios básicos (s)', exact: true })
          .or(
            page.getByRole('textbox', { name: 'Descanso en ejercicios básicos (s)', exact: true }),
          );
      const iso = () =>
        page
          .getByRole('spinbutton', { name: 'Descanso en aislamiento (s)', exact: true })
          .or(page.getByRole('textbox', { name: 'Descanso en aislamiento (s)', exact: true }));
      const sw = (name: string) =>
        page
          .getByRole('switch', { name, exact: true })
          .or(page.getByRole('checkbox', { name, exact: true }));
      await expect(page.getByRole('heading', { name: 'Descanso', exact: true })).toBeVisible();
      await expect(basic()).toHaveValue('180');
      await expect(iso()).toHaveValue('120');
      await expect(sw('Sonido al acabar el descanso')).toBeChecked();
      await expect(sw('Vibración')).not.toBeChecked();
      await expect(page.getByText('No funciona en iPhone.', { exact: true })).toBeVisible();

      await basic().fill('200');
      await basic().blur();
      await iso().fill('90');
      await iso().blur();
      await sw('Sonido al acabar el descanso').click();
      await sw('Vibración').click();
      await expect(sw('Sonido al acabar el descanso')).not.toBeChecked();
      await expect(sw('Vibración')).toBeChecked();
      // The times are written to the database when a field is left, and nothing on screen says
      // when that is done: wait for the stored value before reloading (a reload aborts a write
      // in flight, and WebKit is slower than Chromium while the built-in data is being created).
      await expectStoredRest(page, { compound: 200, isolation: 90 });
      await page.reload();
      await expect(h1(page, 'Ajustes')).toBeVisible();
      await expect(basic()).toHaveValue('200');
      await expect(iso()).toHaveValue('90');
      await expect(sw('Sonido al acabar el descanso')).not.toBeChecked();
      await expect(sw('Vibración')).toBeChecked();

      // Out of range (below 15, above 900): the spec allows the field to show the closest allowed
      // value, so after a reload the value is the previous one or 15 / 900, never the typed one.
      for (const [bad, closest] of [
        ['10', '15'],
        ['901', '900'],
      ] as const) {
        await basic().fill(bad);
        await basic().blur();
        await expectStoredRest(page, { compound: Number(closest), isolation: 90 });
        await page.reload();
        await expect(h1(page, 'Ajustes')).toBeVisible();
        await expect(basic(), `${bad} s is not accepted`).toHaveValue(
          new RegExp(`^(200|${closest})$`),
        );
        test.info().annotations.push({
          type: 'out of range',
          description: `${bad} -> ${await basic().inputValue()}`,
        });
        await basic().fill('200');
        await basic().blur();
        await expectStoredRest(page, { compound: 200, isolation: 90 });
      }
      await page.reload();
      await expect(h1(page, 'Ajustes')).toBeVisible();
      await expect(basic()).toHaveValue('200');

      // The new basic rest is used: top row = 200 + 30 s.
      await backToToday(page);
      await startRoutine(page, 'Push');
      const banca = await exCard(page, BENCH);
      await logSet(banca, 0, '60', '8');
      await expect(closeRest(page)).toBeVisible();
      await expectSecs(page, 225, 230);
    },
  );

  test('AC-SESSION-35 · a set saved on another device shows with the notice; unsaved typing is kept; Cerrar and a new change bring it back', async ({
    page,
    context,
    browser,
  }, testInfo) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await page.clock.install({ time: MON });
    await saveKeyAndSync(page, server);
    await backToToday(page);
    await startRoutine(page, 'Push');
    await page.clock.runFor(3_000); // past the wait after a change
    await expect
      .poll(async () => (await server.records()).some((x) => x.type === 'session'), {
        timeout: WAIT,
      })
      .toBe(true);

    const b = await newDevice(browser, testInfo, server);
    try {
      await saveKeyAndSync(b.page, server);
      await backToToday(b.page);
      const resume = b.page
        .getByRole('button', { name: /^Continuar/ })
        .or(b.page.getByRole('link', { name: /^Continuar/ }));
      await expect(resume.first()).toBeVisible({ timeout: WAIT });
      await resume.first().click();
      await expect(b.page).toHaveURL(/\/session\/[^/]+$/);

      // Device A types a value and does not save it.
      const banca = await exCard(page, BENCH);
      await rows(banca).kg(0).fill('77');
      const banner = page.getByText('Hay cambios de otro dispositivo en esta sesión.', {
        exact: true,
      });
      await expect(banner).toHaveCount(0);

      // Device B saves a set and syncs.
      const incB = await exCard(b.page, INCLINE);
      await logSet(incB, 0, '50', '10');
      let sets = await setRecords(server);
      await b.page.clock.runFor(3_000);
      await expect.poll(() => setRecords(server), { timeout: WAIT }).toBeGreaterThan(sets - 1);
      await expect.poll(() => setRecords(server), { timeout: WAIT }).toBeGreaterThan(0);

      // Device A gets it: the set and the notice; the typed value is untouched.
      await expect
        .poll(
          async () => {
            await returnToApp(page);
            return banner.count();
          },
          { timeout: 30_000, intervals: [250] },
        )
        .toBe(1);
      const incA = await exCard(page, INCLINE);
      await expect(rows(incA).kg(0)).toHaveValue('50', { timeout: WAIT });
      await expect(rows(incA).done(0)).toHaveAccessibleName(/^Serie hecha/);
      await expect(rows(banca).kg(0)).toHaveValue('77');
      await expect(progress(page, 1, 19)).toBeVisible();

      // "Cerrar" closes it; another change from B shows it again.
      await button(page, 'Cerrar').click();
      await expect(banner).toHaveCount(0);
      await logSet(incB, 1, '52,5', '8');
      sets = await setRecords(server);
      await b.page.clock.runFor(3_000);
      await expect.poll(() => setRecords(server), { timeout: WAIT }).toBeGreaterThanOrEqual(2);
      await expect
        .poll(
          async () => {
            await returnToApp(page);
            return banner.count();
          },
          { timeout: 30_000, intervals: [250] },
        )
        .toBe(1);
      await expect(rows(incA).kg(1)).toHaveValue('52,5', { timeout: WAIT });
      await expect(rows(banca).kg(0)).toHaveValue('77');
      await button(page, 'Cerrar').click();
      await expect(banner).toHaveCount(0);

      // This device's own change coming back from the server does not show it.
      const before = server.requestCount(SYNC_PATH);
      const own = await setRecords(server);
      await logSet(banca, 0, '77', '8');
      await page.clock.runFor(3_000);
      await expect.poll(() => setRecords(server), { timeout: WAIT }).toBeGreaterThan(own);
      expect(server.requestCount(SYNC_PATH)).toBeGreaterThan(before);
      await returnToApp(page);
      await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sincronizado', {
        timeout: WAIT,
      });
      await returnToApp(page);
      await expect(banner).toHaveCount(0);
    } finally {
      await b.context.close();
    }
  });

  test('AC-SESSION-34b · the rest bar closes by itself when the other device finishes the session, and it does not come back', async ({
    page,
    context,
    browser,
  }, testInfo) => {
    const server = createFakeSyncServer();
    await server.attach(context);
    await page.clock.install({ time: MON });

    // A long rest (900 s + 30 s for a top row) so the bar cannot end on its own while the test
    // moves the page clock to make the sync run.
    await gotoReady(page, '/settings', 'Ajustes');
    const basic = page
      .getByRole('spinbutton', { name: 'Descanso en ejercicios básicos (s)', exact: true })
      .or(page.getByRole('textbox', { name: 'Descanso en ejercicios básicos (s)', exact: true }));
    await basic.fill('900');
    await basic.blur();
    await expectStoredRest(page, { compound: 900, isolation: 120 });

    await saveKeyAndSync(page, server);
    await backToToday(page);
    await startRoutine(page, 'Push');
    await page.clock.runFor(3_000);
    await expect
      .poll(async () => (await server.records()).some((x) => x.type === 'session'), {
        timeout: WAIT,
      })
      .toBe(true);

    const b = await newDevice(browser, testInfo, server);
    try {
      await saveKeyAndSync(b.page, server);
      await backToToday(b.page);
      const resume = b.page
        .getByRole('button', { name: /^Continuar/ })
        .or(b.page.getByRole('link', { name: /^Continuar/ }));
      await expect(resume.first()).toBeVisible({ timeout: WAIT });
      await resume.first().click();
      await expect(b.page).toHaveURL(/\/session\/[^/]+$/);

      // Device A saves a set: the rest bar opens.
      const banca = await exCard(page, BENCH);
      await logSet(banca, 0, '60', '8');
      await expect(closeRest(page)).toBeVisible();
      await expectSecs(page, 850, 935);

      // Device B finishes the session and syncs.
      const before = server.requestCount(SYNC_PATH);
      await button(b.page, 'Terminar sesión').click();
      await expect(b.page.getByRole('main').getByText('Terminada', { exact: true })).toBeVisible();
      await b.page.clock.runFor(3_000);
      await expect
        .poll(() => server.requestCount(SYNC_PATH), { timeout: WAIT })
        .toBeGreaterThan(before);

      // Device A: the session shows as finished and the bar is gone, without any tap.
      await expect
        .poll(
          async () => {
            await returnToApp(page);
            return closeRest(page).count();
          },
          { timeout: 30_000, intervals: [250] },
        )
        .toBe(0);
      await expect(page.getByRole('main').getByText('Terminada', { exact: true })).toBeVisible({
        timeout: WAIT,
      });

      // A set saved now, on a finished session, does not bring the bar back.
      const inc = await exCard(page, INCLINE);
      await ensureOpen(inc, INCLINE);
      await logSet(inc, 0, '40', '10');
      await page.clock.runFor(500);
      await expect(closeRest(page)).toHaveCount(0);
    } finally {
      await b.context.close();
    }
  });

  test('§2.8 · "Guardar" in the session details: an error leaves it usable; tapping it twice saves once and closes', async ({
    page,
  }) => {
    await openToday(page);
    await startRoutine(page, 'Push');
    let sheet = await openSheet(page, 'Datos de la sesión', 'Datos de la sesión');
    const save = button(sheet, 'Guardar');
    await expect(save).toBeEnabled();

    // An error does not leave it stuck in "saving": still open, "Guardar" enabled again.
    await sheet.getByLabel('Fecha', { exact: true }).fill('2026-11-03');
    await save.click();
    await expect(page.getByText('La fecha no puede ser futura', { exact: true })).toBeVisible();
    await expect(sheet).toBeVisible();
    await expect(save).toBeEnabled();

    // Two taps in the same instant (two clicks in one task, before the screen can redraw).
    await sheet.getByLabel('Fecha', { exact: true }).fill('2026-11-02');
    await sheet.getByLabel('Inicio', { exact: true }).fill('08:15');
    await save.evaluate((el) => {
      (el as HTMLElement).click();
      (el as HTMLElement).click();
    });
    await expect(sheet).toBeHidden();
    await expect(page.getByText('La fecha no puede ser futura', { exact: true })).toHaveCount(0);
    const main = page.getByRole('main');
    await expect(main).toContainText(/0?8:15/);

    // Saved once: one session, still Push, and it survives a reload.
    await page.clock.runFor(DEBOUNCE);
    await page.reload();
    await expect(h1(page, 'Sesión')).toBeVisible();
    await expect(page.getByRole('main')).toContainText(/0?8:15/);
    await expect(page.getByRole('heading', { name: 'Push', exact: true })).toBeVisible();
    await backToToday(page);
    await expect(sessionAction(page, 'Continuar Push')).toBeVisible();
    await expect(page.getByText('También hoy', { exact: false })).toHaveCount(0);

    // And the sheet can be opened and saved again afterwards.
    await sessionAction(page, 'Continuar Push').click();
    await expect(h1(page, 'Sesión')).toBeVisible();
    sheet = await openSheet(page, 'Datos de la sesión', 'Datos de la sesión');
    await expect(sheet.getByLabel('Inicio', { exact: true })).toHaveValue('08:15');
    await expect(button(sheet, 'Guardar')).toBeEnabled();
    await button(sheet, 'Cancelar').click();
    await expect(sheet).toBeHidden();
  });

  test(
    'AC-SESSION-31 · Descargar JSON gives certavi-session-<date>-<id>.json with saved data only, also offline',
    { tag: '@all-engines' },
    async ({ page, context }, testInfo) => {
      await openToday(page);
      await startRoutine(page, 'Push');
      const inc = await exCard(page, INCLINE);
      await logSet(inc, 0, '40', '10');
      await logSet(inc, 1, '45', '8');
      await button(inc, 'Nota').click();
      await inc.getByLabel('Nota del ejercicio', { exact: true }).fill('Nota E2E descarga');
      const banca = await exCard(page, BENCH);
      await rows(banca).kg(0).fill('73.25'); // typed, never saved
      await page.clock.runFor(DEBOUNCE);
      await expect(button(inc, 'Nota ✎')).toBeVisible();

      const download = async (tag: string) => {
        const pending = page.waitForEvent('download');
        await button(page, 'Descargar JSON').click();
        const dl = await pending;
        const file = testInfo.outputPath(`${tag}-${dl.suggestedFilename()}`);
        await dl.saveAs(file);
        return { name: dl.suggestedFilename(), text: readFileSync(file, 'utf8') };
      };
      const first = await download('online');
      expect(first.name).toMatch(/^certavi-session-2026-11-02-.+\.json$/);
      const id = /^certavi-session-2026-11-02-(.+)\.json$/.exec(first.name)?.[1] ?? '';
      expect(id.length).toBeGreaterThan(3);
      expect(() => JSON.parse(first.text) as unknown).not.toThrow();
      expect(first.text).toContain(id);
      expect(first.text).toContain('Nota E2E descarga');
      expect(first.text).not.toContain('73.25');
      expect(new Set(first.text.match(/set_[0-9a-z]+/g) ?? []).size).toBe(2);

      await context.setOffline(true);
      const offline = await download('offline');
      expect(offline.name).toBe(first.name);
      expect(offline.text).toContain('Nota E2E descarga');
      await context.setOffline(false);
    },
  );

  test(
    'AC-SESSION-36 · English, dark and 390 px: sheets, rest bar and notifications are translated, fit the screen and have no serious axe issues',
    { tag: '@all-engines' },
    async ({ page, browserName }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await openToday(page, 'en');
      await expectTheme(page, 'dark');
      await page.getByRole('button', { name: 'Start Push', exact: true }).click();
      await expectSession(page, 'Push', 'Session');
      const main = page.getByRole('main');
      const width = viewportOf(page).width;
      const spanish = [
        'Descanso',
        'Siguiente',
        'Cerrar descanso',
        'Datos de la sesión',
        'Inicio',
        'Fecha',
        'Rutina',
        'Guardar',
        'Buscar ejercicio',
        'Ya está en la sesión',
        'Fuera de la rutina',
        'Deshacer',
        'Ejercicio quitado',
        'recuperado',
      ];
      const noSpanish = async (label: string) => {
        const text = await allUiText(page);
        const found = [
          ...findSpanishWords(text),
          ...spanish.filter((w) => new RegExp(`(?<!\\p{L})${w}(?!\\p{L})`, 'u').test(text)),
        ];
        expect(found, `Spanish text left (${label}): ${found.join(', ')}`).toEqual([]);
      };
      const fits = async (sheet: Locator, label: string) => {
        // The sheet slides in: measure it once the CSS transitions are over.
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
        const box = await boxOf(sheet);
        expect(box.x, `${label} starts inside`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${label} ends inside`).toBeLessThanOrEqual(width + 1);
        expect(box.y + box.height, `${label} bottom inside`).toBeLessThanOrEqual(
          viewportOf(page).height + 1,
        );
      };

      // Add-exercise sheet.
      const add = await openSheet(page, '+ Add exercise', 'Add exercise');
      await expect(add.getByLabel('Search exercise', { exact: true })).toBeVisible();
      for (const name of ['Basic', 'Isolation', 'Straps', 'Created by me', 'In a routine']) {
        await expect(button(add, name)).toBeVisible();
      }
      await add.getByLabel('Search exercise', { exact: true }).fill('chest press');
      await expect(add.getByText('Already in the session', { exact: true }).first()).toBeVisible();
      await button(add, 'Created by me').click();
      await expect(add.getByText('No exercise matches', { exact: true })).toBeVisible();
      await noSpanish('add sheet');
      await fits(add, 'add sheet');
      expect(await hasHorizontalScroll(page), 'horizontal scroll with the add sheet').toBe(false);
      if (browserName === 'chromium') await axe(page, 'Add exercise sheet (en, dark)');
      await page.keyboard.press('Escape');
      await expect(add).toBeHidden();

      // Notifications: remove an exercise with nothing saved, undo.
      const banca = await exCard(page, 'Seated machine chest press');
      await button(banca, 'Remove exercise').click();
      await expect(toast(page, 'Exercise removed')).toBeVisible();
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await button(page, 'Undo').click();
      await expect(toast(page, 'Exercise restored')).toBeVisible();

      // Rest bar.
      const card = await exCard(page, 'Seated machine chest press');
      await logSet(card, 0, '60', '8');
      await expect(closeRest(page)).toBeVisible();
      const bar = restBar(page);
      await expect(bar).toContainText('Rest');
      await expect(bar).toContainText(/Next: .+/);
      await expect(button(page, '−15 s')).toBeVisible();
      await expect(button(page, '+15 s')).toBeVisible();
      await expect(closeRest(page)).toHaveAccessibleName('Close rest');
      await noSpanish('rest bar');
      expect(await hasHorizontalScroll(page), 'horizontal scroll with the rest bar').toBe(false);
      // The bar does not hide the last actions: the page scrolls until they show above it.
      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      const del = button(main, 'Delete session');
      await expect(del).toBeVisible();
      const barBox = await boxOf(bar);
      const delBox = await boxOf(del);
      expect(
        delBox.y + delBox.height,
        'Delete session ends above the rest bar',
      ).toBeLessThanOrEqual(barBox.y + 1);

      // Session details sheet.
      const details = await openSheet(page, 'Session details', 'Session details');
      for (const label of ['Date', 'Start', 'Routine']) {
        await expect(details.getByLabel(label, { exact: true })).toBeVisible();
      }
      await expect(button(details, 'Save')).toBeInViewport();
      await expect(button(details, 'Cancel')).toBeInViewport();
      await fits(details, 'details sheet');
      await noSpanish('details sheet');
      if (browserName === 'chromium') {
        await axe(page, 'Session details sheet (en, dark)');
        await button(details, 'Cancel').click();
        await expect(details).toBeHidden();
        await page.emulateMedia({ colorScheme: 'light' });
        await expectTheme(page, 'light');
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
        await axe(page, 'Session with rest bar (en, light)');
      }
    },
  );
});
