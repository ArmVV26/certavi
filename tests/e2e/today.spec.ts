import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { createFakeSyncServer, E2E_SYNC_KEY } from '../mocks/sync-server';
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
} from './helpers';

// Spec: docs/spec/today.md (Phase 5, branch feature/today — Today screen and the minimal session
// screen). The device date is fixed with `page.clock.setFixedTime` before the first `goto`: it
// only fakes `Date`, the app's timers keep running (local storage notifications need them).

/** One timeout for every wait on the app that involves local storage or the fake server. */
const WAIT = 10_000;

const MON = new Date(2026, 10, 2, 9, 30); // Monday 2 November 2026
const TUE = new Date(2026, 10, 3, 9, 30);
const WED = new Date(2026, 10, 4, 9, 30);
const THU = new Date(2026, 10, 5, 9, 30);
const FRI = new Date(2026, 10, 6, 9, 30);
const SAT = new Date(2026, 10, 7, 9, 30);

const ES = {
  today: 'La sesión de hoy',
  week: /^Esta semana/,
  other: 'Otra sesión u otro día',
  activity: 'Actividad',
  weight: 'Peso medio de la semana',
  noKey:
    'Este dispositivo aún no tiene la clave de sincronización: lo que apuntes se queda solo aquí.',
  rehab: 'Rehabilitación del tobillo',
  stairs: 'Dolor al bajar escaleras',
  warning: 'Por encima de 3/10: baja la intensidad de lo que cargue la zona.',
} as const;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

async function openTodayAt(page: Page, date: Date, title = 'Hoy'): Promise<void> {
  await page.clock.setFixedTime(date);
  await gotoReady(page, '/', title);
}

/** Moves the device date and reloads Today (the app reads the date when it opens). */
async function reloadAt(page: Page, date: Date, title = 'Hoy'): Promise<void> {
  await page.clock.setFixedTime(date);
  await page.reload();
  await expect(h1(page, title)).toBeVisible();
}

async function backToToday(page: Page, lang: 'es' | 'en' = 'es'): Promise<void> {
  const name = lang === 'es' ? 'Hoy' : 'Today';
  await mainNav(page, lang).getByRole('link', { name, exact: true }).click();
  await expect(h1(page, name)).toBeVisible();
}

/**
 * The card around a heading: the outermost ancestor of the heading that contains no other
 * heading of the same level (so it holds that card's content and nothing of the next card).
 */
async function card(page: Page, name: string | RegExp): Promise<Locator> {
  const heading = page.getByRole('heading', { name, exact: typeof name === 'string' });
  const tag = await heading.evaluate((el) => el.tagName.toLowerCase());
  const same = /^h[1-6]$/.test(tag) ? tag : '*[@role="heading"]';
  return heading.locator(`xpath=ancestor::*[count(.//${same}) = 1][last()]`);
}

function toast(page: Page, text: string | RegExp): Locator {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first();
}

function button(scope: Page | Locator, name: string | RegExp): Locator {
  return scope.getByRole('button', { name, exact: true });
}

/**
 * The main action of "La sesión de hoy" when it opens an existing session ("Continuar …"):
 * the spec calls it a button; it navigates, so a link is just as valid for the user.
 */
function sessionAction(scope: Page | Locator, name: string): Locator {
  return scope
    .getByRole('button', { name, exact: true })
    .or(scope.getByRole('link', { name, exact: true }));
}

/** A text or number field by its label. */
function field(scope: Page | Locator, name: string | RegExp): Locator {
  return scope
    .getByRole('textbox', { name, exact: true })
    .or(scope.getByRole('spinbutton', { name, exact: true }));
}

/** A group of choices (fieldset / radiogroup) by its label. */
function group(scope: Page | Locator, name: string | RegExp): Locator {
  return scope
    .getByRole('radiogroup', { name, exact: true })
    .or(scope.getByRole('group', { name, exact: true }));
}

/** One choice of a group: a radio or a toggle button. */
function option(scope: Locator, name: string | RegExp): Locator {
  return scope
    .getByRole('radio', { name, exact: true })
    .or(scope.getByRole('button', { name, exact: true }));
}

/** The same choice, only when it is selected (radio checked or toggle pressed). */
function selected(scope: Locator, name: string | RegExp): Locator {
  return scope
    .getByRole('radio', { name, exact: true, checked: true })
    .or(scope.getByRole('button', { name, exact: true, pressed: true }));
}

