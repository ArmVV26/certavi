import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectTheme, gotoReady, h1, hasHorizontalScroll, mainNav, setLanguage } from './helpers';

// Spec: docs/spec/training-stats.md (AC-STA-01..08), with docs/spec/progress.md and today.md for
// context. The device date is Wednesday 4 November 2026 (`page.clock.install` before the first
// `goto`; time keeps flowing, no app timer is waited for). The data comes in through the real
// "Importar desde la app anterior" flow with a synthetic gym_app file built here; the only thing
// written through the UI is the "No cuenta para la progresión" mark of AC-STA-06 (it does not
// exist in gym_app). Current week = Mon 2 - Sun 8 Nov 2026; current month = November.

const TODAY = new Date(2026, 10, 4, 12, 0);
const DEBOUNCE = 2_000;

// ---------------------------------------------------------------------------------------------
// Synthetic gym_app backup
// ---------------------------------------------------------------------------------------------

interface SetDef {
  ex: string;
  slot: string;
  kind: string;
  w: number;
  r: number;
  band?: string;
}

interface SessionDef {
  id: string;
  date: string;
  sets: SetDef[];
  /** gym_app plan items: needed for the session screen to show the exercises. */
  items?: unknown[];
}

const dayMs = (date: string): number => Date.parse(`${date}T10:00:00Z`);

/** `n` effective work sets of one exercise. */
function work(ex: string, w: number, r: number, n: number): SetDef[] {
  return Array.from({ length: n }, (_, i) => ({
    ex,
    slot: `p${String(i)}`,
    kind: 'work',
    w,
    r,
  }));
}

/** One session of a date with the given sets (no sets = an empty session). */
function session(date: string, sets: SetDef[], suffix = ''): SessionDef {
  return { id: `ses_e2e_stats_${date.replaceAll('-', '')}${suffix}`, date, sets };
}

/** A session with a single effective set: enough to make its week active. */
const light = (date: string, suffix = ''): SessionDef =>
  session(date, work('remo-t', 50, 10, 1), suffix);

function gymBackup(sessions: SessionDef[]): Buffer {
  const records: object[] = [];
  for (const s of sessions) {
    records.push({
      id: s.id,
      t: 'session',
      u: dayMs(s.date) + 100,
      date: s.date,
      tpl: 'libre',
      start: dayMs(s.date),
      end: dayMs(s.date) + 3_600_000,
      ...(s.items ? { items: s.items } : {}),
    });
    s.sets.forEach((set, i) => {
      records.push({
        id: `st_${s.id}_${set.ex}_${set.slot}`,
        t: 'set',
        u: dayMs(s.date) + 1_000 * (i + 1),
        sid: s.id,
        ex: set.ex,
        slot: set.slot,
        kind: set.kind,
        w: set.w,
        r: set.r,
        rir: null,
        ...(set.band ? { band: set.band } : {}),
        at: dayMs(s.date) + 1_000 * (i + 1),
      });
    });
  }
  return Buffer.from(
    JSON.stringify({
      app: 'winter-arc',
      version: 2,
      exportedAt: '2026-11-04T10:00:00.000Z',
      records,
    }),
  );
}

