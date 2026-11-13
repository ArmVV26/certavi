import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
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
  viewportOf,
} from './helpers';

// Spec: docs/spec/calendar.md (Phase 7, branch feature/calendar). The device date is fixed with
// `page.clock.setFixedTime` before the first `goto`, as in today.spec.ts: it only fakes `Date`,
// the app's timers keep running. All data is created through the app itself (the calendar's
// "Registrar en este día" and the week panel), never by writing to IndexedDB.

/** One timeout for every wait on the app that involves local storage or the fake server. */
const WAIT = 10_000;

const WED = new Date(2026, 10, 4, 9, 30); // Wednesday 4 November 2026
const WED_11 = new Date(2026, 10, 11, 9, 30); // Wednesday 11 November 2026
const MON_16 = new Date(2026, 10, 16, 9, 30); // Monday 16 November 2026

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A week range as the app may write it: "2–8 nov", "26 oct – 1 nov", "26 oct. – 1 nov". */
function rangeSource(range: string): string {
  return escapeRe(range).replace(/\s*–\s*/g, '\\.?\\s*–\\s*');
}

async function openCalendarAt(page: Page, date: Date, title = 'Calendario'): Promise<void> {
  await page.clock.setFixedTime(date);
  await gotoReady(page, '/calendar', title);
}

/** Moves the device date and reloads the calendar (the app reads the date when it opens). */
async function reloadCalendarAt(page: Page, date: Date, title = 'Calendario'): Promise<void> {
  await page.clock.setFixedTime(date);
  await page.reload();
  await expect(h1(page, title)).toBeVisible();
}

async function toCalendar(page: Page, lang: 'es' | 'en' = 'es'): Promise<void> {
  const name = lang === 'es' ? 'Calendario' : 'Calendar';
  await mainNav(page, lang).getByRole('link', { name, exact: true }).click();
  await expect(h1(page, name)).toBeVisible();
}

async function toToday(page: Page): Promise<void> {
  await mainNav(page).getByRole('link', { name: 'Hoy', exact: true }).click();
  await expect(h1(page, 'Hoy')).toBeVisible();
}

/** A day cell by the start of its accessible name ("lunes, 2 de noviembre"). */
function dayCell(page: Page, label: string): Locator {
  const source = escapeRe(label).replace(/,/g, ',?');
  return page.getByRole('button', { name: new RegExp(`^${source}(,|$)`) });
}

/** The week button whose name starts with "Semana <range>" (markers or not). */
function weekButton(page: Page, range: string, word = 'Semana'): Locator {
  return page.getByRole('button', { name: new RegExp(`^${word} ${rangeSource(range)}( ·|$)`) });
}

/** The exact accessible name of a week button: "Semana 9–15 nov · Descarga · 4 sesiones". */
function weekName(range: string, suffix = '', word = 'Semana'): RegExp {
  return new RegExp(`^${word} ${rangeSource(range)}${escapeRe(suffix)}$`);
}

function toast(page: Page, text: string | RegExp): Locator {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first();
}

