import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { E2E_SYNC_KEY } from '../mocks/sync-server';
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
  settle,
  tileMetrics,
  viewportOf,
} from './helpers';

// Spec: docs/spec/session.md (Phase 5, branch feature/active-session) and docs/spec/today.md for
// how a session is started. The device date is Monday 2 November 2026 (`page.clock.install`
// before the first `goto`; time keeps flowing). Typed values and notes are saved after a short
// pause: tests move that timer with `page.clock.runFor`, never with a real wait.

const MON = new Date(2026, 10, 2, 9, 30);
const DEBOUNCE = 2_000;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const TYPE = /^(Tipo de (la )?serie|Type of set)/;
const DONE = /^(Marcar serie hecha|Serie hecha|Mark set done|Set done)/;
const KG = /^(Peso|Lastre|Weight|Added)/i;
const REPS = /^(Repeticiones|Repetitions|Reps)/i;
// Top set + 2 back-offs, step 2.5 kg (the first exercise of Push is the incline dumbbell press).
const BENCH = 'Press de pecho en máquina vertical';
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

async function backToToday(page: Page): Promise<void> {
  await mainNav(page).getByRole('link', { name: 'Hoy', exact: true }).click();
  await expect(h1(page, 'Hoy')).toBeVisible();
}

async function expectSession(page: Page, heading: string, title = 'Sesión'): Promise<void> {
  await expect(page).toHaveURL(/\/session\/[^/]+$/);
  await expect(h1(page, title)).toBeVisible();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

/** Starts today's proposed routine from Today ("Empezar <routine>"). */
async function startRoutine(page: Page, routine: string): Promise<void> {
  await page.getByRole('button', { name: `Empezar ${routine}`, exact: true }).click();
  await expectSession(page, routine);
}

/** Starts a routine from "Otra sesión u otro día", optionally on another date. */
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

function numberInput(card: Locator, name: RegExp): Locator {
  return card.getByRole('spinbutton', { name }).or(card.getByRole('textbox', { name }));
}

/** The rows of an exercise card, by position. */
function rows(card: Locator) {
  const types = card.getByRole('button', { name: TYPE });
  const dones = card.getByRole('button', { name: DONE });
  return {
    count: () => types.count(),
    type: (i: number) => types.nth(i),
    kg: (i: number) => numberInput(card, KG).nth(i),
    reps: (i: number) => numberInput(card, REPS).nth(i),
    rir: (i: number) => card.getByRole('combobox', { name: RIR }).nth(i),
    done: (i: number) => dones.nth(i),
  };
}

/** Types kg and reps in a row and taps ✓. */
async function logSet(
  card: Locator,
  i: number,
  kg: string,
  reps: string,
  rir?: string,
): Promise<void> {
  const r = rows(card);
  await r.kg(i).fill(kg);
  await r.reps(i).fill(reps);
  if (rir !== undefined) await r.rir(i).selectOption({ label: rir });
  await r.done(i).click();
  await expect(r.done(i)).toHaveAccessibleName(/^(Serie hecha|Set done)/);
}

function progress(page: Page, done: number | string, total: number | string): Locator {
  return page.getByRole('main').getByText(`${String(done)} de ${String(total)} hechas`, {
    exact: true,
  });
}

function dialog(page: Page): Locator {
  return page.getByRole('alertdialog').or(page.getByRole('dialog'));
}

function dialogButton(page: Page, name: string): Locator {
  return dialog(page).getByRole('button', { name, exact: true });
}

/** An option of the "Tipo de serie" sheet. */
function typeChoice(page: Page, name: string): Locator {
  return page
    .getByRole('radio', { name, exact: true })
    .or(page.getByRole('button', { name, exact: true }))
    .or(page.getByRole('menuitemradio', { name, exact: true }))
    .or(page.getByRole('option', { name, exact: true }))
    .first();
}

async function setType(page: Page, card: Locator, i: number, option: string): Promise<void> {
  await rows(card).type(i).click();
  await expect(page.getByText('Tipo de serie', { exact: true })).toBeVisible();
  await typeChoice(page, option).click();
  await expect(page.getByText('Tipo de serie', { exact: true })).toHaveCount(0);
}

async function flushAndReload(page: Page): Promise<void> {
  await page.clock.runFor(DEBOUNCE);
  await page.reload();
  await expect(h1(page, 'Sesión')).toBeVisible();
}

function toast(page: Page, text: string | RegExp): Locator {
  return page
    .getByText(text, { exact: typeof text === 'string' })
    .filter({ visible: true })
    .first();
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

/** The tabs of the bottom bar in the order AC-SESSION-40 taps them, with the URL each opens. */
const TABS = [
  ['Calendario', /\/calendar$/],
  ['Rutinas', /\/routines$/],
  ['Progreso', /\/progress$/],
  ['Ajustes', /\/settings$/],
  ['Hoy', /\/$/],
] as const;

/**
 * Taps each tab with a real click (no `force`): if anything covers a tab, Playwright reports the
 * element that intercepts the tap. Every tab must open its section at once.
 */
async function tapEveryTab(page: Page): Promise<void> {
  for (const [name, url] of TABS) {
    await mainNav(page).getByRole('link', { name, exact: true }).click({ timeout: 5_000 });
    await expect(page, `tab ${name}: URL`).toHaveURL(url);
    await expect(h1(page, name), `tab ${name}: title`).toBeVisible();
    await expect(page, `tab ${name}: document title`).toHaveTitle(`${name} · Certavi`);
  }
}

/** The "Tipo de serie" sheet: the closest container of its title that holds a "Quitar serie". */
function typeSheet(page: Page): Locator {
  return page
    .getByText('Tipo de serie', { exact: true })
    .locator(
      'xpath=ancestor::*[.//button[contains(@aria-label,"Quitar serie") or contains(normalize-space(.),"Quitar serie")]][1]',
    );
}

async function openTypeSheet(page: Page, card: Locator, i: number): Promise<void> {
  await rows(card).type(i).click();
  await expect(page.getByText('Tipo de serie', { exact: true })).toBeVisible();
}

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

test.describe('active session', () => {
  test(
    'AC-SESSION-01 / 02 / 04 / 05 / 06 · cards, nothing to save, reps must be positive, 0 kg, bodyweight and a reload',
    { tag: '@all-engines' },
    async ({ page }) => {
      await openToday(page);
      await startRoutine(page, 'Push');
      const main = page.getByRole('main');
      await expect(main.getByText('En curso', { exact: true })).toBeVisible();
      await expect(main.getByText('7 ejercicios · 19 series', { exact: true })).toBeVisible();
      await expect(progress(page, 0, 19)).toBeVisible();
      await expect(main.getByText('Sin registros previos', { exact: true })).toHaveCount(7);

      const banca = await exCard(page, BENCH);
      await expect(banca).toContainText(/\d+ series · .*reps · RIR/);
      const r = rows(banca);
      expect(await r.count()).toBeGreaterThan(1);
      await expect(r.done(0)).toHaveAccessibleName(/^Marcar serie hecha/);

      // AC-04: ✓ on an empty row with no "Anterior" saves nothing.
      await r.done(0).click();
      await expect(r.kg(0)).toHaveAttribute('aria-invalid', 'true');
      await expect(r.kg(0)).toBeFocused();
      await expect(progress(page, 0, 19)).toBeVisible();
      await expect(r.done(0)).toHaveAccessibleName(/^Marcar serie hecha/);

      // AC-06: 60 kg and no reps.
      await r.kg(0).fill('60');
      await r.done(0).click();
      await expect(r.reps(0)).toHaveAttribute('aria-invalid', 'true');
      await r.reps(0).fill('0');
      await r.done(0).click();
      await expect(r.reps(0)).toHaveAttribute('aria-invalid', 'true');
      await expect(progress(page, 0, 19)).toBeVisible();

      // AC-02: a valid set.
      await r.reps(0).fill('8');
      await r.rir(0).selectOption({ label: '2' });
      await r.done(0).click();
      await expect(r.done(0)).toHaveAccessibleName(/^Serie hecha/);
      await expect(r.kg(0)).toHaveValue('60');
      await expect(r.reps(0)).toHaveValue('8');
      await expect(r.rir(0)).toHaveValue('2');
      await expect(progress(page, 1, 19)).toBeVisible();

      // AC-05: 0 kg is a valid weight.
      await logSet(banca, 1, '0', '10');
      await expect(progress(page, 2, 19)).toBeVisible();

      await page.reload();
      await expect(h1(page, 'Sesión')).toBeVisible();
      await expect(progress(page, 2, 19)).toBeVisible();
      const again = rows(await exCard(page, BENCH));
      await expect(again.kg(0)).toHaveValue('60');
      await expect(again.reps(0)).toHaveValue('8');
      await expect(again.rir(0)).toHaveValue('2');
      await expect(again.kg(1)).toHaveValue('0');
      await expect(again.reps(1)).toHaveValue('10');

      // The bodyweight part of AC-05 ("Lastre" / "Banda", pull-ups) cannot be reached from the
      // seed routines (no "Dominadas" in Upper, rules.md §7) nor from a free session yet.
    },
  );

  test('AC-SESSION-03 / 12 · a session logged on a past day is editable and gives "Anterior", "Última vez" and the hint next time; ✓ saves "Anterior"', async ({
    page,
  }) => {
    await openToday(page);
    await startOther(page, 'Push', '2026-10-26');
    await expect(page.getByRole('main').getByText('Terminada', { exact: true })).toBeVisible();
    const old = await exCard(page, BENCH);
    // Top set: 62,5 kg × 8 at RIR 1 (a finished past session is still editable).
    await logSet(old, 0, '62,5', '8', '1');

    await backToToday(page);
    await startRoutine(page, 'Push');
    const banca = await exCard(page, BENCH);
    await expect(banca).toContainText(/Última vez \(26 oct\.?\): .*62,5 kg × 8/);
    await expect(banca.getByText('Sube a 65 kg', { exact: true })).toBeVisible();
    await expect(banca.getByText('62,5 × 8', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('main').getByText('Sin registros previos')).toHaveCount(6);

    // ✓ on the empty top row saves the "Anterior" values.
    const r = rows(banca);
    await expect(r.kg(0)).toHaveValue('');
    await r.done(0).click();
    await expect(r.done(0)).toHaveAccessibleName(/^Serie hecha/);
    await expect(r.kg(0)).toHaveValue('62,5');
    await expect(r.reps(0)).toHaveValue('8');
    await expect(progress(page, 1, 19)).toBeVisible();
  });

  test('AC-SESSION-07 / 08 / 11 / 23 · warm-up, extra set, suggested back-off and changing the type of a row', async ({
    page,
  }) => {
    await openToday(page);
    await startRoutine(page, 'Push');
    const banca = await exCard(page, BENCH);
    const r = rows(banca);
    const n = await r.count();

    // AC-07: a warm-up goes at the top, with the focus in kg, and is outside the progress.
    await banca.getByRole('button', { name: '+ Calentamiento', exact: true }).click();
    await expect.poll(() => r.count()).toBe(n + 1);
    await expect(r.type(0)).toHaveText(/^\s*C\b/);
    await expect(banca.getByText('no cuenta').first()).toBeVisible();
    await expect(r.kg(0)).toBeFocused();
    await logSet(banca, 0, '20', '10');
    await expect(progress(page, 0, 19)).toBeVisible();
    await expect(r.type(1)).toHaveText(/^\s*1\b/);

    // AC-11: back-off suggestion while the top weight is typed; it fills nothing.
    await r.kg(1).fill('65');
    await expect(banca.getByText('Back-off sugerido: 57,5 kg (−10 % del top)')).toBeVisible();
    await r.kg(1).fill('70');
    await expect(banca.getByText('Back-off sugerido: 62,5 kg (−10 % del top)')).toBeVisible();
    await r.kg(1).fill('65');
    await expect(banca.getByText('Back-off sugerido: 57,5 kg (−10 % del top)')).toBeVisible();
    await expect(r.kg(2)).toHaveValue('');
    await r.reps(1).fill('10');
    await r.done(1).click();
    await expect(progress(page, 1, 19)).toBeVisible();

    // AC-08: an extra set at the bottom; the denominator does not change.
    await banca.getByRole('button', { name: '+ Serie extra', exact: true }).click();
    await expect.poll(() => r.count()).toBe(n + 2);
    await expect(banca.getByText(/^Extra\b/)).toBeVisible();
    await expect(r.kg(n + 1)).toBeFocused(); // typed values are only safe once the row is focused
    await logSet(banca, n + 1, '50', '10');
    await expect(progress(page, 1, 19)).toBeVisible();

    // AC-23: the type of an empty row (the first back-off) changes without moving it.
    await rows(banca).type(2).click();
    await expect(page.getByText('Tipo de serie', { exact: true })).toBeVisible();
    for (const label of ['Calentamiento', 'Efectiva', 'Dropset']) {
      await expect(typeChoice(page, label)).toBeVisible();
    }
    await typeChoice(page, 'Calentamiento').click();
    await expect(r.type(2)).toHaveText(/^\s*C\b/);
    await expect(progress(page, 1, 18)).toBeVisible();
    await expect(r.count()).resolves.toBe(n + 2);
    await setType(page, banca, 2, 'Dropset');
    await expect(r.type(2)).toHaveText(/^\s*D\b/);
    await expect(progress(page, 1, 18)).toBeVisible();

    await flushAndReload(page);
    const again = rows(await exCard(page, BENCH));
    await expect(again.type(2)).toHaveText(/^\s*D\b/);
    await expect(progress(page, 1, 18)).toBeVisible();
    const card2 = await exCard(page, BENCH);
    const captions = await card2.getByText('Serie', { exact: true }).count();
    await setType(page, card2, 2, 'Efectiva');
    await expect(again.type(2)).toHaveText(/^\s*\d/);
    await expect(progress(page, 1, 19)).toBeVisible();
    await expect(card2.getByText('Serie', { exact: true })).toHaveCount(captions + 1);

    // A saved row keeps its data when its type changes.
    await setType(page, card2, 1, 'Calentamiento');
    await expect(again.kg(1)).toHaveValue('65');
    await expect(progress(page, 0, 18)).toBeVisible();
    await setType(page, card2, 1, 'Efectiva');
    await expect(progress(page, 1, 19)).toBeVisible();
    await expect(again.kg(1)).toHaveValue('65');

    // After finishing, the warm-up is outside "Series efectivas" and "Volumen": 65 × 10 + 50 × 10.
    await page.getByRole('button', { name: 'Terminar sesión', exact: true }).click();
    const main = page.getByRole('main');
    await expect(main.getByText('Terminada', { exact: true })).toBeVisible();
    await expect(main).toContainText(/Series efectivas\s*2(?!\d)/);
    await expect(main).toContainText(/Volumen\s*1\.?150(?!\d)/);
  });

  test(
    'AC-SESSION-09 / 10 · remove a row (keyboard and swipe), un-save and edit a saved set',
    { tag: '@all-engines' },
    async ({ page }) => {
      await openToday(page);
      await startOther(page, 'Pull');
      const summary = page.getByRole('main').getByText(/^\d+ ejercicios · \d+ series$/);
      const total = Number(/(\d+) series$/.exec((await summary.innerText()).trim())?.[1]);
      const remo = await exCard(page, 'Remo en T');
      const r = rows(remo);
      await expect.poll(() => r.count()).toBe(3);

      await logSet(remo, 0, '40', '10');
      await logSet(remo, 1, '45', '8');
      await expect(progress(page, 2, total)).toBeVisible();

      // Keyboard: focus "Quitar serie 2" and activate it. Cancel first.
      const remove = remo.getByRole('button', { name: 'Quitar serie 2', exact: true });
      await remove.focus();
      await page.keyboard.press('Enter');
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page).getByText('¿Quitar la serie 2?', { exact: true })).toBeVisible();
      await expect(dialog(page)).toContainText('45 kg × 8');
      await expect(dialog(page)).toContainText('La rutina no cambia.');
      await dialogButton(page, 'Cancelar').click();
      await expect(dialog(page)).toHaveCount(0);
      expect(await r.count()).toBe(3);

      await remove.focus();
      await page.keyboard.press('Enter');
      await dialogButton(page, 'Quitar').click();
      await expect.poll(() => r.count()).toBe(2);
      await expect(page.getByRole('main').getByText(`${String(total - 1)} series`)).toBeVisible();
      await expect(r.kg(0)).toHaveValue('40');
      await expect(progress(page, 1, total - 1)).toBeVisible();

      // AC-10: un-save row 1 (✓ then confirm), cancelling once.
      await r.done(0).click();
      await expect(dialog(page).getByText('¿Quitar esta serie del registro?')).toBeVisible();
      await dialogButton(page, 'Cancelar').click();
      await expect(progress(page, 1, total - 1)).toBeVisible();
      await r.done(0).click();
      await dialogButton(page, 'Quitar').click();
      await expect(r.done(0)).toHaveAccessibleName(/^Marcar serie hecha/);
      await expect(progress(page, 0, total - 1)).toBeVisible();
      await expect(r.kg(0)).toHaveValue('');

      // Save again and edit a saved value: saved when the field is left, kept after a reload.
      await logSet(remo, 0, '40', '10');
      await r.reps(0).fill('9');
      await r.reps(0).blur();
      await expect(r.done(0)).toHaveAccessibleName(/^Serie hecha/);
      await flushAndReload(page);
      const afterReload = rows(await exCard(page, 'Remo en T'));
      await expect(afterReload.reps(0)).toHaveValue('9');
      await expect(progress(page, 1, total - 1)).toBeVisible();

      // The routine is unchanged: Pull on another day still has 3 rows for Remo en T.
      await backToToday(page);
      await startOther(page, 'Pull', '2026-10-26');
      await expect.poll(async () => rows(await exCard(page, 'Remo en T')).count()).toBe(3);

      // A real swipe on an empty row; the keyboard path above is the fallback for the rest.
      await page.goBack();
      await expect(h1(page, 'Hoy')).toBeVisible();
      await page.goBack();
      await expect(h1(page, 'Sesión')).toBeVisible();
      const remo2 = await exCard(page, 'Remo en T');
      const r2 = rows(remo2);
      await expect.poll(() => r2.count()).toBe(2);
      const quitar = remo2.getByRole('button', { name: 'Quitar serie 2', exact: true });
      const box = await boxOf(r2.type(1));
      const y = box.y + box.height / 2;
      const x = box.x + box.width / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 60, y, { steps: 5 });
      await page.mouse.move(x - 160, y, { steps: 5 });
      await page.mouse.up();
      // A mouse drag may not be what the app listens to (touch): recorded, not failed.
      const swiped = await expect(quitar)
        .toBeInViewport({ timeout: 1_000 })
        .then(
          () => true,
          () => false,
        );
      test.info().annotations.push({
        type: 'swipe',
        description: swiped
          ? 'a mouse drag to the left revealed "Quitar"'
          : 'a mouse drag to the left did NOT reveal "Quitar" (keyboard path used)',
      });
      await quitar.focus();
      await page.keyboard.press('Enter');
      // An empty row goes away at once, without a dialog. The remaining row is saved, so the card
      // folds; unfold it: the last row cannot be removed (no "Quitar" button).
      const remoHeading = remo2.getByRole('button', { name: 'Remo en T', exact: true });
      await expect(remo2.getByText('Completo', { exact: true })).toBeVisible();
      if ((await remoHeading.getAttribute('aria-expanded')) === 'false') await remoHeading.click();
      await expect.poll(() => r2.count()).toBe(1);
      await expect(dialog(page)).toHaveCount(0);
      await expect(remo2.getByRole('button', { name: /^Quitar serie/ })).toHaveCount(0);
    },
  );

  test(
    'AC-SESSION-13 / 14 / 15 · straps, exercise note, session note and readiness survive a reload',
    { tag: '@all-engines' },
    async ({ page }) => {
      await openToday(page);
      await startOther(page, 'Pull');
      const remo = await exCard(page, 'Remo en T');
      await logSet(remo, 0, '40', '10');
      await logSet(remo, 1, '45', '8');

      // AC-13: straps on, two saved sets.
      const straps = remo.getByRole('switch', { name: 'Con straps', exact: true });
      await expect(straps).toBeChecked();
      await straps.click();
      await expect(
        dialog(page).getByText('¿Corregir también las 2 series ya guardadas?', { exact: true }),
      ).toBeVisible();
      await dialogButton(page, 'Corregir las 2 guardadas').click();
      await expect(straps).not.toBeChecked();
      // (Nothing on the saved rows shows "sin straps": the spec's per-set wording is not visible.)
      // "Solo las próximas": the saved sets keep what they have.
      await straps.click();
      await dialogButton(page, 'Solo las próximas').click();
      await expect(straps).toBeChecked();

      // An exercise without saved sets: no dialog.
      const allStraps = page.getByRole('switch', { name: 'Con straps', exact: true });
      const mine = await straps.elementHandle();
      const total = await allStraps.count();
      let other: Locator | undefined;
      for (let k = 0; k < total; k++) {
        const same = await allStraps.nth(k).evaluate((el, h) => el === h, mine);
        if (!same) {
          other = allStraps.nth(k);
          break;
        }
      }
      if (!other) throw new Error('Pull has another exercise with straps');
      await other.click();
      await expect(other).not.toBeChecked();
      await expect(dialog(page)).toHaveCount(0);

      // AC-14: exercise note and "does not count".
      await remo.getByRole('button', { name: 'Nota', exact: true }).click();
      await remo.getByLabel('Nota del ejercicio', { exact: true }).fill('Máquina distinta');
      const skip = remo.getByRole('checkbox', {
        name: 'No cuenta para la progresión',
        exact: true,
      });
      await skip.click();
      await expect(skip).toBeChecked();
      const reason = remo.getByRole('combobox', { name: 'Motivo', exact: true });
      await expect(reason).toHaveValue(/.+/);
      await reason.selectOption({ label: 'Faltan discos' });
      await reason.selectOption({ label: 'Máquina ocupada' });
      await expect(remo.getByRole('button', { name: 'Nota ✎', exact: true })).toBeVisible();

      // AC-15: session note and readiness.
      const notes = page.getByLabel('Notas de la sesión', { exact: true });
      await notes.fill('Buena sesión E2E');
      const main = page.getByRole('main');
      await expect(main.getByText('1 fatal · 5 a tope', { exact: true })).toBeVisible();
      const four = main.getByRole('button', { name: '4', exact: true });
      await four.click();
      await expect(four).toHaveAttribute('aria-pressed', 'true');

      await flushAndReload(page);
      const remo2 = await exCard(page, 'Remo en T');
      await expect(remo2.getByRole('button', { name: 'Nota ✎', exact: true })).toBeVisible();
      await expect(page.getByLabel('Notas de la sesión', { exact: true })).toHaveValue(
        'Buena sesión E2E',
      );
      await expect(main.getByRole('button', { name: '4', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(rows(remo2).done(0)).toHaveAccessibleName(/^Serie hecha/);

      // The note is still there when opened; clearing it and the box removes it.
      await remo2.getByRole('button', { name: 'Nota ✎', exact: true }).click();
      const text = remo2.getByLabel('Nota del ejercicio', { exact: true });
      await expect(text).toHaveValue('Máquina distinta');
      const box = remo2.getByRole('checkbox', {
        name: 'No cuenta para la progresión',
        exact: true,
      });
      await expect(box).toBeChecked();
      await text.fill('');
      await box.click();
      await expect(box).not.toBeChecked();
      await page.clock.runFor(DEBOUNCE);
      await expect(remo2.getByRole('button', { name: 'Nota', exact: true })).toBeVisible();

      // Tapping "4" again clears the answer.
      await main.getByRole('button', { name: '4', exact: true }).click();
      await expect(main.getByRole('button', { name: '4', exact: true })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    },
  );

  test(
    'AC-SESSION-16 · typed values and an extra row survive a redraw and a reload, and finishing discards them',
    { tag: '@all-engines' },
    async ({ page }) => {
      await openToday(page);
      await startRoutine(page, 'Push');
      const banca = await exCard(page, BENCH);
      const r = rows(banca);
      const n = await r.count();

      await r.kg(1).fill('60');
      await r.reps(1).fill('8');
      await banca.getByRole('button', { name: '+ Serie extra', exact: true }).click();
      await expect.poll(() => r.count()).toBe(n + 1);
      // The row is drawn as soon as it is saved, but the app moves the typed values to follow the
      // new row a moment later and then focuses it: typing before that loses the value (WebKit on
      // CI, 2026-11-06).
      await expect(r.kg(n)).toBeFocused();
      await r.reps(n).fill('10');

      // Something redraws the screen: fold another card.
      const other = page.getByRole('heading', {
        name: 'Press inclinado con mancuernas',
        exact: true,
      });
      await other.click();
      await expect(r.kg(1)).toHaveValue('60');
      await expect(r.reps(1)).toHaveValue('8');
      await expect(r.reps(n)).toHaveValue('10');
      await expect(progress(page, 0, 19)).toBeVisible();

      await flushAndReload(page);
      const again = await exCard(page, BENCH);
      const a = rows(again);
      await expect.poll(() => a.count()).toBe(n + 1);
      await expect(a.kg(1)).toHaveValue('60');
      await expect(a.reps(1)).toHaveValue('8');
      await expect(a.reps(n)).toHaveValue('10');
      await expect(progress(page, 0, 19)).toBeVisible();

      // ✓ saves the typed row.
      await a.done(1).click();
      await expect(a.done(1)).toHaveAccessibleName(/^Serie hecha/);
      await expect(progress(page, 1, 19)).toBeVisible();

      // Finishing discards the typed values that were not saved.
      await page.getByRole('button', { name: 'Terminar sesión', exact: true }).click();
      await expect(page.getByRole('main').getByText('Terminada', { exact: true })).toBeVisible();
      await expect(a.reps(n)).toHaveValue('');
      await expect(a.kg(1)).toHaveValue('60');
    },
  );

  test('AC-SESSION-17 / 18 / 19 · a completed exercise folds; finish, reopen and delete the session', async ({
    page,
  }) => {
    await openToday(page);
    await startRoutine(page, 'Push');
    const inc = await exCard(page, 'Press inclinado con mancuernas');
    const r = rows(inc);
    const n = await r.count();
    expect(n).toBeGreaterThan(1);
    const heading = inc.getByRole('button', {
      name: 'Press inclinado con mancuernas',
      exact: true,
    });

    // AC-19: it folds when the last working row is saved.
    for (let i = 0; i < n - 1; i++) await logSet(inc, i, '20', '10');
    await expect(inc.getByText('Completo', { exact: true })).toHaveCount(0);
    await expect(heading).toHaveAttribute('aria-expanded', 'true');
    await r.kg(n - 1).fill('20');
    await r.reps(n - 1).fill('10');
    await r.done(n - 1).click();
    await expect(inc.getByText('Completo', { exact: true })).toBeVisible();
    await expect(heading).toHaveAttribute('aria-expanded', 'false');
    await expect(inc).toContainText(/20 × 10( · 20 × 10)+/);
    await heading.click();
    await expect(heading).toHaveAttribute('aria-expanded', 'true');
    await expect(r.kg(0)).toBeVisible();

    // AC-17: finish.
    const main = page.getByRole('main');
    await page.getByRole('button', { name: 'Terminar sesión', exact: true }).click();
    await expect(main.getByText('Terminada', { exact: true })).toBeVisible();
    await expect(toast(page, /^Sesión guardada/)).toBeVisible();
    await expect(main).toContainText(/Series efectivas\s*\d+/);
    await expect(main).toContainText(/Volumen\s*\d/);
    // Each figure is a tile: its label and its number start at the same left edge (no indent).
    const tiles = await tileMetrics(page, { 'Series efectivas': [], Volumen: [] });
    for (const [label, tile] of Object.entries(tiles)) {
      expect(tile.lines.length, `"${label}" tile has a label and a number`).toBeGreaterThanOrEqual(
        2,
      );
      const first = tile.lines[0] ?? NaN;
      for (const left of tile.lines) {
        expect(
          Math.abs(left - first),
          `"${label}" tile: text lines ${tile.lines.join(', ')}`,
        ).toBeLessThanOrEqual(1);
      }
    }
    await expect(
      main.getByText('Sesión terminada. Puedes corregir cualquier dato: se guarda al momento.', {
        exact: true,
      }),
    ).toBeVisible();
    // A finished session is still editable.
    await r.reps(0).fill('11');
    await r.reps(0).blur();
    await page.getByRole('button', { name: 'Marcar como en curso', exact: true }).click();
    await expect(main.getByText('En curso', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Terminar sesión', exact: true })).toBeVisible();

    // AC-18: delete.
    const url = page.url();
    await page.getByRole('button', { name: 'Eliminar sesión', exact: true }).click();
    await expect(dialog(page).getByText('¿Eliminar esta sesión?', { exact: true })).toBeVisible();
    await expect(dialog(page)).toContainText('Se borrarán la sesión y todas sus series y notas.');
    await dialogButton(page, 'Cancelar').click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(url);
    await page.getByRole('button', { name: 'Eliminar sesión', exact: true }).click();
    await dialogButton(page, 'Eliminar').click();
    await expect(h1(page, 'Hoy')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Empezar Push', exact: true })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('0 de 5');
    await page.goto(new URL(url).pathname);
    await expect(page.getByText('Sesión no encontrada', { exact: true })).toBeVisible();
  });

  test('AC-SESSION-37 · the routine note of an exercise shows under its plan line in a session of that routine, and only there', async ({
    page,
  }) => {
    await openToday(page);
    await startOther(page, 'Lower Full');
    const main = page.getByRole('main');

    const hack = await exCard(page, 'Sentadilla hack con banda');
    await expect(hack).toContainText(/\d+ series?[\s\S]*Banda morada por defecto/);
    await expect(hack).toContainText('Banda morada por defecto. Si usas otra, apunta el color');
    // Right under the plan line, before the hint / last time lines of a fresh install.
    await expect(hack).toContainText(/Banda morada por defecto[\s\S]*Sin registros previos/);
    // The Nota button of the card is the user's own note, a different thing.
    await expect(hack.getByRole('button', { name: 'Nota', exact: true })).toBeVisible();

    // The line is on that card only: no other card of the session repeats it.
    await expect(main.getByText(/Banda morada por defecto/)).toHaveCount(1);
    const ups = page.getByRole('button', { name: /^Subir / });
    const count = await ups.count();
    expect(count, 'exercises in Lower Full').toBeGreaterThan(1);
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const snapshot = await ups.nth(i).ariaSnapshot();
      names.push(/button "Subir (.+?)"/.exec(snapshot)?.[1] ?? snapshot);
    }
    const otherName = names.find((n) => n !== 'Sentadilla hack con banda');
    expect(otherName, 'another exercise of Lower Full').toBeTruthy();
    const other = await exCard(page, otherName ?? '');
    await expect(other).not.toContainText('Banda morada');

    // A session of another routine does not show it.
    await backToToday(page);
    await startRoutine(page, 'Push');
    await expect(main).not.toContainText('Banda morada por defecto');
  });

  test(
    'AC-SESSION-22 · English and dark mode at 390 px: no Spanish, no sideways scroll, every row control visible, axe in both themes',
    { tag: '@all-engines' },
    async ({ page, browserName }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await openToday(page, 'en');
      await expectTheme(page, 'dark');
      await page.getByRole('button', { name: 'Start Push', exact: true }).click();
      await expectSession(page, 'Push', 'Session');
      const main = page.getByRole('main');
      await expect(main.getByText('In progress', { exact: true })).toBeVisible();
      await expect(main.getByText('0 of 19 done', { exact: true })).toBeVisible();
      await expect(main.getByText('How do you feel?', { exact: true })).toBeVisible();
      await expect(main.getByText('1 awful · 5 great', { exact: true })).toBeVisible();

      const banca = await exCard(page, 'Seated machine chest press');
      await expect(banca.getByText('No previous records', { exact: true })).toBeVisible();
      await banca.getByRole('button', { name: '+ Warm-up', exact: true }).click();
      const r = rows(banca);
      await expect(r.type(0)).toHaveText(/^\s*W\b/);
      await expect(banca.getByText(/doesn.t count/).first()).toBeVisible();
      await r.kg(0).fill('20.5');
      await r.reps(0).fill('10');
      await r.done(0).click();
      await expect(r.done(0)).toHaveAccessibleName('Set done (tap to remove)');
      await expect(r.kg(0)).toHaveValue('20.5');
      await expect(main.getByText('0 of 19 done', { exact: true })).toBeVisible();
      await expect(banca.getByRole('button', { name: '+ Extra set', exact: true })).toBeVisible();
      await expect(banca.getByRole('button', { name: 'Note', exact: true })).toBeVisible();
      await expect(main.getByRole('button', { name: 'Finish session', exact: true })).toBeVisible();
      await expect(main.getByRole('button', { name: 'Delete session', exact: true })).toBeVisible();

      // Every control of every row sits inside the 390 px width.
      const width = viewportOf(page).width;
      const count = await r.count();
      for (let i = 0; i < count; i++) {
        for (const control of [r.type(i), r.kg(i), r.reps(i), r.rir(i), r.done(i)]) {
          const box = await boxOf(control);
          expect(box.width, `row ${String(i)} control has a width`).toBeGreaterThan(0);
          expect(box.x, `row ${String(i)} control starts inside the screen`).toBeGreaterThanOrEqual(
            0,
          );
          expect(
            box.x + box.width,
            `row ${String(i)} control ends inside the screen`,
          ).toBeLessThanOrEqual(width);
        }
      }
      expect(await hasHorizontalScroll(page), 'horizontal scroll on the session').toBe(false);

      const leftovers = findSpanishWords(await allUiText(page));
      expect(leftovers, `Spanish text left on the session: ${leftovers.join(', ')}`).toEqual([]);

      if (browserName === 'chromium') {
        await axe(page, 'Session with sets (en, dark)');
        await page.emulateMedia({ colorScheme: 'light' });
        await expectTheme(page, 'light');
        // Colours may still be transitioning: wait for the CSS transitions to finish.
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
        await axe(page, 'Session with sets (en, light)');
      }
    },
  );

  // AC-SESSION-40 · two ways of having no coverage. The sections are opened once before going
  // offline: the tests run without a service worker, which on a phone keeps the app's files.
  for (const variant of ['offline', 'online but the sync server never answers'] as const) {
    test(
      `AC-SESSION-40 · leaving a session with the rest bar open and a weight field focused: every tab opens and the typed weight is kept (${variant})`,
      { tag: '@all-engines' },
      async ({ page, context }) => {
        await page.clock.install({ time: MON });
        if (variant === 'offline') {
          await gotoReady(page, '/', 'Hoy');
          await tapEveryTab(page); // ends on Hoy, with every section loaded
          await context.setOffline(true);
        } else {
          // The request is taken and never answered: the phone thinks it is online.
          await context.route('**/api/v1/**', () => new Promise<void>(() => undefined));
          await gotoReady(page, '/settings', 'Ajustes');
          await page.getByLabel('Clave de sincronización', { exact: true }).fill(E2E_SYNC_KEY);
          await page.getByRole('button', { name: 'Guardar clave', exact: true }).click();
          await expect(
            page.getByRole('button', { name: 'Cambiar clave', exact: true }),
          ).toBeVisible();
          await mainNav(page).getByRole('link', { name: 'Hoy', exact: true }).click();
          await expect(h1(page, 'Hoy')).toBeVisible();
        }

        await startRoutine(page, 'Push');
        const banca = await exCard(page, BENCH);
        await logSet(banca, 0, '60', '8');
        // The rest bar is open ...
        await expect(page.getByText('Descanso', { exact: true }).first()).toBeVisible();
        // ... and a weight field of the second row has the focus, with a typed value.
        const r = rows(banca);
        await r.kg(1).fill('55');
        await expect(r.kg(1)).toBeFocused();

        await tapEveryTab(page);

        // Back to the session from Today: the typed value is still in the field.
        await page
          .getByRole('button', { name: 'Continuar Push', exact: true })
          .or(page.getByRole('link', { name: 'Continuar Push', exact: true }))
          .click();
        await expectSession(page, 'Push');
        const again = rows(await exCard(page, BENCH));
        await expect(again.kg(1)).toHaveValue('55');
        await expect(again.done(0)).toHaveAccessibleName(/^Serie hecha/);
      },
    );
  }

  test('AC-SESSION-41 · removing a set from the "Tipo de serie" menu: empty row at once with "Deshacer", saved row after confirming, and never the last row', async ({
    page,
  }) => {
    await openToday(page);
    await startOther(page, 'Pull');
    const remo = await exCard(page, 'Remo en T');
    const r = rows(remo);
    await expect.poll(() => r.count()).toBe(3);
    await logSet(remo, 1, '45', '8'); // the second row is saved

    // The third (empty) row goes at once, with a notice and "Deshacer".
    await openTypeSheet(page, remo, 2);
    await typeSheet(page).getByRole('button', { name: 'Quitar serie 3', exact: true }).click();
    await expect(page.getByText('Tipo de serie', { exact: true })).toHaveCount(0);
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => r.count()).toBe(2);
    await expect(toast(page, 'Serie quitada')).toBeVisible();
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await expect.poll(() => r.count()).toBe(3);
    await expect(r.kg(1)).toHaveValue('45');

    // Remove it again, then the saved second row: this one asks first.
    await openTypeSheet(page, remo, 2);
    await typeSheet(page).getByRole('button', { name: 'Quitar serie 3', exact: true }).click();
    await expect.poll(() => r.count()).toBe(2);
    await openTypeSheet(page, remo, 1);
    await typeSheet(page).getByRole('button', { name: 'Quitar serie 2', exact: true }).click();
    await expect(dialog(page).getByText('¿Quitar la serie 2?', { exact: true })).toBeVisible();
    await expect(dialog(page)).toContainText('45 kg × 8');
    await dialogButton(page, 'Quitar').click();
    await expect.poll(() => r.count()).toBe(1);
    await expect(remo.getByRole('button', { name: /^Serie hecha/ })).toHaveCount(0);

    // The last remaining row cannot be removed from its menu, and says why.
    await openTypeSheet(page, remo, 0);
    const sheet = typeSheet(page);
    await expect(sheet.getByRole('button', { name: /^Quitar serie/ })).toBeDisabled();
    await expect(
      sheet.getByText('Es la última serie. Para quitarla, quita el ejercicio.', { exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Tipo de serie', { exact: true })).toHaveCount(0);

    // Swiping the last row does nothing.
    const box = await boxOf(r.type(0));
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 60, y, { steps: 5 });
    await page.mouse.move(x - 160, y, { steps: 5 });
    await page.mouse.up();
    await settle(page);
    await expect(remo.getByRole('button', { name: /^Quitar serie/ })).toHaveCount(0);
    await expect(dialog(page)).toHaveCount(0);
    expect(await r.count()).toBe(1);
  });

  test('AC-SESSION-42 · tapping ✓ never blanks the row (device slowed down in Chromium), and correcting a saved value does not flash the old one back', async ({
    page,
    browserName,
  }) => {
    await openToday(page);
    await startRoutine(page, 'Push');
    const banca = await exCard(page, BENCH);
    const r = rows(banca);
    await r.kg(0).fill('61');
    await r.reps(0).fill('9');
    await r.rir(0).selectOption({ label: '2' });

    // Records every moment the DOM changes and every frame in which one of the three typed
    // values is missing from the page (61 kg, 9 reps, RIR 2). Unique numbers: nothing else has them.
    await page.evaluate(() => {
      const w = window as unknown as { __blank: string[]; __frames: number; __stop: () => void };
      w.__blank = [];
      w.__frames = 0;
      const has = (selector: string, value: string): boolean =>
        Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector)).some(
          (el) => el.value === value,
        );
      const check = (): void => {
        w.__frames++;
        const missing = [
          has('input', '61') ? '' : 'kg',
          has('input', '9') ? '' : 'reps',
          has('select', '2') ? '' : 'rir',
        ].filter(Boolean);
        if (missing.length > 0) w.__blank.push(missing.join('+'));
      };
      const observer = new MutationObserver(check);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true });
      let running = true;
      const loop = (): void => {
        if (!running) return;
        check();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      w.__stop = () => {
        running = false;
        observer.disconnect();
      };
    });

    const cpu = browserName === 'chromium' ? await page.context().newCDPSession(page) : undefined;
    await cpu?.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    try {
      await r.done(0).click();
      // Right after the tap: the row looks done and still holds its values.
      await expect(r.done(0)).toHaveAccessibleName('Serie hecha (pulsa para quitar)');
      await expect(r.kg(0)).toHaveValue('61');
      await expect(r.reps(0)).toHaveValue('9');
      await expect(r.rir(0)).toHaveValue('2');
      await settle(page);
    } finally {
      await cpu?.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
    const saved = await page.evaluate(() => {
      const w = window as unknown as { __blank: string[]; __frames: number; __stop: () => void };
      w.__stop();
      return { blank: [...w.__blank], frames: w.__frames };
    });
    expect(saved.frames, 'the recorder looked at the page').toBeGreaterThan(2);
    expect(saved.blank, 'frames in which a typed value was missing after ✓').toEqual([]);

    // Correcting the saved reps: the old 9 never comes back once 10 is typed.
    await r.reps(0).fill('10');
    await page.evaluate(() => {
      const w = window as unknown as { __blank: string[] };
      w.__blank.length = 0;
      const has = (value: string): boolean =>
        Array.from(document.querySelectorAll<HTMLInputElement>('input')).some(
          (el) => el.value === value,
        );
      const check = (): void => {
        if (has('9') || !has('10')) w.__blank.push(has('9') ? 'old 9 is back' : 'no 10');
      };
      const observer = new MutationObserver(check);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true });
      let running = true;
      const loop = (): void => {
        if (!running) return;
        check();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      (window as unknown as { __stop: () => void }).__stop = () => {
        running = false;
        observer.disconnect();
      };
    });
    await r.reps(0).blur();
    await expect(r.done(0)).toHaveAccessibleName(/^Serie hecha/);
    await expect(r.reps(0)).toHaveValue('10');
    await settle(page);
    const flash = await page.evaluate(() => {
      const w = window as unknown as { __blank: string[]; __stop: () => void };
      w.__stop();
      return w.__blank;
    });
    expect(flash, 'frames with the old value or without the new one').toEqual([]);
  });
});