// The shared dataset of the figures tests. Weeks (Mon-Sun):
//   14-20 Sep   remo 60x10 x2                               1.200 kg · 1 ex · 2 sets · 1 session
//   26 Oct-1 Nov  Mon 26 Oct remo 50x10 x1 + Sun 1 Nov remo 70x10 x2
//                                                           1.900 kg · 2 ex · 3 sets · 2 sessions
//   2-8 Nov     Mon 2 Nov remo 80x5 x3 + aperturas 60x10 x2 2.400 kg · 2 ex · 5 sets · 1 session
// Months: Sep 1.200 (1·2·1) · Oct 500 (1·1·1) · Nov 1.400 + 2.400 = 3.800 kg, 3 ex, 7 sets, 2 sessions
// (Sunday 1 Nov belongs to the week of 26 Oct and to the month of November).
const FIGURES: SessionDef[] = [
  session('2026-09-14', work('remo-t', 60, 10, 2)),
  session('2026-10-26', work('remo-t', 50, 10, 1)),
  session('2026-11-01', work('remo-t', 70, 10, 2)),
  session('2026-11-02', [...work('remo-t', 80, 5, 3), ...work('aperturas-maquina', 60, 10, 2)]),
];

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** Imports a gym_app file from "Ajustes" (Spanish UI) and waits for the confirmation. */
async function importBackup(page: Page, buffer: Buffer): Promise<void> {
  await gotoReady(page, '/settings', 'Ajustes');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar desde la app anterior', exact: true }).click();
  await (await chooser).setFiles({ name: 'gym-e2e.json', mimeType: 'application/json', buffer });
  const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(
    page
      .getByText(/^Registros importados: \d+$/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(dialog).toBeHidden();
}

async function toProgress(page: Page, lang: 'es' | 'en' = 'es'): Promise<void> {
  const name = lang === 'es' ? 'Progreso' : 'Progress';
  await mainNav(page, lang).getByRole('link', { name, exact: true }).click();
  await expect(h1(page, name)).toBeVisible();
}

async function toToday(page: Page, lang: 'es' | 'en' = 'es'): Promise<void> {
  const name = lang === 'es' ? 'Hoy' : 'Today';
  await mainNav(page, lang).getByRole('link', { name, exact: true }).click();
  await expect(h1(page, name)).toBeVisible();
}

/** Installs the clock on the fixed date, imports the sessions and opens Progreso. */
async function seedAndOpen(page: Page, sessions: SessionDef[]): Promise<void> {
  await page.clock.install({ time: TODAY });
  await importBackup(page, gymBackup(sessions));
  await toProgress(page);
}

const OTHER_HEADINGS = {
  es: [
    'Series por grupo muscular',
    'Series por semana',
    'Por ejercicio',
    'Cómo llegas a entrenar',
    'Revisión del ciclo',
    'Últimos récords',
    'Peso corporal',
  ],
  en: [
    'Sets per muscle group',
    'Sets per week',
    'By exercise',
    'How you feel',
    'Cycle review',
    'Latest records',
    'Body weight',
  ],
} as const;

/** The "Entrenamiento" / "Training" card: outermost ancestor of its heading without other cards. */
function statsCard(page: Page, lang: 'es' | 'en' = 'es'): Locator {
  const title = lang === 'es' ? 'Entrenamiento' : 'Training';
  const cond = OTHER_HEADINGS[lang]
    .map(
      (o) =>
        `.//*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5 or self::h6][starts-with(normalize-space(.), "${o}")]`,
    )
    .join(' or ');
  return page
    .getByRole('heading', { name: title, exact: true })
    .first()
    .locator(`xpath=ancestor::*[not(${cond})][last()]`);
}

function dataRows(table: Locator): Locator {
  return table.getByRole('row').filter({ has: table.page().getByRole('cell') });
}

/** A choice of a group of options: a radio or a toggle button. */
function option(scope: Page | Locator, name: string): Locator {
  return scope
    .getByRole('radio', { name, exact: true })
    .or(scope.getByRole('button', { name, exact: true }));
}

function selected(scope: Page | Locator, name: string): Locator {
  return scope
    .getByRole('radio', { name, exact: true, checked: true })
    .or(scope.getByRole('button', { name, exact: true, pressed: true }));
}

async function openData(card: Locator, lang: 'es' | 'en' = 'es'): Promise<Locator> {
  await card.getByText(lang === 'es' ? 'Ver datos' : 'Show data', { exact: true }).click();
  const table = card.getByRole('table');
  await expect(table).toBeVisible();
  return table;
}

/** The three figures of the card: each label and its value share the same parent element. */
async function expectFigures(
  card: Locator,
  labels: [string, string, string],
  values: [string, string, string],
): Promise<void> {
  for (const [i, label] of labels.entries()) {
    const figure = card.getByText(label, { exact: true }).first().locator('xpath=..');
    const value = (values[i] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*');
    await expect(figure, label).toHaveText(new RegExp(`^${label}\\s*${value}$`));
  }
}

async function axe(page: Page, label: string): Promise<void> {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  // `label-content-name-mismatch` is switched off: the day links of "Esta semana" in Hoy (a
  // feature of an earlier phase, not of this one) are named "Monday 2: …" while their visible
  // text is the short "Mon". It is reported as a suggestion, not tested here.
  const results = await new AxeBuilder({ page })
    .disableRules(['label-content-name-mismatch'])
    .analyze();
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

test.describe('training statistics', () => {
  test(
    'AC-STA-01 · three active weeks in a row: card position, "3 semanas", best streak, same figure in Hoy; a week without session breaks it and future sessions do not count',
    { tag: '@all-engines' },
    async ({ page }) => {
      // Active weeks: 14 Sep, 21 Sep, 28 Sep, 5 Oct | (12 Oct has no session) | 19 Oct, 26 Oct, 2 Nov.
      // Two sessions in the week of 26 Oct (count once for the streak). Two sessions dated in the
      // weeks after the current one (planned ahead) must not lengthen anything.
      await seedAndOpen(page, [
        light('2026-09-16'),
        light('2026-09-24'),
        light('2026-09-29'),
        light('2026-10-07'),
        light('2026-10-22'),
        light('2026-10-30'),
        light('2026-10-31', 'b'),
        light('2026-11-03'),
        light('2026-11-10'),
        light('2026-11-18'),
      ]);
      const card = statsCard(page);
      await expect(card).toBeVisible();
      await expect(card).toContainText(/Racha\s*3 semanas/);
      await expect(card.getByText('Mejor racha: 4 semanas', { exact: true })).toBeVisible();
      await expect(card.getByText('Entrena esta semana', { exact: false })).toHaveCount(0);

      // The card sits right after the summary and before "Series por grupo muscular".
      const heading = page.getByRole('heading', { name: 'Entrenamiento', exact: true });
      const next = page.getByRole('heading', { name: /^Series por grupo muscular/ });
      const summary = page.getByRole('main').getByText('Sesiones', { exact: true }).first();
      const y = async (l: Locator): Promise<number> => (await l.boundingBox())?.y ?? NaN;
      expect(await y(summary)).toBeLessThan(await y(heading));
      expect(await y(heading)).toBeLessThan(await y(next));

      // Reload mid-session: computed again from the device.
      await page.reload();
      await expect(h1(page, 'Progreso')).toBeVisible();
      await expect(statsCard(page)).toContainText(/Racha\s*3 semanas/);

      // Hoy shows the same figure in "Esta semana"; it is not a link.
      await toToday(page);
      await expect(page.getByRole('main')).toContainText(/Racha\s*3 semanas/);
      await expect(page.getByRole('link', { name: /Racha/ })).toHaveCount(0);
    },
  );

  test(
    'AC-STA-02 / 03 · the current week without a (counting) session keeps the streak at "2 semanas"; warm-ups and an activity alone do not make it active',
    { tag: '@all-engines' },
    async ({ page }) => {
      // Active weeks: 21 Sep, 28 Sep, 5 Oct (a run of 3) | 12 Oct missing | 19 Oct, 26 Oct.
      // The current week only has a session with a warm-up: it does not count.
      await seedAndOpen(page, [
        light('2026-09-23'),
        light('2026-09-30'),
        light('2026-10-06'),
        light('2026-10-21'),
        light('2026-10-28'),
        session('2026-11-02', [{ ex: 'remo-t', slot: 'w1', kind: 'warmup', w: 40, r: 10 }]),
      ]);
      const card = statsCard(page);
      await expect(card).toContainText(/Racha\s*2 semanas/);
      await expect(
        card.getByText('Entrena esta semana para mantenerla', { exact: true }),
      ).toBeVisible();
      await expect(card.getByText(/^Mejor racha/)).toHaveCount(0);

      // Hoy shows the same; saving an activity (swimming) does not make the week active.
      await toToday(page);
      await expect(page.getByRole('main')).toContainText(/Racha\s*2 semanas/);
      await option(page.getByRole('main'), 'Natación').first().click();
      await page
        .getByRole('textbox', { name: 'Minutos', exact: true })
        .or(page.getByRole('spinbutton', { name: 'Minutos', exact: true }))
        .fill('45');
      await page.getByRole('button', { name: 'Guardar actividad de hoy', exact: true }).click();
      await expect(page.getByText('Hoy: Natación 45 min', { exact: true })).toBeVisible();
      await expect(page.getByRole('main')).toContainText(/Racha\s*2 semanas/);

      await toProgress(page);
      await expect(statsCard(page)).toContainText(/Racha\s*2 semanas/);
      await expect(
        statsCard(page).getByText('Entrena esta semana para mantenerla', { exact: true }),
      ).toBeVisible();
    },
  );

  test(
    'AC-STA-04 / 07 · week figures (2.400 kg, 2 exercises, 5 sets), the 12-week chart and its "Ver datos" table',
    { tag: '@all-engines' },
    async ({ page }) => {
      await seedAndOpen(page, FIGURES);
      const card = statsCard(page);
      await expect(card.getByRole('heading', { name: 'Entrenamiento', exact: true })).toBeVisible();

      // "Resumen por" defaults to "Semana"; the subtitle is the current week.
      await expect(
        card
          .getByRole('radiogroup', { name: 'Resumen por', exact: true })
          .or(card.getByRole('group', { name: 'Resumen por', exact: true })),
      ).toBeVisible();
      await expect(selected(card, 'Semana')).toBeVisible();
      await expect(card.getByText(/^Semana\s*2\s*–\s*8 nov$/)).toBeVisible();

      // AC-STA-04: the three figures, in that order.
      await expectFigures(card, ['Peso levantado', 'Ejercicios', 'Series'], ['2.400 kg', '2', '5']);

      // The chart: 12 weeks, oldest first, labelled "d/m", with the legend and a column name.
      await expect(card.getByRole('img', { name: /12 semanas/ })).toBeVisible();
      await expect(card).toContainText('2/11');
      await expect(card).toContainText('14/9');
      await expect(card.getByText('Peso levantado', { exact: true }).last()).toBeVisible();
      // The name of a column (spec: "2–8 nov: 2.400 kg, 2 ejercicios, 5 series") is in the chart
      // as text (an SVG <title>); it is not exposed as an aria-label.
      await expect(card).toContainText(/2\s*–\s*8 nov: 2\.400 kg, 2 ejercicios, 5 series/);

      // AC-STA-07: one row per week with weight, exercises, sets and sessions.
      const table = await openData(card);
      await expect(dataRows(table)).toHaveCount(12);
      const cells = (text: RegExp): Locator =>
        dataRows(table).filter({ hasText: text }).getByRole('cell');
      await expect(cells(/2\s*–\s*8 nov/)).toHaveText([/^2\.400(\s*kg)?$/, '2', '5', '1']);
      await expect(cells(/26 oct\.?\s*–\s*1 nov/)).toHaveText([/^1\.900(\s*kg)?$/, '2', '3', '2']);
      await expect(cells(/14\s*–\s*20 sep/)).toHaveText([/^1\.200(\s*kg)?$/, '1', '2', '1']);
      // A week without sessions: all zeros.
      await expect(cells(/5\s*–\s*11 oct/)).toHaveText([/^0(\s*kg)?$/, '0', '0', '0']);

      // Reload: the default choice is back and the figures are the same.
      await page.reload();
      await expect(h1(page, 'Progreso')).toBeVisible();
      await expect(statsCard(page)).toContainText(/Peso levantado\s*2\.400\s*kg/);
    },
  );

  test(
    'AC-STA-05 · "Mes" adds the weeks of November (3.800 kg, 3 exercises, 7 sets) and the chart shows 6 months',
    { tag: '@all-engines' },
    async ({ page }) => {
      await seedAndOpen(page, FIGURES);
      const card = statsCard(page);
      await expect(card).toContainText(/Peso levantado\s*2\.400\s*kg/);

      await option(card, 'Mes').click();
      await expect(selected(card, 'Mes')).toBeVisible();
      await expect(card.getByText('noviembre de 2026', { exact: true })).toBeVisible();
      await expectFigures(card, ['Peso levantado', 'Ejercicios', 'Series'], ['3.800 kg', '3', '7']);
      await expect(card.getByRole('img', { name: /6 meses/ })).toBeVisible();
      await expect(card).toContainText('nov');
      await expect(card).not.toContainText('2/11');

      const table = await openData(card);
      await expect(dataRows(table)).toHaveCount(6);
      const cells = (text: RegExp): Locator =>
        dataRows(table).filter({ hasText: text }).getByRole('cell');
      await expect(cells(/nov/i)).toHaveText([/^3\.800(\s*kg)?$/, '3', '7', '2']);
      await expect(cells(/oct/i)).toHaveText([/^500(\s*kg)?$/, '1', '1', '1']);
      await expect(cells(/sep/i)).toHaveText([/^1\.200(\s*kg)?$/, '1', '2', '1']);

      // Back to "Semana": the week figures and 12 rows again.
      await option(card, 'Semana').click();
      await expect(card).toContainText(/Peso levantado\s*2\.400\s*kg/);
      await expect(card.getByRole('img', { name: /12 semanas/ })).toBeVisible();
    },
  );

  test(
    'AC-STA-06 · warm-ups, empty sets and bodyweight add no weight; an exercise marked "No cuenta" keeps its exercise and sets but loses its weight',
    { tag: '@all-engines' },
    async ({ page }) => {
      // Monday 2 Nov: remo (warm-up 40x10 + 2 x 80x5), pull-ups 0 kg x 8 (bodyweight),
      // aperturas (2 x 40x10 + a set with 0 repetitions).
      await seedAndOpen(page, [
        {
          ...session('2026-11-02', [
            { ex: 'remo-t', slot: 'w1', kind: 'warmup', w: 40, r: 10 },
            ...work('remo-t', 80, 5, 2),
            { ex: 'dominadas', slot: 'x1', kind: 'extra', w: 0, r: 8, band: 'morada' },
            ...work('aperturas-maquina', 40, 10, 2),
            { ex: 'aperturas-maquina', slot: 'x1', kind: 'extra', w: 40, r: 0 },
          ]),
          items: [
            { ex: 'remo-t', plan: [['work', '8-10', 2]], rir: '1-2' },
            { ex: 'aperturas-maquina', plan: [['work', '10-12', 2]], rir: '1-2' },
          ],
        },
      ]);
      // 800 (remo) + 800 (aperturas); warm-up, 0 reps and bodyweight add nothing.
      // Exercises: 3. Sets: 2 + 1 + 2 = 5 (neither the warm-up nor the empty set).
      await expectFigures(
        statsCard(page),
        ['Peso levantado', 'Ejercicios', 'Series'],
        ['1.600 kg', '3', '5'],
      );

      // Mark Aperturas as "No cuenta para la progresión" in its session (opened from Hoy).
      await toToday(page);
      await page.getByRole('link', { name: /^lunes 2:/ }).click();
      await expect(page).toHaveURL(/\/session\/[^/]+$/);
      const heading = page.getByRole('heading', { name: 'Aperturas en máquina', exact: true });
      await expect(heading).toBeVisible();
      const exCard = page.locator('article').filter({ has: heading });
      // The cards of a finished session are closed: open the exercise first.
      await heading.getByRole('button').click();
      await exCard.getByRole('button', { name: 'Nota', exact: true }).click();
      const skip = exCard.getByRole('checkbox', {
        name: 'No cuenta para la progresión',
        exact: true,
      });
      await skip.click();
      await expect(skip).toBeChecked();
      await page.clock.runFor(DEBOUNCE);
      await expect(exCard.getByRole('button', { name: 'Nota ✎', exact: true })).toBeVisible();

      // The figures update by themselves: the weight of Aperturas is gone, but not the exercise
      // nor its sets.
      await toProgress(page);
      await expectFigures(
        statsCard(page),
        ['Peso levantado', 'Ejercicios', 'Series'],
        ['800 kg', '3', '5'],
      );

      // It survives a reload.
      await page.reload();
      await expect(h1(page, 'Progreso')).toBeVisible();
      await expect(statsCard(page)).toContainText(/Peso levantado\s*800\s*kg/);
    },
  );

  test(
    'AC-STA-01 edge · no sessions: no card; only an old 0 kg session: streak 0 with its note, 0 kg figures, "Resumen por" forgotten after reload, Hoy shows 0',
    { tag: '@all-engines' },
    async ({ page }) => {
      await page.clock.install({ time: TODAY });
      await gotoReady(page, '/progress', 'Progreso');
      await expect(page.getByText('Todavía no hay datos', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Entrenamiento', exact: true })).toHaveCount(
        0,
      );

      // Only a bodyweight session (0 kg) five weeks ago.
      await importBackup(
        page,
        gymBackup([
          session('2026-10-05', [
            { ex: 'dominadas', slot: 'x1', kind: 'extra', w: 0, r: 8, band: 'morada' },
          ]),
        ]),
      );
      await toProgress(page);
      const card = statsCard(page);
      await expect(card).toBeVisible();
      await expect(card).toContainText(/Racha\s*0/);
      await expect(
        card.getByText('Entrena esta semana para empezar una', { exact: true }),
      ).toBeVisible();
      await expectFigures(card, ['Peso levantado', 'Ejercicios', 'Series'], ['0 kg', '0', '0']);
      await expect(card.getByRole('img', { name: /12 semanas/ })).toBeVisible();

      // The choice is only remembered while the screen is open.
      await option(card, 'Mes').click();
      await expect(selected(card, 'Mes')).toBeVisible();
      await page.reload();
      await expect(h1(page, 'Progreso')).toBeVisible();
      await expect(selected(statsCard(page), 'Semana')).toBeVisible();

      await toToday(page);
      await expect(page.getByRole('main')).toContainText(/Racha\s*0(?!\d)/);
    },
  );

  test(
    'AC-STA-08 · English, dark then light at 390 px: every text in English, no horizontal scroll (also with the table open), no serious axe issue in Progress and Today',
    { tag: '@all-engines' },
    async ({ page, browserName }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.clock.install({ time: TODAY });
      // Streak: 26 Oct and 2 Nov are active, 19 Oct is not -> 2 weeks, best 2.
      await importBackup(page, gymBackup(FIGURES));
      await setLanguage(page, 'en');
      await toProgress(page, 'en');
      await expectTheme(page, 'dark');
      expect(page.viewportSize()?.width).toBe(390);

      const card = statsCard(page, 'en');
      await expect(card.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
      await expect(card).toContainText(/Streak\s*2 weeks/);
      await expect(card.getByText('Best streak: 2 weeks', { exact: true })).toBeVisible();
      await expect(
        card
          .getByRole('radiogroup', { name: 'Summary by', exact: true })
          .or(card.getByRole('group', { name: 'Summary by', exact: true })),
      ).toBeVisible();
      await expect(selected(card, 'Week')).toBeVisible();
      await expect(card.getByText(/^Week\s*2\s*–\s*8 Nov$/)).toBeVisible();
      await expectFigures(card, ['Weight lifted', 'Exercises', 'Sets'], ['2,400 kg', '2', '5']);
      await expect(card.getByRole('img', { name: /12 weeks/ })).toBeVisible();
      await expect(card).toContainText(/2\s*–\s*8 Nov: 2,400 kg, 2 exercises, 5 sets/);

      const table = await openData(card, 'en');
      await expect(dataRows(table)).toHaveCount(12);
      expect(await hasHorizontalScroll(page), 'horizontal scroll (Progress, table open)').toBe(
        false,
      );

      await option(card, 'Month').click();
      await expect(card.getByText('November 2026', { exact: true })).toBeVisible();
      await expectFigures(card, ['Weight lifted', 'Exercises', 'Sets'], ['3,800 kg', '3', '7']);
      await expect(card.getByRole('img', { name: /6 months/ })).toBeVisible();
      expect(await hasHorizontalScroll(page), 'horizontal scroll (Progress, month)').toBe(false);

      // No Spanish left in the card.
      const text =
        (await card.evaluate((el) => (el as HTMLElement).innerText)) +
        '\n' +
        (await card.evaluate((el) =>
          Array.from(el.querySelectorAll('[aria-label],[title]'))
            .map((e) => `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('title') ?? ''}`)
            .join('\n'),
        ));
      expect(text).not.toMatch(
        /\b(Racha|Entrenamiento|Peso levantado|Ejercicios|Series|Resumen|Semana|Ver datos|Mejor|semanas|noviembre)\b/,
      );

      if (browserName === 'chromium') await axe(page, 'Progress (en, dark)');

      // Today, English, dark.
      await toToday(page, 'en');
      await expect(page.getByRole('main')).toContainText(/Streak\s*2 weeks/);
      expect(await hasHorizontalScroll(page), 'horizontal scroll (Today, dark)').toBe(false);
      expect(await page.getByRole('main').innerText()).not.toMatch(/\bRacha\b/);
      if (browserName === 'chromium') await axe(page, 'Today (en, dark)');

      // Light theme, both screens.
      await page.emulateMedia({ colorScheme: 'light' });
      await expectTheme(page, 'light');
      expect(await hasHorizontalScroll(page), 'horizontal scroll (Today, light)').toBe(false);
      if (browserName === 'chromium') await axe(page, 'Today (en, light)');
      await toProgress(page, 'en');
      await expect(statsCard(page, 'en')).toContainText(/Streak\s*2 weeks/);
      expect(await hasHorizontalScroll(page), 'horizontal scroll (Progress, light)').toBe(false);
      if (browserName === 'chromium') await axe(page, 'Progress (en, light)');
    },
  );
});