function button(scope: Page | Locator, name: string | RegExp): Locator {
  return scope.getByRole('button', { name, exact: true });
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
function option(scope: Page | Locator, name: string | RegExp): Locator {
  return scope
    .getByRole('radio', { name, exact: true })
    .or(scope.getByRole('button', { name, exact: true }));
}

/** The same choice, only when it is selected (radio checked or toggle pressed). */
function selected(scope: Page | Locator, name: string | RegExp): Locator {
  return scope
    .getByRole('radio', { name, exact: true, checked: true })
    .or(scope.getByRole('button', { name, exact: true, pressed: true }));
}

const DELOAD_SWITCH = /^Semana de descarga/;
const HIKING_SWITCH = /^Semana (con|de) senderismo/;
const CLOSED_NOTE =
  /^Semana cerrada: el plan quedó guardado el .+\. Solo puedes cambiar la descarga y el senderismo\.$/;
const DELOAD_TOAST = 'Semana de descarga: las sesiones nuevas salen reducidas';
/** The week with the seeded session of the closed-week tests: 26 October - 1 November. */
const CLOSED_RANGE = '26 oct – 1 nov';

/** The note of a closed week's panel. */
function closedNote(page: Page): Locator {
  return page.getByText(CLOSED_NOTE);
}

/** Closed week (AC-CAL-12): only the "Sesiones" selector is read-only, both switches work. */
async function expectClosedPanel(page: Page): Promise<void> {
  await expect(closedNote(page)).toBeVisible();
  await expect(page.getByRole('switch', { name: DELOAD_SWITCH })).toBeEnabled();
  await expect(page.getByRole('switch', { name: HIKING_SWITCH })).toBeEnabled();
  for (const size of ['3', '4', '5']) {
    await expect(
      option(page.getByRole('main'), size),
      `size ${size} of a closed week`,
    ).toBeDisabled();
  }
}

/** "Series efectivas" of the open week panel: the planned number of "<done> / <planned>". */
async function plannedSets(page: Page): Promise<number> {
  const text = await page.getByRole('main').innerText();
  return Number(/\d+ \/ (\d+)/.exec(text)?.[1]);
}

/**
 * A Pull session on Wednesday 28 October, then the app starts again on Wednesday 4 November: the
 * week of 26 October - 1 November is closed. Leaves its panel open and returns the planned sets.
 */
async function openClosedWeek(page: Page): Promise<number> {
  await openCalendarAt(page, WED);
  await logSessionOn(page, 'miércoles, 28 de octubre', 'Pull');
  await page.goto('/calendar');
  await expect(h1(page, 'Calendario')).toBeVisible();
  await expect(weekButton(page, CLOSED_RANGE)).toHaveAccessibleName(
    weekName(CLOSED_RANGE, ' · Cerrada'),
  );
  await weekButton(page, CLOSED_RANGE).click();
  await expectClosedPanel(page);
  const planned = await plannedSets(page);
  expect(planned, 'planned sets of the closed week').toBeGreaterThan(0);
  return planned;
}

function indicator(page: Page): Locator {
  return page.getByRole('link', { name: /^(Sincronización|Sync): / });
}

function monthHeading(page: Page, name: string): Locator {
  return page.getByRole('heading', { name, exact: true });
}

async function expectSessionScreen(page: Page, heading: string): Promise<string> {
  await expect(page).toHaveURL(/\/session\/[^/]+$/);
  await expect(h1(page, 'Sesión')).toBeVisible();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  return page.url();
}

/** Selects a day and logs a session of `routine` on it; leaves the session screen open. */
async function logSessionOn(page: Page, dayLabel: string, routine: string): Promise<string> {
  await dayCell(page, dayLabel).click();
  await expect(page.getByRole('heading', { name: dayLabel, exact: true })).toBeVisible();
  await button(page, routine).click();
  return expectSessionScreen(page, routine);
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

test.describe('calendar (navigation and languages)', () => {
  test('AC-CAL-01 / 02 / 07 / 10 · opens on the current month; months, "Ir a hoy", select and unselect a day, a future day cannot be logged', async ({
    page,
  }) => {
    await openCalendarAt(page, WED);
    const main = page.getByRole('main');

    // AC-01: current month, no "Ir a hoy", today marked, nothing selected, nothing logged.
    await expect(monthHeading(page, 'noviembre de 2026')).toBeVisible();
    await expect(button(page, 'Ir a hoy')).toHaveCount(0);
    await expect(dayCell(page, 'miércoles, 4 de noviembre')).toHaveAttribute(
      'aria-current',
      'date',
    );
    await expect(dayCell(page, 'miércoles, 4 de noviembre')).toHaveAccessibleName(/sin registros$/);
    await expect(main.getByRole('button', { pressed: true })).toHaveCount(0);
    await expect(button(page, 'Cerrar')).toHaveCount(0);
    await expect(page.getByText('Nada registrado este mes', { exact: true })).toBeVisible();
    // The week buttons of November: closed ones and the current one carry no extra marker.
    await expect(weekButton(page, '2–8 nov')).toHaveAccessibleName(weekName('2–8 nov'));

    // AC-02: previous month, next months, back to today.
    await button(page, 'Mes anterior').click();
    await expect(monthHeading(page, 'octubre de 2026')).toBeVisible();
    await expect(button(page, 'Ir a hoy')).toBeVisible();
    await expect(page.getByText('Nada registrado este mes', { exact: true })).toBeVisible();
    await button(page, 'Mes siguiente').click();
    await button(page, 'Mes siguiente').click();
    await expect(monthHeading(page, 'diciembre de 2026')).toBeVisible();
    await expect(button(page, 'Ir a hoy')).toBeVisible();
    await button(page, 'Ir a hoy').click();
    await expect(monthHeading(page, 'noviembre de 2026')).toBeVisible();
    await expect(button(page, 'Ir a hoy')).toHaveCount(0);
    // "Ir a hoy" also selects today and shows its day panel.
    await expect(page.getByRole('heading', { name: 'miércoles, 4 de noviembre' })).toBeVisible();
    await expect(page.getByText('Plan: Lower B', { exact: true })).toBeVisible();
    await expect(dayCell(page, 'miércoles, 4 de noviembre')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('Sin sesiones', { exact: true })).toBeVisible();
    await expect(page.getByText('Sin actividades', { exact: true })).toBeVisible();
    await expect(page.getByText('Registrar en este día', { exact: true })).toBeVisible();

    // AC-07: the same cell, or "Cerrar", unselects.
    await dayCell(page, 'miércoles, 4 de noviembre').click();
    await expect(page.getByRole('heading', { name: 'miércoles, 4 de noviembre' })).toHaveCount(0);
    await expect(main.getByRole('button', { pressed: true })).toHaveCount(0);
    await dayCell(page, 'jueves, 5 de noviembre').click();
    await expect(page.getByText('Plan: Descanso activo', { exact: true })).toBeVisible();
    await expect(
      page.getByText('No se puede registrar en el futuro.', { exact: true }),
    ).toBeVisible();
    await button(page, 'Cerrar').click();
    await expect(page.getByRole('heading', { name: 'jueves, 5 de noviembre' })).toHaveCount(0);
    await expect(main.getByRole('button', { pressed: true })).toHaveCount(0);

    // AC-10: a future day shows the plan and no way to log.
    await dayCell(page, 'viernes, 6 de noviembre').click();
    await expect(page.getByRole('heading', { name: 'viernes, 6 de noviembre' })).toBeVisible();
    await expect(page.getByText('Plan: Upper', { exact: true })).toBeVisible();
    await expect(
      page.getByText('No se puede registrar en el futuro.', { exact: true }),
    ).toBeVisible();
    await expect(button(page, 'Sesión libre')).toHaveCount(0);
    await expect(button(page, 'Push')).toHaveCount(0);
    await expect(button(page, 'Guardar actividad')).toHaveCount(0);
    await expect(field(page, 'Minutos')).toHaveCount(0);

    // Edge: dimmed days are selectable and the selection survives a month change only while it
    // is still visible.
    await dayCell(page, 'lunes, 26 de octubre').click();
    await expect(page.getByRole('heading', { name: 'lunes, 26 de octubre' })).toBeVisible();
    await button(page, 'Mes anterior').click();
    await expect(monthHeading(page, 'octubre de 2026')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'lunes, 26 de octubre' })).toBeVisible();
    await button(page, 'Mes siguiente').click();
    await expect(monthHeading(page, 'noviembre de 2026')).toBeVisible();
    await dayCell(page, 'domingo, 6 de diciembre').click();
    await expect(page.getByRole('heading', { name: 'domingo, 6 de diciembre' })).toBeVisible();
    await button(page, 'Mes anterior').click();
    await expect(monthHeading(page, 'octubre de 2026')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'domingo, 6 de diciembre' })).toHaveCount(0);
  });

  test('AC-CAL-16 · English and dark: texts, weekday initials, decimal point, no Spanish left, no serious axe issues in light and dark with and without a panel', async ({
    page,
  }) => {
    await page.clock.setFixedTime(WED);
    await page.emulateMedia({ colorScheme: 'dark' });
    await setLanguage(page, 'en');
    await gotoReady(page, '/calendar', 'Calendar');
    await expectTheme(page, 'dark');

    const main = page.getByRole('main');
    await expect(monthHeading(page, 'November 2026')).toBeVisible();
    await expect(button(page, 'Previous month')).toBeVisible();
    await expect(button(page, 'Next month')).toBeVisible();
    await expect(page.getByText('Nothing logged this month', { exact: true })).toBeVisible();
    expect(await main.innerText()).toMatch(/\bM\s+T\s+W\s+T\s+F\s+S\s+S\b/);
    await expect(weekButton(page, '2 – 8 Nov', 'Week')).toHaveAccessibleName(
      weekName('2 – 8 Nov', '', 'Week'),
    );
    await expect(dayCell(page, 'Wednesday 4 November')).toHaveAccessibleName(/nothing logged$/);
    await axe(page, 'Calendar (en, dark, no panel)');

    // A day panel, in English: log a swimming session of 30 minutes today.
    await dayCell(page, 'Wednesday 4 November').click();
    await expect(page.getByRole('heading', { name: 'Wednesday 4 November' })).toBeVisible();
    await expect(page.getByText('Plan: Lower B', { exact: true })).toBeVisible();
    await expect(page.getByText('Log on this day', { exact: true })).toBeVisible();
    await expect(page.getByText('No sessions', { exact: true })).toBeVisible();
    await expect(page.getByText('No activities', { exact: true })).toBeVisible();
    await expect(button(page, 'Free session')).toBeVisible();
    await axe(page, 'Calendar (en, dark, day panel)');
    await page.emulateMedia({ colorScheme: 'light' });
    await expectTheme(page, 'light');
    await axe(page, 'Calendar (en, light, day panel)');
    await button(page, 'Close').click();
    await expect(page.getByRole('heading', { name: 'Wednesday 4 November' })).toHaveCount(0);
    await axe(page, 'Calendar (en, light, no panel)');

    await dayCell(page, 'Tuesday 3 November').click();
    await option(group(page, 'Activity type'), 'Swimming').click();
    await field(page, 'Minutes').fill('30');
    await button(page, 'Save activity').click();
    await expect(toast(page, 'Activity saved: Swimming')).toBeVisible();
    await expect(field(page, 'Minutes')).toHaveValue('');
    await expect(main).toContainText('Swimming 30 min');
    await expect(dayCell(page, 'Tuesday 3 November')).toHaveAccessibleName(/1 activity$/);
    await expect(page.getByText('0 sessions · 1 activity', { exact: true })).toBeVisible();

    // The week panel, in English, with a decimal point.
    await weekButton(page, '2 – 8 Nov', 'Week').click();
    await expect(page.getByText('Effective sets', { exact: true })).toBeVisible();
    await expect(button(page, 'Download the week as JSON')).toBeVisible();
    await field(page, /^Average weight/).fill('76.4');
    await button(page, 'Save weight').click();
    await expect(toast(page, /^Weight saved · 2\s*–\s*8 Nov$/)).toBeVisible();
    await expect(field(page, /^Average weight/)).toHaveValue('76.4');
    const leftovers = findSpanishWords(await allUiText(page));
    expect(leftovers, `Spanish text left on the calendar: ${leftovers.join(', ')}`).toEqual([]);
  });
});