/** A day of "Esta semana", by its accessible name ("lunes 2: Push, hecho"). */
function dayItem(page: Page, name: RegExp): Locator {
  return page
    .getByLabel(name)
    .or(page.getByRole('link', { name }))
    .or(page.getByRole('listitem', { name }))
    .first();
}

/** A button of a 0–10 scale ("4", or a name that ends in " 4"). */
function scaleValue(scale: Locator, n: number): Locator {
  return scale.getByRole('button', { name: new RegExp(`(^|\\s)${String(n)}$`) });
}

function indicator(page: Page): Locator {
  return page.getByRole('link', { name: /^(Sincronización|Sync): / });
}

async function expectSessionScreen(page: Page, heading: string): Promise<string> {
  await expect(page).toHaveURL(/\/session\/[^/]+$/);
  await expect(h1(page, 'Sesión')).toBeVisible();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  return page.url();
}

async function axe(page: Page, label: string): Promise<void> {
  // Colours may still be transitioning after a theme change: wait for the CSS transitions to end.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
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

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

test.describe('today', () => {
  test(
    'AC-TODAY-01 / 02 / 19 · the routine or rest day of each weekday; quick activity; the week fits 390 px; an unknown session',
    { tag: '@all-engines' },
    async ({ page }) => {
      await openTodayAt(page, MON);
      await expect(page.getByText('lunes, 2 de noviembre', { exact: true })).toBeVisible();
      let today = await card(page, ES.today);
      await expect(today).toContainText('Push');
      await expect(today.getByText('7 ejercicios · 19 series', { exact: true })).toBeVisible();
      await expect(button(today, 'Empezar Push')).toBeVisible();
      // The exercises can be seen without starting.
      await today.getByText('Ver los ejercicios', { exact: true }).click();
      await expect(today).toContainText('Press inclinado con mancuernas · 3 series');
      await expect(page).toHaveURL(/\/$/);

      // The week at a glance: seven days in one row, Monday first, today marked.
      const week = await card(page, ES.week);
      await expect(week).toContainText(/2\s*–\s*8 nov/);
      await expect(week).toContainText('0 / 104');
      await expect(week).toContainText('0 de 5');
      const days: [string, string][] = [
        ['lunes 2', 'Push'],
        ['martes 3', 'Pull'],
        ['miércoles 4', 'Lower B'],
        ['jueves 5', 'Activo'],
        ['viernes 6', 'Upper'],
        ['sábado 7', 'Fútbol'],
        ['domingo 8', 'Lower A'],
      ];
      const tops: number[] = [];
      let lastX = -1;
      for (const [d, plan] of days) {
        const item = dayItem(page, new RegExp(`^${d}: ${plan}`));
        await expect(item, `${d} reads ${plan}`).toBeVisible();
        const box = await boxOf(item);
        tops.push(Math.round(box.y));
        expect(box.x, `${d} is to the right of the day before`).toBeGreaterThan(lastX);
        lastX = box.x;
      }
      expect(Math.max(...tops) - Math.min(...tops), 'the seven days sit in one row').toBeLessThan(
        4,
      );
      await expect(week.locator('[aria-current="date"]')).toHaveCount(1);
      expect(await hasHorizontalScroll(page), 'horizontal scroll on Today').toBe(false);

      // Wednesday's "Lower B" is checked by AC-06/07 and AC-08/09, which open on Wednesday.
      await reloadAt(page, TUE);
      await expect(button(page, 'Empezar Pull')).toBeVisible();

      // Thursday: active rest, with its quick activities.
      await reloadAt(page, THU);
      today = await card(page, ES.today);
      await expect(today.getByText('Descanso activo', { exact: true })).toBeVisible();
      await expect(
        today.getByText('Natación o movilidad. No correr.', { exact: true }),
      ).toBeVisible();
      await expect(today.getByRole('button', { name: /^Empezar / })).toHaveCount(0);
      await expect(button(today, '+ Natación')).toBeVisible();
      const types = group(page, 'Tipo de actividad');
      // On a rest day the first quick activity is selected.
      await expect(selected(types, 'Natación')).toBeVisible();
      await button(today, '+ Movilidad').click();
      await expect(selected(types, 'Movilidad')).toBeVisible();
      await expect(selected(types, 'Natación')).toHaveCount(0);
      await expect(field(page, 'Minutos')).toBeFocused();

      await reloadAt(page, SAT);
      today = await card(page, ES.today);
      await expect(today.getByText('Fútbol', { exact: true })).toBeVisible();
      await expect(
        today.getByText('Partido (+ natación si cuadra).', { exact: true }),
      ).toBeVisible();
      await expect(button(today, '+ Fútbol')).toBeVisible();
      await expect(button(today, '+ Natación')).toBeVisible();

      // AC-19: an unknown session.
      await page.goto('/session/does-not-exist');
      await expect(page.getByText('Sesión no encontrada', { exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Volver a Hoy', exact: true }).click();
      await expect(h1(page, 'Hoy')).toBeVisible();
      await expect(page).toHaveURL(/\/$/);
    },
  );

  test('AC-TODAY-03 / 04 / 05 · a free session and Pull today under "También hoy"; then start, continue and reload Push', async ({
    page,
  }) => {
    await openTodayAt(page, MON);
    let other = await card(page, ES.other);
    await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('2026-11-02');
    await expect(
      other.getByText(
        'Elige qué entrenaste. Sirve para cambiar el orden hoy o para apuntar un día que se te olvidó.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(other.getByRole('button')).toHaveText([
      'Push',
      'Pull',
      'Lower B',
      'Upper',
      'Lower A',
      'Lower Full',
      'Sesión libre',
    ]);

    // AC-04: a free session starts empty.
    await button(other, 'Sesión libre').click();
    const freeUrl = await expectSessionScreen(page, 'Sesión libre');
    let main = page.getByRole('main');
    await expect(main.getByText('En curso', { exact: true })).toBeVisible();
    await expect(main.getByText('Sin ejercicios todavía.', { exact: true })).toBeVisible();
    await backToToday(page);
    await expect(await card(page, ES.week)).toContainText('1 de 5');

    // AC-05: Pull today, out of order.
    other = await card(page, ES.other);
    await button(other, 'Pull').click();
    const pullUrl = await expectSessionScreen(page, 'Pull');
    await expect(page.getByRole('main').getByText('En curso', { exact: true })).toBeVisible();
    expect(pullUrl).not.toBe(freeUrl);

    await backToToday(page);
    let today = await card(page, ES.today);
    await expect(button(today, 'Empezar Push')).toBeVisible();
    await expect(today).toContainText('También hoy: Pull (en curso)');
    await expect(today).toContainText('También hoy: Sesión libre (en curso)');
    await expect(today.getByRole('link', { name: 'Sesión libre', exact: true })).toBeVisible();
    await expect(await card(page, ES.week)).toContainText('2 de 5');
    await today.getByRole('link', { name: 'Pull', exact: true }).click();
    await expectSessionScreen(page, 'Pull');
    expect(page.url()).toBe(pullUrl);

    // AC-03: start Push, go back, continue the same session.
    await backToToday(page);
    today = await card(page, ES.today);
    await button(today, 'Empezar Push').click();
    const pushUrl = await expectSessionScreen(page, 'Push');
    main = page.getByRole('main');
    await expect(main.getByText('En curso', { exact: true })).toBeVisible();
    await expect(main.getByText('7 ejercicios · 19 series', { exact: true })).toBeVisible();
    await expect(main).toContainText(/lunes, 2 de noviembre · 0?9:30/);
    await expect(main.getByText('0 de 19 hechas', { exact: true })).toBeVisible();

    await backToToday(page);
    await expect(button(page, 'Empezar Push')).toHaveCount(0);
    await sessionAction(page, 'Continuar Push').click();
    await expectSessionScreen(page, 'Push');
    expect(page.url(), 'the same session').toBe(pushUrl);

    await backToToday(page);
    await page.reload();
    await expect(h1(page, 'Hoy')).toBeVisible();
    await expect(sessionAction(page, 'Continuar Push')).toBeVisible();
    await expect(await card(page, ES.week)).toContainText('3 de 5');
  });

  test(
    'AC-TODAY-03 · the hero goes Empezar -> Continuar -> "Sesión hecha · ver o corregir" -> Continuar, also after a reload',
    { tag: '@all-engines' },
    async ({ page }) => {
      await openTodayAt(page, MON);
      await button(page, 'Empezar Push').click();
      const url = await expectSessionScreen(page, 'Push');

      await backToToday(page);
      await expect(sessionAction(page, 'Continuar Push')).toBeVisible();

      // Finish it: the hero says it is done and still opens the same session.
      await sessionAction(page, 'Continuar Push').click();
      await expectSessionScreen(page, 'Push');
      await button(page, 'Terminar sesión').click();
      await expect(page.getByRole('main').getByText('Terminada', { exact: true })).toBeVisible();
      await backToToday(page);
      const done = sessionAction(page, 'Sesión hecha · ver o corregir');
      await expect(done).toBeVisible();
      await expect(sessionAction(page, 'Continuar Push')).toHaveCount(0);
      await expect(button(page, 'Empezar Push')).toHaveCount(0);
      await page.reload();
      await expect(h1(page, 'Hoy')).toBeVisible();
      await expect(done).toBeVisible();
      await done.click();
      await expectSessionScreen(page, 'Push');
      expect(page.url(), 'the same session').toBe(url);

      // Back in progress: the hero is "Continuar" again.
      await button(page, 'Marcar como en curso').click();
      await expect(page.getByRole('main').getByText('En curso', { exact: true })).toBeVisible();
      await backToToday(page);
      await expect(sessionAction(page, 'Continuar Push')).toBeVisible();
      await expect(sessionAction(page, 'Sesión hecha · ver o corregir')).toHaveCount(0);
    },
  );

  test('AC-TODAY-06 / 07 · a future date is refused; a past day is logged finished and reopened', async ({
    page,
  }) => {
    await openTodayAt(page, WED);
    const date = page.getByLabel('Fecha', { exact: true });
    await expect(date).toHaveValue('2026-11-04');

    // AC-07: Thursday 5 November is in the future.
    await date.fill('2026-11-05');
    await button(await card(page, ES.other), 'Push').click();
    await expect(
      page.getByText('No se puede registrar en el futuro.', { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(await card(page, ES.week)).toContainText('0 de 5');

    // AC-06: Monday 2 November.
    await date.fill('2026-11-02');
    await expect(
      page.getByText(
        'Se registrará el lunes, 2 de noviembre. Sin temporizador; podrás ajustar la hora.',
        { exact: true },
      ),
    ).toBeVisible();
    await button(await card(page, ES.other), 'Push').click();
    const url = await expectSessionScreen(page, 'Push');
    const main = page.getByRole('main');
    await expect(main).toContainText(/lunes, 2 de noviembre · 18:00/);
    await expect(main.getByText('Terminada', { exact: true })).toBeVisible();

    // Again: the same session opens, with a toast.
    await backToToday(page);
    await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('2026-11-04');
    await page.getByLabel('Fecha', { exact: true }).fill('2026-11-02');
    await button(await card(page, ES.other), 'Push').click();
    await expect(toast(page, 'Ya había una sesión «Push» ese día: la abro.')).toBeVisible();
    await expectSessionScreen(page, 'Push');
    expect(page.url(), 'the existing session').toBe(url);

    await backToToday(page);
    // A day with exactly one session is a link to it.
    await expect(page.getByRole('link', { name: /^lunes 2: Push, hecho$/ })).toBeVisible();
    await expect(await card(page, ES.week)).toContainText('1 de 5');
    // Today's own plan is untouched.
    await expect(button(page, 'Empezar Lower B')).toBeVisible();
  });

  test('AC-TODAY-08 / 09 · hiking week on Wednesday (Lower Full, Sunday "Monte", kept after reload); short weeks of 4 and 3 on Friday', async ({
    page,
  }) => {
    // AC-09: hiking week.
    await openTodayAt(page, WED);
    let today = await card(page, ES.today);
    await expect(button(today, 'Empezar Lower B')).toBeVisible();
    const hiking = page.getByRole('switch', { name: /^Semana con senderismo/ });
    await expect(hiking).not.toBeChecked();
    await expect(
      page.getByText('Para toda la semana: el miércoles pasa a Lower Full y el domingo es monte.', {
        exact: true,
      }),
    ).toBeVisible();

    await hiking.click();
    await expect(hiking).toBeChecked();
    await expect(button(today, 'Empezar Lower Full')).toBeVisible();
    await expect(button(today, 'Empezar Lower B')).toHaveCount(0);
    await expect(today.getByText('Senderismo', { exact: true })).toBeVisible();
    await expect(dayItem(page, /^domingo 8: Monte/)).toBeVisible();
    let week = await card(page, ES.week);
    await expect(week).toContainText('0 / 86');
    await expect(week).toContainText('0 de 4');

    // Saved for the week.
    await page.reload();
    await expect(h1(page, 'Hoy')).toBeVisible();
    const hikingAgain = page.getByRole('switch', { name: /^Semana con senderismo/ });
    await expect(hikingAgain).toBeChecked();
    await expect(button(page, 'Empezar Lower Full')).toBeVisible();
    await expect(await card(page, ES.week)).toContainText('0 / 86');

    // Back to a normal week for AC-08.
    await hikingAgain.click();
    await expect(hikingAgain).not.toBeChecked();
    await expect(button(page, 'Empezar Lower B')).toBeVisible();

    // AC-08: short weeks, on Friday of the same week.
    await reloadAt(page, FRI);
    await expect(button(page, 'Empezar Upper')).toBeVisible();
    week = await card(page, ES.week);
    await expect(week).toContainText('0 / 104');
    await expect(
      week.getByText('Con 4 se cae el Upper; con 3: Push, Pull y Lower Full.', { exact: true }),
    ).toBeVisible();
    const size = group(page, 'Sesiones esta semana');
    await expect(selected(size, '5')).toBeVisible();

    await option(size, '4').click();
    await expect(selected(size, '4')).toBeVisible();
    today = await card(page, ES.today);
    await expect(today.getByText('Descanso', { exact: true })).toBeVisible();
    await expect(today.getByText('Hoy no toca rutina.', { exact: true })).toBeVisible();
    await expect(button(page, 'Empezar Upper')).toHaveCount(0);
    await expect(week).toContainText('0 / 81');
    await expect(week).toContainText('0 de 4');

    await option(size, '3').click();
    await expect(selected(size, '3')).toBeVisible();
    await expect(week).toContainText('0 / 63');
    await expect(week).toContainText('0 de 3');
    await expect(dayItem(page, /^miércoles 4: Lower Full/)).toBeVisible();
    await expect(dayItem(page, /^domingo 8: Descanso/)).toBeVisible();
  });

  test('AC-TODAY-10 / 11 · six past weeks without a deload show the reminder; the deload week hides it, reduces the sets and a started session keeps them', async ({
    page,
  }) => {
    await openTodayAt(page, MON);
    // Fresh install: no week counted yet.
    await expect(page.getByText('Mitad de series y RIR 3-4.', { exact: true })).toBeVisible();

    // AC-11: one past Push session in each of the six weeks before this one.
    const mondays = [
      '2026-10-26',
      '2026-10-19',
      '2026-10-12',
      '2026-10-05',
      '2026-09-28',
      '2026-09-21',
    ];
    for (const monday of mondays) {
      await page.getByLabel('Fecha', { exact: true }).fill(monday);
      await button(await card(page, ES.other), 'Push').click();
      await expectSessionScreen(page, 'Push');
      await backToToday(page);
    }
    const notice = page.getByText(
      'Llevas 6 semanas sin descarga. Lo recomendado es una cada 6-8: márcala abajo cuando te venga bien.',
      { exact: true },
    );
    const main = page.getByRole('main');
    await expect(notice).toBeVisible();
    await expect(main).toContainText(
      'Mitad de series y RIR 3-4. Llevas 6 semanas seguidas sin descargar.',
    );

    // AC-10: deload week.
    const deload = page.getByRole('switch', { name: /^Semana de descarga/ });
    await deload.click();
    await expect(deload).toBeChecked();
    await expect(notice).toHaveCount(0);
    await expect(
      toast(page, 'Semana de descarga: las sesiones nuevas salen reducidas'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Activa: las sesiones nuevas salen con la mitad de series y RIR 3-4. No cuentan para récords.',
        { exact: true },
      ),
    ).toBeVisible();
    const today = await card(page, ES.today);
    await expect(today.getByText('Descarga', { exact: true })).toBeVisible();
    const summary = today.getByText(/^\d+ ejercicios · \d+ series$/);
    await expect(summary).not.toHaveText('7 ejercicios · 19 series');
    const text = (await summary.innerText()).trim();
    const sets = Number(/(\d+) series$/.exec(text)?.[1]);
    expect(sets, `deload Push sets (${text})`).toBeLessThan(19);
    expect(sets).toBeGreaterThan(0);
    await expect(await card(page, ES.week)).toContainText('0 / 62');

    await button(today, 'Empezar Push').click();
    await expectSessionScreen(page, 'Push');
    await expect(page.getByRole('main').getByText(text, { exact: true })).toBeVisible();

    // Back to a normal week: the session already started keeps its reduced plan.
    await backToToday(page);
    await page.getByRole('switch', { name: /^Semana de descarga/ }).click();
    await expect(toast(page, 'Semana normal')).toBeVisible();
    await expect(page.getByRole('switch', { name: /^Semana de descarga/ })).not.toBeChecked();
    await expect(await card(page, ES.week)).toContainText('0 / 104');
    await sessionAction(page, 'Continuar Push').click();
    await expectSessionScreen(page, 'Push');
    await expect(page.getByRole('main').getByText(text, { exact: true })).toBeVisible();
  });

  test(
    'AC-TODAY-12 / 13 / 14 / 15 · activity, weekly weight and the ankle rehab block are saved and survive one reload',
    { tag: '@all-engines' },
    async ({ page }) => {
      await openTodayAt(page, MON);

      // AC-12: activity. A routine day: Fútbol is selected by default.
      const types = group(page, 'Tipo de actividad');
      await expect(selected(types, 'Fútbol')).toBeVisible();
      await expect(page.getByLabel('Nota', { exact: true })).toHaveAttribute(
        'placeholder',
        'Opcional',
      );
      await option(types, 'Natación').click();
      await expect(selected(types, 'Natación')).toBeVisible();
      await field(page, 'Minutos').fill('45');
      await page.getByLabel('Nota', { exact: true }).fill('Piscina E2E');
      await button(page, 'Guardar actividad de hoy').click();
      await expect(toast(page, 'Actividad guardada: Natación')).toBeVisible();
      await expect(page.getByText('Hoy: Natación 45 min', { exact: true })).toBeVisible();
      await expect(field(page, 'Minutos')).toHaveValue('');
      await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('');
      // No session that day, an activity → the day's label is the activity's name.
      await expect(dayItem(page, /^lunes 2: Natación, hecho$/)).toBeVisible();
      // Without minutes: saved and shown without minutes, after the first one.
      await option(types, 'Fútbol').click();
      await button(page, 'Guardar actividad de hoy').click();
      await expect(toast(page, 'Actividad guardada: Fútbol')).toBeVisible();
      const activities = page.getByText('Hoy: Natación 45 min · Fútbol', { exact: true });
      await expect(activities).toBeVisible();

      // AC-14: 12 kg is refused.
      const weeks = group(page, 'Semana');
      const thisWeek = /^Esta semana · 2\s*–\s*8 nov$/;
      const lastWeek = /^Semana pasada · 26 oct\.?\s*–\s*1 nov$/;
      await expect(selected(weeks, thisWeek)).toBeVisible();
      const kg = field(page, /^Peso medio/);
      const save = button(page, 'Guardar peso');
      await kg.fill('12');
      await save.click();
      const invalid = page.getByText('Escribe un peso entre 20 y 300 kg.', { exact: true });
      await expect(invalid).toBeVisible();
      await expect(page.getByText(/^Peso guardado/)).toHaveCount(0);

      // AC-13: this week, then last week.
      await kg.fill('76,4');
      await save.click();
      await expect(toast(page, /^Peso guardado · 2\s*–\s*8 nov$/)).toBeVisible();
      await expect(kg).toHaveValue('76,4');
      await expect(invalid).toHaveCount(0);
      await option(weeks, lastWeek).click();
      await expect(selected(weeks, lastWeek)).toBeVisible();
      await expect(kg).toHaveValue('');
      expect((await kg.getAttribute('placeholder')) ?? '').not.toMatch(/\d/);
      await kg.fill('77');
      await save.click();
      await expect(toast(page, /^Peso guardado · 26 oct\.?\s*–\s*1 nov$/)).toBeVisible();
      await option(weeks, thisWeek).click();
      await expect(kg).toHaveValue('76,4');
      const previous = page.getByText(/^Último dato anterior \(26 oct\.?\s*–\s*1 nov\): 77 kg$/);
      await expect(previous).toBeVisible();

      // AC-15: the ankle rehab block.
      const block = await card(page, ES.rehab);
      await expect(page.getByRole('heading', { name: 'Estiramientos', exact: true })).toHaveCount(
        0,
      );
      await expect(block).toContainText('Ejercicios · 0/8');
      await expect(block.getByRole('checkbox')).toHaveCount(8);
      for (const metric of [ES.stairs, 'Dolor máximo en los ejercicios', 'Dolor en pogos']) {
        await expect(group(block, metric).getByRole('button'), metric).toHaveCount(11);
      }
      await expect(block).toContainText('2 × 30 s por pierna');
      const roller = block.getByRole('checkbox', { name: /^Rodillo en gemelo/ });
      const stairs = group(block, ES.stairs);
      // The tick follows the saved record, a moment after the tap: wait for it (check() would
      // read the state straight after the click).
      await roller.click();
      await expect(roller).toBeChecked();
      await expect(block).toContainText('Ejercicios · 1/8');
      await scaleValue(stairs, 4).click();
      await expect(scaleValue(stairs, 4)).toHaveAttribute('aria-pressed', 'true');
      await expect(stairs.getByRole('button', { pressed: true })).toHaveCount(1);
      await expect(block.getByText(ES.warning, { exact: true })).toBeVisible();
      const note = block.getByLabel('Nota del día', { exact: true });
      await note.fill('Tobillo E2E');
      await note.blur();
      await expect(toast(page, 'Nota guardada')).toBeVisible();

      // One reload for all three cards.
      await page.reload();
      await expect(h1(page, 'Hoy')).toBeVisible();
      await expect(activities).toBeVisible();
      await expect(field(page, /^Peso medio/)).toHaveValue('76,4');
      await expect(previous).toBeVisible();
      const again = await card(page, ES.rehab);
      const stairsAgain = group(again, ES.stairs);
      await expect(again.getByRole('checkbox', { name: /^Rodillo en gemelo/ })).toBeChecked();
      await expect(again).toContainText('Ejercicios · 1/8');
      await expect(scaleValue(stairsAgain, 4)).toHaveAttribute('aria-pressed', 'true');
      await expect(again.getByText(ES.warning, { exact: true })).toBeVisible();
      await expect(again.getByLabel('Nota del día', { exact: true })).toHaveValue('Tobillo E2E');

      // A second tap clears the value.
      await scaleValue(stairsAgain, 4).click();
      await expect(stairsAgain.getByRole('button', { pressed: true })).toHaveCount(0);
      await expect(again.getByText(ES.warning, { exact: true })).toHaveCount(0);
      // 3 is the threshold itself: no warning.
      await scaleValue(stairsAgain, 3).click();
      await expect(scaleValue(stairsAgain, 3)).toHaveAttribute('aria-pressed', 'true');
      await expect(again.getByText(ES.warning, { exact: true })).toHaveCount(0);
    },
  );

  test(
    'AC-TODAY-18 / 16 · the no-key notice leads to Settings; then offline, session, activity and weight survive a reload, wait as pending and sync later',
    { tag: '@all-engines' },
    async ({ page, context }) => {
      const server = createFakeSyncServer();
      await server.attach(context);
      await openTodayAt(page, MON);

      // AC-18: the notice comes first, above "La sesión de hoy", and links to Settings.
      const notice = page.getByText(ES.noKey, { exact: true });
      await expect(notice).toBeVisible();
      const noticeBox = await boxOf(notice);
      const todayBox = await boxOf(page.getByRole('heading', { name: ES.today, exact: true }));
      expect(noticeBox.y).toBeLessThan(todayBox.y);
      await page.getByRole('link', { name: 'Ponerla en Ajustes', exact: true }).click();
      await expect(h1(page, 'Ajustes')).toBeVisible();
      await expect(page).toHaveURL(/\/settings$/);
      await page.getByLabel('Clave de sincronización', { exact: true }).fill(E2E_SYNC_KEY);
      await button(page, 'Guardar clave').click();
      await expect(toast(page, 'Clave guardada.')).toBeVisible();
      await expect
        .poll(() => server.requestCount('/api/v1/sync'), { timeout: WAIT })
        .toBeGreaterThan(0);
      await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sincronizado', {
        timeout: WAIT,
      });
      await backToToday(page);
      await expect(page.getByRole('heading', { name: ES.today, exact: true })).toBeVisible();
      await expect(page.getByText(ES.noKey, { exact: true })).toHaveCount(0);
      const onServer = (await server.records()).length;

      // AC-16: offline.
      await context.setOffline(true);
      await expect(indicator(page)).toHaveAccessibleName(/^Sincronización: Sin conexión/, {
        timeout: WAIT,
      });
      const before = server.requestCount();

      await button(page, 'Empezar Push').click();
      await expectSessionScreen(page, 'Push');
      await backToToday(page);
      await option(group(page, 'Tipo de actividad'), 'Natación').click();
      await field(page, 'Minutos').fill('45');
      await button(page, 'Guardar actividad de hoy').click();
      await expect(toast(page, 'Actividad guardada: Natación')).toBeVisible();
      await field(page, /^Peso medio/).fill('76,4');
      await button(page, 'Guardar peso').click();
      await expect(toast(page, /^Peso guardado · /)).toBeVisible();
      await expect(indicator(page)).toHaveAccessibleName(
        /^Sincronización: Sin conexión · \d+ pendientes$/,
        { timeout: WAIT },
      );
      expect(server.requestCount(), 'no request while offline').toBe(before);

      // The page itself needs the network to reload (no service worker until Phase 8), so only
      // /api/v1/ stays cut during the reload.
      const unreachable = (route: Route) => route.abort('internetdisconnected');
      await context.route('**/api/v1/**', unreachable);
      await context.setOffline(false);
      await page.reload();
      await expect(h1(page, 'Hoy')).toBeVisible();
      await expect(sessionAction(page, 'Continuar Push')).toBeVisible();
      await expect(page.getByText('Hoy: Natación 45 min', { exact: true })).toBeVisible();
      await expect(field(page, /^Peso medio/)).toHaveValue('76,4');
      await expect(indicator(page)).toHaveAccessibleName(/ · \d+ pendientes$/, { timeout: WAIT });
      expect((await server.records()).length, 'nothing reached the server').toBe(onServer);

      // The network comes back: everything is sent.
      const beforeSync = server.requestCount('/api/v1/sync');
      await context.unroute('**/api/v1/**', unreachable);
      await context.setOffline(true);
      await context.setOffline(false);
      await expect
        .poll(() => server.requestCount('/api/v1/sync'), { timeout: WAIT })
        .toBeGreaterThan(beforeSync);
      await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sincronizado', {
        timeout: WAIT,
      });
      expect((await server.records()).length).toBeGreaterThan(onServer);
    },
  );

  test('AC-TODAY-17 · English, dark and light: texts, decimal point, no Spanish left, no serious axe issues on Today and the session', async ({
    page,
    browserName,
  }) => {
    await page.clock.setFixedTime(MON);
    await page.emulateMedia({ colorScheme: 'dark' });
    await setLanguage(page, 'en');
    await gotoReady(page, '/', 'Today');
    await expectTheme(page, 'dark');
    await expect(page.getByText('Monday 2 November', { exact: true })).toBeVisible();
    for (const heading of [
      "Today's session",
      'Another session or day',
      'Activity',
      'Average weekly weight',
      'Ankle rehab',
    ]) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: /^This week/ })).toBeVisible();
    const week = await card(page, /^This week/);
    await expect(week).toContainText(/2\s*–\s*8 Nov/);
    await expect(week).toContainText('0 of 5');
    await expect(
      page.getByText('This device has no sync key yet: what you log stays only here.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Set it in Settings', exact: true })).toBeVisible();
    const today = await card(page, "Today's session");
    await expect(today.getByText('7 exercises · 19 sets', { exact: true })).toBeVisible();
    await expect(button(today, 'Start Push')).toBeVisible();

    // Decimal point in English.
    await field(page, /^Average weight/).fill('76.4');
    await button(page, 'Save weight').click();
    await expect(toast(page, /^Weight saved · 2\s*–\s*8 Nov$/)).toBeVisible();
    await expect(field(page, /^Average weight/)).toHaveValue('76.4');

    // The block warning, in English.
    const rehab = await card(page, 'Ankle rehab');
    await expect(rehab).toContainText('Exercises · 0/8');
    await scaleValue(group(rehab, 'Pain going down stairs'), 4).click();
    await expect(
      rehab.getByText('Above 3/10: go easier on whatever loads that area.', { exact: true }),
    ).toBeVisible();

    let leftovers = findSpanishWords(await allUiText(page));
    expect(leftovers, `Spanish text left on Today: ${leftovers.join(', ')}`).toEqual([]);

    const runAxe = browserName === 'chromium';
    if (runAxe) await axe(page, 'Today (en, dark)');
    await page.emulateMedia({ colorScheme: 'light' });
    await expectTheme(page, 'light');
    if (runAxe) await axe(page, 'Today (en, light)');

    await button(today, 'Start Push').click();
    await expect(page).toHaveURL(/\/session\/[^/]+$/);
    await expect(h1(page, 'Session')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Push', exact: true })).toBeVisible();
    const main = page.getByRole('main');
    await expect(main.getByText('In progress', { exact: true })).toBeVisible();
    await expect(main.getByText('7 exercises · 19 sets', { exact: true })).toBeVisible();
    await expect(main.getByText('0 of 19 done', { exact: true })).toBeVisible();
    leftovers = findSpanishWords(await allUiText(page));
    expect(leftovers, `Spanish text left on the session: ${leftovers.join(', ')}`).toEqual([]);
    if (runAxe) await axe(page, 'Session (en, light)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expectTheme(page, 'dark');
    if (runAxe) await axe(page, 'Session (en, dark)');
  });
});