test.describe('calendar (data and layout)', () => {
  test(
    'AC-CAL-03 / 04 / 06 / 08 / 09 · log a session and an activity on past days: marks, summary, the same session again, reload',
    { tag: '@all-engines' },
    async ({ page }) => {
      await openCalendarAt(page, WED);
      await expect(page.getByText('Nada registrado este mes', { exact: true })).toBeVisible();

      // AC-08: Push on Monday 2 November (a past day).
      await dayCell(page, 'lunes, 2 de noviembre').click();
      await expect(page.getByText('Sin sesiones', { exact: true })).toBeVisible();
      await button(page, 'Push').click();
      const pushUrl = await expectSessionScreen(page, 'Push');
      await expect(page.getByRole('main')).toContainText(/lunes, 2 de noviembre/);
      await expect(page.getByRole('main').getByText('Terminada', { exact: true })).toBeVisible();

      // Back to the calendar: the day is marked and lists the session.
      await toCalendar(page);
      await expect(dayCell(page, 'lunes, 2 de noviembre')).toHaveAccessibleName(
        'lunes, 2 de noviembre, 1 sesión',
      );
      await dayCell(page, 'lunes, 2 de noviembre').click();
      const link = page.getByRole('link', { name: /^Push[\s·]*Terminada[\s·]*\d+ series?$/ });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', /\/session\/[^/]+$/);

      // Pressing "Push" again opens the same session with the toast.
      await button(page, 'Push').click();
      await expect(toast(page, 'Ya había una sesión «Push» ese día: la abro.')).toBeVisible();
      expect(await expectSessionScreen(page, 'Push'), 'the existing session').toBe(pushUrl);

      // AC-09: Swimming for 45 minutes on Tuesday 3 November.
      await toCalendar(page);
      await dayCell(page, 'martes, 3 de noviembre').click();
      const types = group(page, 'Tipo de actividad');
      await option(types, 'Natación').click();
      await expect(selected(types, 'Natación')).toBeVisible();
      await field(page, 'Minutos').fill('45');
      await field(page, 'Nota').fill('Piscina E2E');
      await button(page, 'Guardar actividad').click();
      await expect(toast(page, 'Actividad guardada: Natación')).toBeVisible();
      await expect(field(page, 'Minutos')).toHaveValue('');
      await expect(field(page, 'Nota')).toHaveValue('');
      const main = page.getByRole('main');
      await expect(main).toContainText('Natación 45 min');
      await expect(main).toContainText('Piscina E2E');
      await expect(dayCell(page, 'martes, 3 de noviembre')).toHaveAccessibleName(
        'martes, 3 de noviembre, 1 actividad',
      );

      // A football match today, without minutes: shown without minutes (edge: 0 minutes).
      await dayCell(page, 'miércoles, 4 de noviembre').click();
      await option(group(page, 'Tipo de actividad'), 'Fútbol').click();
      await button(page, 'Guardar actividad').click();
      await expect(toast(page, 'Actividad guardada: Fútbol')).toBeVisible();
      await expect(dayCell(page, 'miércoles, 4 de noviembre')).toHaveAccessibleName(
        'miércoles, 4 de noviembre, 1 actividad',
      );
      await expect(main).not.toContainText('Fútbol 0 min');

      // AC-04: the summary counts the whole month, singular and plural.
      await expect(page.getByText('1 sesión · 2 actividades', { exact: true })).toBeVisible();

      // Reload in the middle: everything is still there, and the page opens on the current month.
      await page.reload();
      await expect(h1(page, 'Calendario')).toBeVisible();
      await expect(monthHeading(page, 'noviembre de 2026')).toBeVisible();
      await expect(page.getByText('1 sesión · 2 actividades', { exact: true })).toBeVisible();
      await expect(dayCell(page, 'lunes, 2 de noviembre')).toHaveAccessibleName(
        'lunes, 2 de noviembre, 1 sesión',
      );
      await expect(dayCell(page, 'martes, 3 de noviembre')).toHaveAccessibleName(
        'martes, 3 de noviembre, 1 actividad',
      );

      // AC-06: the session link opens the session.
      await dayCell(page, 'lunes, 2 de noviembre').click();
      await page.getByRole('link', { name: /^Push[\s·]*Terminada/ }).click();
      expect(await expectSessionScreen(page, 'Push')).toBe(pushUrl);
    },
  );

  test('AC-CAL-05 / 11 / 12 / 13 · week options from the week panel, special week buttons, closing of finished weeks (read-only), current and future weeks never closed', async ({
    page,
  }) => {
    // Wednesday 11 November: the week of 9–15 is the current one.
    await openCalendarAt(page, WED_11);
    await weekButton(page, '9–15 nov').click();
    const main = page.getByRole('main');
    await expect(page.getByRole('heading', { name: weekName('9–15 nov') })).toBeVisible();
    await expect(main.getByText('Series efectivas', { exact: true }).first()).toBeVisible();
    const deload = page.getByRole('switch', { name: /^Semana de descarga/ });
    const hiking = page.getByRole('switch', { name: /^Semana (con|de) senderismo/ });
    await expect(deload).toBeEnabled();
    await expect(hiking).toBeEnabled();
    await expect(option(main, '4')).toBeEnabled();

    // AC-11: deload on, and size 4.
    await deload.click();
    await expect(deload).toBeChecked();
    await expect(
      toast(page, 'Semana de descarga: las sesiones nuevas salen reducidas'),
    ).toBeVisible();
    await option(main, '4').click();
    await expect(selected(main, '4')).toBeVisible();
    // AC-05: the markers are in the button's name.
    await expect(weekButton(page, '9–15 nov')).toHaveAccessibleName(
      weekName('9–15 nov', ' · Descarga · 4 sesiones'),
    );
    await expect(weekButton(page, '2–8 nov')).toHaveAccessibleName(weekName('2–8 nov'));

    // Today's week card shows the same switch on.
    await toToday(page);
    await expect(page.getByRole('switch', { name: /^Semana de descarga/ })).toBeChecked();
    await toCalendar(page);

    // A session in the finished week of 2–8 November.
    await logSessionOn(page, 'miércoles, 4 de noviembre', 'Pull');
    await toCalendar(page);

    // Monday 16 November: both weeks are over. AC-12: the one with a session and the one with a
    // week record are closed; the one without data (26 Oct – 1 Nov) is not.
    await reloadCalendarAt(page, MON_16);
    await expect(weekButton(page, '2–8 nov')).toHaveAccessibleName(
      weekName('2–8 nov', ' · Cerrada'),
    );
    await expect(weekButton(page, '9–15 nov')).toHaveAccessibleName(
      weekName('9–15 nov', ' · Descarga · 4 sesiones · Cerrada'),
    );
    await expect(weekButton(page, '26 oct – 1 nov')).toHaveAccessibleName(
      weekName('26 oct – 1 nov'),
    );

    await weekButton(page, '2–8 nov').click();
    await expectClosedPanel(page);
    // Its weight form still works (checked in the weight test).
    await expect(button(page, 'Guardar peso')).toBeVisible();

    // The current week (16–22) is open: hiking on shows in its name.
    await weekButton(page, '16–22 nov').click();
    const hikingNow = page.getByRole('switch', { name: /^Semana (con|de) senderismo/ });
    await expect(hikingNow).toBeEnabled();
    await hikingNow.click();
    await expect(hikingNow).toBeChecked();
    await expect(weekButton(page, '16–22 nov')).toHaveAccessibleName(
      weekName('16–22 nov', ' · Senderismo'),
    );

    // AC-13: a future week is read-only and never closed.
    await weekButton(page, '23–29 nov').click();
    await expect(page.getByText('Todavía no puedes cambiar esta semana.').first()).toBeVisible();
    await expect(page.getByRole('switch', { name: /^Semana de descarga/ })).toBeDisabled();
    await expect(button(page, 'Guardar peso')).toHaveCount(0);
    await expect(weekButton(page, '23–29 nov')).toHaveAccessibleName(weekName('23–29 nov'));
    await expect(weekButton(page, '30 nov – 6 dic')).toHaveAccessibleName(
      weekName('30 nov – 6 dic'),
    );
  });

  test('AC-CAL-18 · a closed week can be marked as deload: toast, marker order, plan recomputed, kept after a reload and undone; the sessions selector and the closing note stay', async ({
    page,
  }) => {
    const base = await openClosedWeek(page);
    const noteBefore = await closedNote(page).innerText();
    const deload = page.getByRole('switch', { name: DELOAD_SWITCH });

    await deload.click();
    await expect(toast(page, DELOAD_TOAST)).toBeVisible();
    await expect(deload).toBeChecked();
    // Markers first, "Cerrada" last.
    await expect(weekButton(page, CLOSED_RANGE)).toHaveAccessibleName(
      weekName(CLOSED_RANGE, ' · Descarga · Cerrada'),
    );
    await expect.poll(() => plannedSets(page), { timeout: WAIT }).toBeLessThan(base);
    const reduced = await plannedSets(page);
    expect(reduced, 'deload plan').toBeGreaterThan(0);
    await expectClosedPanel(page);
    expect(await closedNote(page).innerText(), 'the closing date does not change').toBe(noteBefore);

    // Still there after the app starts again.
    await page.reload();
    await expect(h1(page, 'Calendario')).toBeVisible();
    await expect(weekButton(page, CLOSED_RANGE)).toHaveAccessibleName(
      weekName(CLOSED_RANGE, ' · Descarga · Cerrada'),
    );
    await weekButton(page, CLOSED_RANGE).click();
    await expect(page.getByRole('switch', { name: DELOAD_SWITCH })).toBeChecked();
    await expectClosedPanel(page);
    await expect.poll(() => plannedSets(page), { timeout: WAIT }).toBe(reduced);
    expect(await closedNote(page).innerText()).toBe(noteBefore);

    // Turning it off again brings the normal plan back.
    await page.getByRole('switch', { name: DELOAD_SWITCH }).click();
    await expect(page.getByRole('switch', { name: DELOAD_SWITCH })).not.toBeChecked();
    await expect(weekButton(page, CLOSED_RANGE)).toHaveAccessibleName(
      weekName(CLOSED_RANGE, ' · Cerrada'),
    );
    await expect.poll(() => plannedSets(page), { timeout: WAIT }).toBe(base);
    await expectClosedPanel(page);
  });

  test('AC-CAL-20 · hiking in a closed week: marker before "Cerrada", kept after a reload, planned sets recomputed', async ({
    page,
  }) => {
    const base = await openClosedWeek(page);
    const hiking = page.getByRole('switch', { name: HIKING_SWITCH });
    await hiking.click();
    await expect(hiking).toBeChecked();
    await expect(weekButton(page, CLOSED_RANGE)).toHaveAccessibleName(
      weekName(CLOSED_RANGE, ' · Senderismo · Cerrada'),
    );
    // A hiking week plans fewer sets than a normal one (Lower A is replaced).
    await expect.poll(() => plannedSets(page), { timeout: WAIT }).toBeLessThan(base);
    const hikingPlan = await plannedSets(page);
    await expectClosedPanel(page);

    await page.reload();
    await expect(h1(page, 'Calendario')).toBeVisible();
    await expect(weekButton(page, CLOSED_RANGE)).toHaveAccessibleName(
      weekName(CLOSED_RANGE, ' · Senderismo · Cerrada'),
    );
    await weekButton(page, CLOSED_RANGE).click();
    await expect(page.getByRole('switch', { name: HIKING_SWITCH })).toBeChecked();
    await expect(page.getByRole('switch', { name: DELOAD_SWITCH })).not.toBeChecked();
    await expect.poll(() => plannedSets(page), { timeout: WAIT }).toBe(hikingPlan);
    await expectClosedPanel(page);
  });

  test('AC-CAL-19 · marking a past week as deload in the calendar restarts the count of weeks without a deload in Today', async ({
    page,
  }) => {
    // One Push session in each of the six weeks before the current one (Monday 2 November).
    await page.clock.setFixedTime(new Date(2026, 10, 2, 9, 30));
    await gotoReady(page, '/', 'Hoy');
    const other = page
      .getByRole('heading', { name: 'Otra sesión u otro día', exact: true })
      .locator('xpath=ancestor::*[count(.//h2) = 1][last()]');
    for (const monday of [
      '2026-10-26',
      '2026-10-19',
      '2026-10-12',
      '2026-10-05',
      '2026-09-28',
      '2026-09-21',
    ]) {
      await page.getByLabel('Fecha', { exact: true }).fill(monday);
      await button(other, 'Push').click();
      await expectSessionScreen(page, 'Push');
      await toToday(page);
    }
    const reminder = page.getByText(/^Llevas \d+ semanas sin descarga\./);
    await expect(
      page.getByText(
        'Llevas 6 semanas sin descarga. Lo recomendado es una cada 6-8: márcala abajo cuando te venga bien.',
        { exact: true },
      ),
    ).toBeVisible();

    // The app starts again: those weeks are closed. Mark the week of 12-18 October as deload.
    await page.goto('/calendar');
    await expect(h1(page, 'Calendario')).toBeVisible();
    await button(page, 'Mes anterior').click();
    await expect(monthHeading(page, 'octubre de 2026')).toBeVisible();
    await expect(weekButton(page, '12–18 oct')).toHaveAccessibleName(
      weekName('12–18 oct', ' · Cerrada'),
    );
    await weekButton(page, '12–18 oct').click();
    await expectClosedPanel(page);
    await page.getByRole('switch', { name: DELOAD_SWITCH }).click();
    await expect(toast(page, DELOAD_TOAST)).toBeVisible();
    await expect(weekButton(page, '12–18 oct')).toHaveAccessibleName(
      weekName('12–18 oct', ' · Descarga · Cerrada'),
    );

    // Today counts only the full weeks after it (19 and 26 October): the notice is gone.
    await toToday(page);
    await expect(page.getByRole('main')).toContainText('Llevas 2 semanas seguidas sin descargar.');
    await expect(reminder).toHaveCount(0);
  });

  test('AC-CAL-14 / 15 · weight of a closed past week (0 kg refused, kept after reload, seen in Today) and the week JSON without other weeks', async ({
    page,
  }, testInfo) => {
    await openCalendarAt(page, WED);
    // Two sessions in two different weeks: Pull on 28 Oct, Push on 2 Nov.
    const pullUrl = await logSessionOn(page, 'miércoles, 28 de octubre', 'Pull');
    await toCalendar(page);
    const pushUrl = await logSessionOn(page, 'lunes, 2 de noviembre', 'Push');
    const pullId = pullUrl.split('/').pop() ?? '';
    const pushId = pushUrl.split('/').pop() ?? '';
    expect(pullId.length).toBeGreaterThan(3);
    expect(pushId.length).toBeGreaterThan(3);

    // The app starts again: the week of 26 Oct – 1 Nov (with data) is closed.
    await page.goto('/calendar');
    await expect(h1(page, 'Calendario')).toBeVisible();
    await expect(weekButton(page, '26 oct – 1 nov')).toHaveAccessibleName(
      weekName('26 oct – 1 nov', ' · Cerrada'),
    );

    // AC-14: weight of that week. 0 kg is refused, 76,4 is saved.
    await weekButton(page, '26 oct – 1 nov').click();
    const kg = field(page, /^Peso medio/);
    await kg.fill('0');
    await button(page, 'Guardar peso').click();
    await expect(
      page.getByText('Escribe un peso entre 20 y 300 kg.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/^Peso guardado/)).toHaveCount(0);
    await kg.fill('76,4');
    await button(page, 'Guardar peso').click();
    await expect(toast(page, /^Peso guardado · 26 oct\.?\s*–\s*1 nov$/)).toBeVisible();
    await expect(page.getByText('Escribe un peso entre 20 y 300 kg.', { exact: true })).toHaveCount(
      0,
    );

    await page.reload();
    await expect(h1(page, 'Calendario')).toBeVisible();
    await weekButton(page, '26 oct – 1 nov').click();
    await expect(field(page, /^Peso medio/)).toHaveValue('76,4');

    // Today shows it as last week's weight.
    await toToday(page);
    const lastWeek = /^Semana pasada · 26 oct\.?\s*–\s*1 nov$/;
    await option(group(page, 'Semana'), lastWeek).click();
    await expect(field(page, /^Peso medio/)).toHaveValue('76,4');

    // AC-15: the JSON of the week of 2–8 November.
    await toCalendar(page);
    await weekButton(page, '2–8 nov').click();
    const pending = page.waitForEvent('download');
    await button(page, 'Descargar JSON de la semana').click();
    const dl = await pending;
    expect(dl.suggestedFilename()).toBe('certavi-week-2026-11-02.json');
    const file = testInfo.outputPath(dl.suggestedFilename());
    await dl.saveAs(file);
    const text = readFileSync(file, 'utf8');
    expect(() => JSON.parse(text) as unknown).not.toThrow();
    expect(text).toContain(pushId);
    expect(text, 'a session of another week must not be in the file').not.toContain(pullId);
    expect(text).not.toContain(E2E_SYNC_KEY);
  });

  test(
    'AC-CAL-17 · offline: an activity on a past day and the weight of a week survive a reload, wait as pending and sync later',
    { tag: '@all-engines' },
    async ({ page, context }) => {
      const server = createFakeSyncServer();
      await server.attach(context);
      await page.clock.setFixedTime(WED);
      await gotoReady(page, '/settings', 'Ajustes');
      await page.getByLabel('Clave de sincronización', { exact: true }).fill(E2E_SYNC_KEY);
      await button(page, 'Guardar clave').click();
      await expect(toast(page, 'Clave guardada.')).toBeVisible();
      await expect
        .poll(() => server.requestCount('/api/v1/sync'), { timeout: WAIT })
        .toBeGreaterThan(0);
      await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sincronizado', {
        timeout: WAIT,
      });
      await toCalendar(page);
      const onServer = (await server.records()).length;

      await context.setOffline(true);
      await expect(indicator(page)).toHaveAccessibleName(/^Sincronización: Sin conexión/, {
        timeout: WAIT,
      });
      const before = server.requestCount();

      await dayCell(page, 'martes, 3 de noviembre').click();
      await option(group(page, 'Tipo de actividad'), 'Natación').click();
      await field(page, 'Minutos').fill('45');
      await button(page, 'Guardar actividad').click();
      await expect(toast(page, 'Actividad guardada: Natación')).toBeVisible();
      await weekButton(page, '26 oct – 1 nov').click();
      await field(page, /^Peso medio/).fill('77');
      await button(page, 'Guardar peso').click();
      await expect(toast(page, /^Peso guardado · 26 oct\.?\s*–\s*1 nov$/)).toBeVisible();
      await expect(indicator(page)).toHaveAccessibleName(
        /^Sincronización: Sin conexión · \d+ pendientes?$/,
        { timeout: WAIT },
      );
      expect(server.requestCount(), 'no request while offline').toBe(before);

      // The page itself needs the network to reload (no service worker yet), so only /api/v1/
      // stays cut during the reload.
      const unreachable = (route: Route) => route.abort('internetdisconnected');
      await context.route('**/api/v1/**', unreachable);
      await context.setOffline(false);
      await page.reload();
      await expect(h1(page, 'Calendario')).toBeVisible();
      await expect(dayCell(page, 'martes, 3 de noviembre')).toHaveAccessibleName(
        'martes, 3 de noviembre, 1 actividad',
      );
      await weekButton(page, '26 oct – 1 nov').click();
      await expect(field(page, /^Peso medio/)).toHaveValue('77');
      await expect(indicator(page)).toHaveAccessibleName(/ · \d+ pendientes?$/, { timeout: WAIT });
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

  test(
    '390 px · the month grid (week button + 7 days) fits one row per week with no horizontal scroll, cells are at least 44 px high, 6-row and 4-row months render',
    { tag: '@all-engines' },
    async ({ page }) => {
      await openCalendarAt(page, WED);
      const width = viewportOf(page).width;
      expect(width).toBe(390);
      expect(await hasHorizontalScroll(page), 'horizontal scroll with no panel').toBe(false);

      const weeks = page.getByRole('button', { name: /^Semana \d/ });
      const days = page.getByRole('button', {
        name: /^(lunes|martes|miércoles|jueves|viernes|sábado|domingo), \d+ de /,
      });
      // November 2026 touches six weeks (26 Oct – 6 Dec): 6 week buttons and 42 cells.
      await expect(weeks).toHaveCount(6);
      await expect(days).toHaveCount(42);
      const items = [...(await weeks.all()), ...(await days.all())];
      const rows = new Map<number, number>();
      for (const item of items) {
        const box = await boxOf(item);
        expect(box.height, 'every cell and button is at least 44 px high').toBeGreaterThanOrEqual(
          43.9,
        );
        expect(box.x, 'inside the screen (left)').toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, 'inside the screen (right)').toBeLessThanOrEqual(width + 0.5);
        const row = Math.round(box.y / 4);
        rows.set(row, (rows.get(row) ?? 0) + 1);
      }
      expect(rows.size, 'six rows in November 2026').toBe(6);
      for (const count of rows.values()) expect(count, 'week button + 7 days per row').toBe(8);

      // The panels do not make the page scroll sideways either.
      await dayCell(page, 'martes, 3 de noviembre').click();
      await expect(field(page, 'Minutos')).toBeVisible();
      expect(await hasHorizontalScroll(page), 'horizontal scroll with the day panel').toBe(false);
      await weekButton(page, '2–8 nov').click();
      await expect(button(page, 'Descargar JSON de la semana')).toBeVisible();
      expect(await hasHorizontalScroll(page), 'horizontal scroll with the week panel').toBe(false);

      // February 2027 starts on a Monday and has 28 days: four rows.
      for (let i = 0; i < 3; i++) await button(page, 'Mes siguiente').click();
      await expect(monthHeading(page, 'febrero de 2027')).toBeVisible();
      await expect(weeks).toHaveCount(4);
      await expect(days).toHaveCount(28);
      await expect(page.getByText('Nada registrado este mes', { exact: true })).toBeVisible();
      expect(await hasHorizontalScroll(page), 'horizontal scroll in February 2027').toBe(false);
    },
  );
});
