import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  allUiText,
  expectTheme,
  findSpanishWords,
  gotoReady,
  h1,
  hasHorizontalScroll,
  mainNav,
  setLanguage,
  tileMetrics,
} from './helpers';

// Spec: docs/spec/progress.md (Phase 7, branch feature/progress). The device date is fixed to
// Wednesday 4 November 2026 with `page.clock.setFixedTime` before the first `goto` (it only fakes
// `Date`; no app timer is involved). There is no screen to plan a cycle, so the data is brought in
// through the real "Importar desde la app anterior" flow with a synthetic gym_app file built here
// with dates relative to that day. Nothing is written to IndexedDB by hand.
//
// The dataset (today = Wed 4 Nov, current week = 2-8 Nov, first session = Mon 5 Oct, so this is
// week 5 of the cycle):
//   5 Oct   Remo en T  75x10, 75x9, 75x8, 70x8        (best 1RM 100,0)   4 back sets
//   12 Oct  Remo en T  70x8, 70x8, 70x7               (best 1RM 88,7)    3 back sets
//   19 Oct  Dominadas  one extra set, 0 kg x 8 (bodyweight)              1 back set
//   26 Oct  Remo en T  deload session, 50x10 twice, week closed with a frozen plan
//                      (chest 5, back 2, shoulders 4, triceps 2, biceps 2 = 15)   2 back sets
//   2 Nov   Push       incline press 4 + 5 extra, flies 3 (+ a 0-rep set, + a warm-up)  12 chest, "¿Cómo llegas?" 4
//   3 Nov   Remo en T  90x5, 85x6, 80x8 (best 1RM 105,0), "¿Cómo llegas?" 3    3 back sets
//   Body weight: 12 Oct 81, 19 Oct 80,5, 26 Oct 80,2.

const TODAY = new Date(2026, 10, 4, 12, 0);

// ---------------------------------------------------------------------------------------------
// Synthetic gym_app backup
// ---------------------------------------------------------------------------------------------

interface SetDef {
  ex: string;
  slot: string;
  kind: string;
  w: number;
  r: number;
  rir?: number | null;
  band?: string;
}

interface SessionDef {
  id: string;
  date: string;
  tpl: string;
  sets: SetDef[];
  items?: unknown[];
  ready?: number;
  deload?: boolean;
}

const dayMs = (date: string): number => Date.parse(`${date}T10:00:00Z`);

function remoSets(rows: [number, number][]): SetDef[] {
  return rows.map(([w, r], i) => ({
    ex: 'remo-t',
    slot: `p${String(i)}`,
    kind: 'work',
    w,
    r,
    rir: 2,
  }));
}

const remoItem = (n: number): unknown[] => [
  { ex: 'remo-t', plan: [['work', '8-10', n]], rir: '1-2' },
];

const SESSIONS: SessionDef[] = [
  {
    id: 'ses_e2e_progress_01',
    date: '2026-10-05',
    tpl: 'libre',
    items: remoItem(4),
    sets: remoSets([
      [75, 10],
      [75, 9],
      [75, 8],
      [70, 8],
    ]),
  },
  {
    id: 'ses_e2e_progress_02',
    date: '2026-10-12',
    tpl: 'libre',
    items: remoItem(3),
    sets: remoSets([
      [70, 8],
      [70, 8],
      [70, 7],
    ]),
  },
  {
    id: 'ses_e2e_progress_03',
    date: '2026-10-19',
    tpl: 'libre',
    sets: [{ ex: 'dominadas', slot: 'x1', kind: 'extra', w: 0, r: 8, rir: 2, band: 'morada' }],
  },
  {
    id: 'ses_e2e_progress_04',
    date: '2026-10-26',
    tpl: 'libre',
    deload: true,
    items: remoItem(2),
    sets: remoSets([
      [50, 10],
      [50, 10],
    ]),
  },
  {
    id: 'ses_e2e_progress_05',
    date: '2026-11-02',
    tpl: 'push',
    ready: 4,
    items: [
      {
        ex: 'press-inclinado-mancuernas',
        plan: [
          ['aprox', '', 1],
          ['top', '6-8', 1],
          ['backoff', '8-10', 2],
        ],
        rir: '1-2',
      },
      { ex: 'aperturas-maquina', plan: [['work', '10-12', 3]], rir: '1-2' },
    ],
    sets: [
      { ex: 'press-inclinado-mancuernas', slot: 'w1', kind: 'warmup', w: 10, r: 10, rir: null },
      { ex: 'press-inclinado-mancuernas', slot: 'p0', kind: 'aprox', w: 20, r: 6, rir: null },
      { ex: 'press-inclinado-mancuernas', slot: 'p1', kind: 'top', w: 30, r: 8, rir: 1 },
      { ex: 'press-inclinado-mancuernas', slot: 'p2', kind: 'backoff', w: 27.5, r: 10, rir: 2 },
      { ex: 'press-inclinado-mancuernas', slot: 'p3', kind: 'backoff', w: 27.5, r: 9, rir: 2 },
      ...[1, 2, 3, 4, 5].map((n) => ({
        ex: 'press-inclinado-mancuernas',
        slot: `x${String(n)}`,
        kind: 'extra',
        w: 25,
        r: 10,
        rir: 2,
      })),
      { ex: 'aperturas-maquina', slot: 'p0', kind: 'work', w: 40, r: 12, rir: 2 },
      { ex: 'aperturas-maquina', slot: 'p1', kind: 'work', w: 40, r: 12, rir: 2 },
      { ex: 'aperturas-maquina', slot: 'p2', kind: 'work', w: 40, r: 12, rir: 2 },
      // 0 repetitions: not an effective set.
      { ex: 'aperturas-maquina', slot: 'x1', kind: 'extra', w: 40, r: 0, rir: null },
    ],
  },
  {
    id: 'ses_e2e_progress_06',
    date: '2026-11-03',
    tpl: 'libre',
    ready: 3,
    items: remoItem(3),
    sets: remoSets([
      [90, 5],
      [85, 6],
      [80, 8],
    ]),
  },
];

/** A gym_app full copy with the given sessions, their sets, the closed week and body weights. */
function gymBackup(sessions: SessionDef[], withWeights = true): Buffer {
  const records: object[] = [];
  for (const s of sessions) {
    records.push({
      id: s.id,
      t: 'session',
      u: dayMs(s.date) + 100,
      date: s.date,
      tpl: s.tpl,
      start: dayMs(s.date),
      end: dayMs(s.date) + 3_600_000,
      ...(s.items ? { items: s.items } : {}),
      ...(s.ready !== undefined ? { ready: s.ready } : {}),
      ...(s.deload ? { deload: true } : {}),
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
        rir: set.rir ?? null,
        ...(set.band ? { band: set.band } : {}),
        at: dayMs(s.date) + 1_000 * (i + 1),
      });
    });
  }
  if (sessions.some((s) => s.date === '2026-10-26')) {
    records.push({
      id: 'wk_2026-10-26',
      t: 'week',
      u: dayMs('2026-10-27'),
      week: '2026-10-26',
      hiking: false,
      deload: true,
      plan: {
        pecho: 5,
        espalda: 2,
        hombro: 4,
        cuadriceps: 0,
        femoral: 0,
        triceps: 2,
        biceps: 2,
        gemelo: 0,
        core: 0,
        antebrazo: 0,
      },
      total: 15,
      closedAt: dayMs('2026-11-02'),
    });
  }
  if (withWeights) {
    for (const [week, kg] of [
      ['2026-10-12', 81],
      ['2026-10-19', 80.5],
      ['2026-10-26', 80.2],
    ] as const) {
      records.push({ id: `bw_${week}`, t: 'bw', u: dayMs(week) + 500, week, kg });
    }
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

/** Opens Progreso / Progress from the bottom navigation. */
async function toProgress(page: Page, lang: 'es' | 'en' = 'es'): Promise<void> {
  const name = lang === 'es' ? 'Progreso' : 'Progress';
  await mainNav(page, lang).getByRole('link', { name, exact: true }).click();
  await expect(h1(page, name)).toBeVisible();
}

/** Fixes the date, imports `buffer` and opens the Progress page. */
async function seedAndOpen(page: Page, sessions: SessionDef[]): Promise<void> {
  await page.clock.setFixedTime(TODAY);
  await importBackup(page, gymBackup(sessions));
  await toProgress(page);
}

const HEADINGS = {
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

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The card of a section: the outermost ancestor of its heading that does not contain the heading
 * of any other section (the heading may carry a date, e.g. "Revisión del ciclo · 16 nov").
 */
function card(page: Page, heading: string, lang: 'es' | 'en' = 'es'): Locator {
  const others = HEADINGS[lang].filter((h) => h !== heading);
  const cond = others
    .map(
      (o) =>
        `.//*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5 or self::h6][starts-with(normalize-space(.), "${o}")]`,
    )
    .join(' or ');
  return page
    .getByRole('heading', { name: new RegExp(`^${escapeRe(heading)}`) })
    .first()
    .locator(`xpath=ancestor::*[not(${cond})][last()]`);
}

/** A row of the muscle-group bars: its text reads "Pecho: 12 de 13 series" (plus "plan cumplido"). */
function row(scope: Locator, text: RegExp): Locator {
  return scope.getByRole('listitem').filter({ hasText: text });
}

/** A chart: a figure whose image carries the description ("Peso corporal: gráfica de líneas, 3 puntos…"). */
function chart(scope: Locator, name: RegExp): Locator {
  return scope.getByRole('img', { name });
}

/** Opens the "Ver datos" / "Show data" disclosure of a card and returns its table. */
async function showData(scope: Locator, lang: 'es' | 'en' = 'es'): Promise<Locator> {
  await scope.getByText(lang === 'es' ? 'Ver datos' : 'Show data', { exact: true }).click();
  const table = scope.getByRole('table');
  await expect(table).toBeVisible();
  return table;
}

/** Rows of a table that hold data cells (the header row is left out). */
function dataRows(table: Locator): Locator {
  return table.getByRole('row').filter({ has: table.page().getByRole('cell') });
}

function group(scope: Page | Locator, name: string): Locator {
  return scope
    .getByRole('radiogroup', { name, exact: true })
    .or(scope.getByRole('group', { name, exact: true }));
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

test.describe('progress', () => {
  test(
    'AC-PRO-01 · empty page in both languages; with only a body weight the empty state stays and the weight card shows',
    { tag: '@all-engines' },
    async ({ page }) => {
      await page.clock.setFixedTime(TODAY);
      await gotoReady(page, '/progress', 'Progreso');
      const main = page.getByRole('main');
      await expect(page.getByText('Todavía no hay datos', { exact: true })).toBeVisible();
      await expect(
        page.getByText('Cuando registres tu primera sesión, aquí verás tu progreso.', {
          exact: true,
        }),
      ).toBeVisible();
      // No chart, no summary figure, no section card.
      await expect(page.getByRole('figure')).toHaveCount(0);
      await expect(main.getByText('Sesiones', { exact: true })).toHaveCount(0);
      for (const heading of HEADINGS.es) {
        await expect(page.getByRole('heading', { name: new RegExp(`^${heading}`) })).toHaveCount(0);
      }

      // English.
      await setLanguage(page, 'en');
      await toProgress(page, 'en');
      await expect(page.getByText('No data yet', { exact: true })).toBeVisible();
      await expect(
        page.getByText('Once you log your first session, your progress will show up here.', {
          exact: true,
        }),
      ).toBeVisible();
      await setLanguage(page, 'es');

      // Edge: only body weights on the device (no session at all).
      await importBackup(page, gymBackup([]));
      await toProgress(page);
      await expect(page.getByText('Todavía no hay datos', { exact: true })).toBeVisible();
      const body = card(page, 'Peso corporal');
      await expect(body).toBeVisible();
      await expect(chart(body, /^Peso corporal: gráfica de líneas, 3 puntos/)).toBeVisible();
      await expect(page.getByRole('heading', { name: /^Series por semana/ })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /^Revisión del ciclo/ })).toHaveCount(0);

      // Reload: the page only reads the device.
      await page.reload();
      await expect(h1(page, 'Progreso')).toBeVisible();
      await expect(card(page, 'Peso corporal')).toBeVisible();
    },
  );

  test(
    'AC-PRO-02 / 03 / 04 / 05 / 06 / 13 · summary, sets per group (this week, last week with its frozen plan, 4-week average) and the 12 weekly columns with "Ver datos"',
    { tag: '@all-engines' },
    async ({ page }) => {
      await seedAndOpen(page, SESSIONS);
      const main = page.getByRole('main');

      // AC-PRO-02 · summary.
      await expect(main).toContainText(/Semana\s*5\s*2\s*–\s*8 nov/);
      await expect(main).toContainText(/Series\s*15\s*\/\s*104\s*esta semana/);
      await expect(main).toContainText(/Sesiones\s*6\s*en total/);
      await expect(main).toContainText(/Récords\s*1\s*este mes/);

      // AC-PRO-03 · sets per group, this week (default).
      const groups = card(page, 'Series por grupo muscular');
      await expect(group(groups, 'Periodo')).toBeVisible();
      await expect(groups.getByRole('radio', { name: 'Esta semana', exact: true })).toBeChecked();
      await expect(groups.getByText(/^Semana 2\s*–\s*8 nov$/)).toBeVisible();
      await expect(row(groups, /Pecho: 12 de 13 series/)).toBeVisible();
      await expect(row(groups, /Espalda: 3 de 14 series/)).toBeVisible();
      await expect(row(groups, /series.*plan cumplido/i)).toHaveCount(0);
      for (const legend of ['Series hechas', 'Plan cumplido', 'Plan']) {
        await expect(groups.getByText(legend, { exact: true })).toBeVisible();
      }

      // AC-PRO-04 / 05 · last week: its range, its sets and the plan frozen when it closed.
      await groups.getByRole('radio', { name: 'Semana pasada', exact: true }).check();
      await expect(groups.getByText(/^Semana 26 oct\.?\s*–\s*1 nov · descarga$/)).toBeVisible();
      await expect(row(groups, /Pecho: 0 de 5 series/)).toBeVisible();
      await expect(row(groups, /Espalda: 2 de 2 series.*plan cumplido/i)).toBeVisible();

      // AC-PRO-04 · average of the four weeks before the current one, one decimal.
      await groups.getByRole('radio', { name: 'Media de 4 semanas', exact: true }).check();
      await expect(groups.getByText(/^4 semanas: 5 oct\.?\s*–\s*1 nov$/)).toBeVisible();
      await expect(row(groups, /Espalda: 2,5 de \d+(,\d)? series/)).toBeVisible();

      // AC-PRO-06 · twelve columns, oldest first (labels "17/8" … "2/11"); the description says
      // so and gives the scale up to the largest plan.
      const weekly = card(page, 'Series por semana');
      await expect(
        chart(weekly, /^Series por semana: gráfica de columnas, 12 semanas, de 0 a 104 series$/),
      ).toBeVisible();
      await expect(weekly).toContainText('2/11');
      for (const legend of ['Series hechas', 'Plan de esa semana']) {
        await expect(weekly.getByText(legend, { exact: true })).toBeVisible();
      }

      // AC-PRO-06 / 13 · the table has one row per week with the values of the column names
      // "<range>: <done> de <plan> series, <n> sesiones" (plan only from the start of the cycle).
      const table = await showData(weekly);
      await expect(dataRows(table)).toHaveCount(12);
      // The row header is the week; the cells are done, plan, sessions and minutes of activity.
      const cells = (text: RegExp) => dataRows(table).filter({ hasText: text }).getByRole('cell');
      await expect(cells(/2\s*–\s*8 nov/)).toHaveText(['15', '104', '2', '0']);
      await expect(cells(/26 oct\.?\s*–\s*1 nov/)).toHaveText(['2', '15', '1', '0']);
      // Before the cycle starts there is no plan (28 sep – 4 oct: 0 series, 0 sessions).
      await expect(cells(/28 sept?\.?\s*–\s*4 oct/)).toHaveText(['0', /^\D*$/, '0', '0']);

      // Reload mid-session: everything is computed again from the device.
      await page.reload();
      await expect(h1(page, 'Progreso')).toBeVisible();
      await expect(page.getByRole('main')).toContainText(/Series\s*15\s*\/\s*104\s*esta semana/);
    },
  );

  test(
    'AC-PRO-07 / 11 · exercise evolution (3 points, deload not drawn, pick remembered after reload) and the latest records',
    { tag: '@all-engines' },
    async ({ page }) => {
      await seedAndOpen(page, SESSIONS);
      const byExercise = card(page, 'Por ejercicio');
      const select = byExercise.getByRole('combobox', { name: 'Ejercicio', exact: true });
      const selectedText = () =>
        select.evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.text ?? '');

      // Only the four exercises with sessions, sorted by name; the first time, the most recent.
      await expect(select.locator('option')).toHaveCount(4);
      const names = await select.locator('option').allInnerTexts();
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
      await expect.poll(selectedText).toBe('Remo en T');
      await expect(
        byExercise.getByText('Mejor 1RM estimado de cada sesión (Epley).'),
      ).toBeVisible();
      await expect(byExercise.getByText('Las semanas de descarga no se dibujan.')).toBeVisible();
      await expect(byExercise.getByRole('link', { name: /^Ver ficha/ })).toHaveAttribute(
        'href',
        /\/exercises\/remo-t$/,
      );
      await expect(
        chart(byExercise, /^Remo en T: gráfica de líneas, 3 puntos, de 88,7 kg a 105 kg$/),
      ).toBeVisible();

      // AC-PRO-07 · three sessions with their best 1RM; the deload session (26 Oct) is not there.
      const table = await showData(byExercise);
      await expect(dataRows(table)).toHaveCount(3);
      await expect(table).toContainText(/5 oct\.?\W*100(,0)?(?:\s*kg)?(?!\d)/);
      await expect(table).toContainText(/12 oct\.?\W*88,7(?:\s*kg)?(?!\d)/);
      await expect(table).toContainText(/3 nov\.?\W*105(,0)?(?:\s*kg)?(?!\d)/);
      await expect(table).not.toContainText(/26 oct/);

      // A single session: one row. A bodyweight exercise counts repetitions.
      await select.selectOption({ label: 'Aperturas en máquina' });
      await expect(dataRows(byExercise.getByRole('table'))).toHaveCount(1);
      await expect(byExercise.getByRole('link', { name: /^Ver ficha/ })).toHaveAttribute(
        'href',
        /\/exercises\/aperturas-maquina$/,
      );
      await select.selectOption({ label: 'Dominadas' });
      await expect(byExercise.getByText('Repeticiones totales por sesión.')).toBeVisible();
      await select.selectOption({ label: 'Aperturas en máquina' });

      // The pick is remembered on this device.
      await page.reload();
      await expect(h1(page, 'Progreso')).toBeVisible();
      await expect
        .poll(() =>
          card(page, 'Por ejercicio')
            .getByRole('combobox', { name: 'Ejercicio' })
            .evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.text ?? ''),
        )
        .toBe('Aperturas en máquina');

      // AC-PRO-11 · the only record: Remo en T beat 75 kg with 90 kg on 3 Nov. First sessions only
      // set a baseline and the deload session never appears.
      const records = card(page, 'Últimos récords');
      const links = records.getByRole('link');
      await expect(links).toHaveCount(1);
      await expect(links.first()).toContainText('Remo en T');
      await expect(links.first()).toContainText(/3 nov\.?(?: 2026)?\W*peso máximo/);
      await expect(links.first()).toContainText(/90\s*kg/);
      await expect(links.first()).toContainText(/antes 75\s*kg/);
      await expect(links.first()).toHaveAttribute('href', /\/exercises\/remo-t$/);
      await expect(records).not.toContainText(/26 oct/);
    },
  );

  test('AC-PRO-08 / 12 / 13 · "How you feel" (3 and 4 in one week), body weight in 3 weeks, and the text equivalent of both', async ({
    page,
  }) => {
    await seedAndOpen(page, SESSIONS);

    // AC-PRO-08 · one point, the weekly average.
    const arrive = card(page, 'Cómo llegas a entrenar');
    await expect(
      arrive.getByText(
        'Media semanal de la nota (1 fatal · 5 a tope) que pones al empezar cada sesión.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      chart(arrive, /^Cómo llegas a entrenar: gráfica de líneas, 1 punto/),
    ).toBeVisible();
    const arriveTable = await showData(arrive);
    await expect(dataRows(arriveTable)).toHaveCount(1);
    // The value of the point: "2–8 nov: 3,5 de 5, 2 sesiones".
    await expect(dataRows(arriveTable).first()).toHaveText(/^\D*2\s*–\s*8 nov\D*3,5\D*2\D*$/);

    // AC-PRO-12 · three weeks of body weight; "Ver datos" lists them in kg.
    const body = card(page, 'Peso corporal');
    await expect(
      chart(body, /^Peso corporal: gráfica de líneas, 3 puntos, de 80,2 kg a 81 kg$/),
    ).toBeVisible();
    const bodyTable = await showData(body);
    await expect(dataRows(bodyTable)).toHaveCount(3);
    // Row header = the week, one cell = the weight (the unit is in the column header).
    await expect(dataRows(bodyTable).nth(0)).toContainText(/12\s*–\s*18 oct/);
    await expect(dataRows(bodyTable).nth(0).getByRole('cell')).toHaveText(['81']);
    await expect(dataRows(bodyTable).nth(1)).toContainText(/19\s*–\s*25 oct/);
    await expect(dataRows(bodyTable).nth(1).getByRole('cell')).toHaveText(['80,5']);
    await expect(dataRows(bodyTable).nth(2)).toContainText(/26 oct\.?\s*–\s*1 nov/);
    await expect(dataRows(bodyTable).nth(2).getByRole('cell')).toHaveText(['80,2']);

    // AC-PRO-13 · every chart has a description and a table; the group bars have neither
    // (their numbers are on screen).
    for (const heading of [
      'Series por semana',
      'Por ejercicio',
      'Cómo llegas a entrenar',
      'Peso corporal',
    ]) {
      const c = card(page, heading);
      await expect(c.getByText('Ver datos', { exact: true }), heading).toHaveCount(1);
      await expect(chart(c, /: gráfica de /), heading).toBeVisible();
    }
    await expect(
      card(page, 'Series por grupo muscular').getByText('Ver datos', { exact: true }),
    ).toHaveCount(0);
  });

  test('AC-PRO-09 · cycle review: Remo en T 100 → 105 kg, +5,0 %, "1 básico sube", days to go and the rule of thumb', async ({
    page,
  }) => {
    await seedAndOpen(page, SESSIONS);
    const review = card(page, 'Revisión del ciclo');
    await expect(
      page.getByRole('heading', { name: /^Revisión del ciclo\s*·?\s*16 nov/ }).first(),
    ).toBeVisible();
    await expect(review).toContainText(
      /Faltan 12 días\. Mientras tanto, esto compara tus 2 primeras semanas con la última:/,
    );

    const table = review.getByRole('table');
    await expect(table).toBeVisible();
    for (const column of ['Básico', 'Inicio', 'Ahora', 'Cambio']) {
      await expect(table.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
    }
    // Only the basic lift present in both windows; bodyweight and one-window lifts are left out.
    await expect(dataRows(table)).toHaveCount(1);
    const lift = dataRows(table).first();
    await expect(lift.getByRole('link', { name: 'Remo en T', exact: true })).toHaveAttribute(
      'href',
      /\/exercises\/remo-t$/,
    );
    await expect(lift).toContainText(/100/);
    await expect(lift).toContainText(/105/);
    // Soft: the spec asks for one decimal ("+5,0 %"); keep checking the rest if it differs.
    await expect.soft(lift).toContainText(/\+5,0\s*%/);
    await expect(review).toContainText(/1 básico sube\s*·\s*0 planos o bajando/);
    await expect(review).toContainText(
      'Pesos que suben y llegas con ganas → sigue igual. Estancado y te notas plano → recorta volumen. Estancado pero fresco → falta estímulo.',
    );
    // Nobody answered "¿Cómo llegas?" in the first two weeks: no comparison sentence.
    await expect(review).not.toContainText(/Cómo llegas:/);
    await expect(review).not.toContainText(/Aparecerá a partir de la cuarta semana/);
  });

  test('AC-PRO-10 · review not available yet in the third week of the cycle: message, no table, rule of thumb', async ({
    page,
  }) => {
    // The first session is Mon 19 Oct: 2 Nov is the third week of the cycle.
    await seedAndOpen(
      page,
      SESSIONS.filter((s) => s.date >= '2026-10-19'),
    );
    await expect(page.getByRole('main')).toContainText(/Semana\s*3\s*2\s*–\s*8 nov/);
    const review = card(page, 'Revisión del ciclo');
    await expect(review).toContainText(
      'Aparecerá a partir de la cuarta semana, cuando haya datos del principio y de la última semana.',
    );
    await expect(review.getByRole('table')).toHaveCount(0);
    await expect(review).toContainText('Pesos que suben y llegas con ganas');
  });

  test(
    'AC-PRO-14 · Evolution card of the exercise screen: metric choice, deload not drawn, bodyweight options, none without sessions',
    { tag: '@all-engines' },
    async ({ page }) => {
      await seedAndOpen(page, SESSIONS);
      await page.goto('/exercises/remo-t');
      await expect(page.getByRole('heading', { name: 'Remo en T', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Evolución', exact: true })).toBeVisible();

      const metric = group(page, 'Métrica');
      await expect(metric).toBeVisible();
      await expect(page.getByRole('radio', { name: '1RM estimado', exact: true })).toBeChecked();
      await page.getByText('Ver datos', { exact: true }).click();
      const table = page.getByRole('table');
      await expect(table).toBeVisible();
      await expect(dataRows(table)).toHaveCount(3);
      await expect(table).toContainText(/5 oct\.?\W*100(,0)?(?:\s*kg)?(?!\d)/);
      await expect(table).toContainText(/12 oct\.?\W*88,7(?:\s*kg)?(?!\d)/);
      await expect(table).toContainText(/3 nov\.?\W*105(,0)?(?:\s*kg)?(?!\d)/);
      await expect(table).not.toContainText(/26 oct/);

      await page.getByRole('radio', { name: 'Peso máximo', exact: true }).check();
      await expect(table).toContainText(/5 oct\.?\W*75(,0)?(?:\s*kg)?(?!\d)/);
      await expect(table).toContainText(/12 oct\.?\W*70(,0)?(?:\s*kg)?(?!\d)/);
      await expect(table).toContainText(/3 nov\.?\W*90(,0)?(?:\s*kg)?(?!\d)/);
      await expect(table).not.toContainText(/88,7/);

      await page.getByRole('radio', { name: 'Volumen', exact: true }).check();
      await expect(table).toContainText(/5 oct\.?\W*2\.?585(?:\s*kg)?(?!\d)/);
      await expect(table).toContainText(/12 oct\.?\W*1\.?610(?:\s*kg)?(?!\d)/);
      await expect(table).toContainText(/3 nov\.?\W*1\.?600(?:\s*kg)?(?!\d)/);
      await expect(dataRows(table)).toHaveCount(3);

      // A bodyweight exercise offers repetitions and volume instead.
      await page.goto('/exercises/dominadas');
      await expect(page.getByRole('heading', { name: 'Evolución', exact: true })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Repeticiones', exact: true })).toBeChecked();
      await expect(page.getByRole('radio', { name: 'Volumen', exact: true })).toBeVisible();
      await expect(page.getByRole('radio', { name: '1RM estimado', exact: true })).toHaveCount(0);
      await expect(page.getByRole('radio', { name: 'Peso máximo', exact: true })).toHaveCount(0);
      await page.getByText('Ver datos', { exact: true }).click();
      await expect(page.getByRole('table')).toContainText(/19 oct\.?\W*8\b/);
      await page.getByRole('radio', { name: 'Volumen', exact: true }).check();
      await expect(page.getByRole('radio', { name: 'Volumen', exact: true })).toBeChecked();
      // Bodyweight sets weigh 0 kg: nothing to draw for volume (spec §3).
      await expect(
        page.getByText('Aún no hay sesiones que dibujar con esta métrica.'),
      ).toBeVisible();
      await expect(page.getByRole('table')).toHaveCount(0);

      // An exercise never logged has no Evolution card.
      await page.goto('/exercises/rdl-maquina');
      await expect(page.getByText('Aún no has registrado este ejercicio')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Evolución', exact: true })).toHaveCount(0);
    },
  );

  test('AC-PRO-16 · chart text is 12 px at 390 px and at 1024 px, and the chart fills its card without scrolling sideways', async ({
    page,
  }) => {
    await seedAndOpen(page, SESSIONS);
    expect(page.viewportSize()?.width).toBe(390);
    const heads = ['Series por semana', 'Peso corporal'] as const;

    // Axis text as rendered: its font size times the scale the drawing is shown at.
    interface Measure {
      texts: number;
      sizes: number[];
      chartWidth: number;
      chartLeft: number;
      chartRight: number;
      cardLeft: number;
      cardRight: number;
      cardOverflows: boolean;
    }
    const measure = (heading: string): Promise<Measure> =>
      card(page, heading).evaluate((el): Measure => {
        const svg = Array.from(el.querySelectorAll('svg')).find(
          (s) => s.querySelector('text') !== null,
        );
        if (!svg) throw new Error('no chart with text in the card');
        const labels = Array.from(svg.querySelectorAll('text')).filter(
          (t) => t.textContent.trim() !== '',
        );
        const sizes = labels.map(
          (t) => parseFloat(getComputedStyle(t).fontSize) * (t.getScreenCTM()?.a ?? 1),
        );
        const s = svg.getBoundingClientRect();
        const c = el.getBoundingClientRect();
        return {
          texts: labels.length,
          sizes,
          chartWidth: s.width,
          chartLeft: s.left,
          chartRight: s.right,
          cardLeft: c.left,
          cardRight: c.right,
          cardOverflows: el.scrollWidth > el.clientWidth + 1,
        };
      });

    async function expectChartsOk(width: number): Promise<void> {
      for (const heading of heads) {
        const m = await measure(heading);
        const where = `${heading} at ${String(width)} px`;
        expect(m.texts, `${where}: axis labels`).toBeGreaterThan(0);
        for (const size of m.sizes) {
          expect(
            Math.abs(size - 12),
            `${where}: axis text is ${String(size)} px`,
          ).toBeLessThanOrEqual(0.5);
        }
        expect(m.chartLeft, `${where}: chart starts inside its card`).toBeGreaterThanOrEqual(
          m.cardLeft - 1,
        );
        expect(m.chartRight, `${where}: chart ends inside its card`).toBeLessThanOrEqual(
          m.cardRight + 1,
        );
        expect(m.chartWidth, `${where}: chart fills its card`).toBeGreaterThanOrEqual(
          (m.cardRight - m.cardLeft) * 0.8,
        );
        expect(m.cardOverflows, `${where}: card scrolls sideways`).toBe(false);
      }
      expect(await hasHorizontalScroll(page), `page scrolls sideways at ${String(width)} px`).toBe(
        false,
      );
    }

    await expect(chart(card(page, 'Series por semana'), /gráfica de columnas/)).toBeVisible();
    await expectChartsOk(390);
    const narrow = (await measure('Series por semana')).chartWidth;

    // Wider screen, resized live: the drawing grows, the text does not.
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect
      .poll(async () => (await measure('Series por semana')).chartWidth)
      .toBeGreaterThan(narrow + 100);
    await expectChartsOk(1024);

    // And when the page is opened at that width.
    await page.reload();
    await expect(h1(page, 'Progreso')).toBeVisible();
    await expect(chart(card(page, 'Series por semana'), /gráfica de columnas/)).toBeVisible();
    await expectChartsOk(1024);
  });

  test('AC-PRO-17 · in every summary tile the label, the number and the note share the left edge, and no number is bigger than the title', async ({
    page,
  }) => {
    await seedAndOpen(page, SESSIONS);
    const main = page.getByRole('main');
    await expect(main).toContainText(/Sesiones\s*6\s*en total/);

    // [label, start of the number, start of the note]
    const tiles = await tileMetrics(page, {
      Semana: ['Semana', '5', '2'],
      Series: ['Series', '15', 'esta semana'],
      Sesiones: ['Sesiones', '6', 'en total'],
      Récords: ['Récords', '1', 'este mes'],
    });
    const titleFont = await h1(page, 'Progreso').evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize),
    );
    for (const [label, tile] of Object.entries(tiles)) {
      const [labelLeft, numberLeft, noteLeft] = tile.parts;
      expect(labelLeft, `"${label}" tile is on screen`).not.toBeNaN();
      expect(numberLeft, `"${label}" tile has its number`).not.toBeNaN();
      expect(noteLeft, `"${label}" tile has its note`).not.toBeNaN();
      const base = labelLeft ?? NaN;
      expect(
        Math.abs((numberLeft ?? NaN) - base),
        `"${label}": number vs label left edge`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs((noteLeft ?? NaN) - base),
        `"${label}": note vs label left edge`,
      ).toBeLessThanOrEqual(1);
      for (const left of tile.lines) {
        expect(
          Math.abs(left - base),
          `"${label}": text lines ${tile.lines.join(', ')}`,
        ).toBeLessThanOrEqual(1);
      }
      expect(
        tile.maxFont,
        `"${label}": number is not bigger than the page title`,
      ).toBeLessThanOrEqual(titleFont + 0.5);
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test(
    'AC-PRO-15 · English and dark at 390 px: English texts, decimal point, no horizontal scroll with every table open, no serious axe issues in dark and light',
    { tag: '@all-engines' },
    async ({ page, browserName }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.clock.setFixedTime(TODAY);
      await importBackup(page, gymBackup(SESSIONS));
      await setLanguage(page, 'en');
      await toProgress(page, 'en');
      await expectTheme(page, 'dark');
      expect(page.viewportSize()?.width).toBe(390);
      const main = page.getByRole('main');

      // Summary and headings in English.
      await expect(main).toContainText(/Week\s*5\s*2\s*–\s*8 Nov/);
      await expect(main).toContainText(/Sets\s*15\s*\/\s*104\s*this week/);
      await expect(main).toContainText(/Sessions\s*6\s*in total/);
      await expect(main).toContainText(/Records\s*1\s*this month/);
      for (const heading of HEADINGS.en) {
        await expect(
          page.getByRole('heading', { name: new RegExp(`^${heading}`) }).first(),
          heading,
        ).toBeVisible();
      }

      // Groups, weekly chart, arrival and body weight in English, with a decimal point.
      const groups = card(page, 'Sets per muscle group', 'en');
      await expect(group(groups, 'Period')).toBeVisible();
      await expect(row(groups, /Chest: 12 of 13 sets/)).toBeVisible();
      await expect(groups.getByText(/^Week 2\s*–\s*8 Nov$/)).toBeVisible();
      await groups.getByRole('radio', { name: '4-week average', exact: true }).check();
      await expect(groups.getByText(/^4 weeks: 5 Oct\s*–\s*1 Nov$/)).toBeVisible();
      await expect(row(groups, /Back: 2\.5 of \d+(\.\d)? sets/)).toBeVisible();
      await expect(
        chart(card(page, 'Sets per week', 'en'), /^Sets per week: .*12 weeks/),
      ).toBeVisible();
      await expect(chart(card(page, 'How you feel', 'en'), /^How you feel: /)).toBeVisible();
      await expect(
        chart(card(page, 'Body weight', 'en'), /^Body weight: .*3 points/),
      ).toBeVisible();
      const review = card(page, 'Cycle review', 'en');
      await expect(review).toContainText(
        /12 days to go\. Meanwhile, this compares your first 2 weeks with the last one:/,
      );
      await expect.soft(review).toContainText(/\+5\.0\s*%/);
      await expect(review).toContainText(/1 lift going up\s*·\s*0 flat or going down/);
      await expect(card(page, 'Latest records', 'en')).toContainText(/max weight/);

      // Dark theme: no serious axe issue (once per theme).
      if (browserName === 'chromium') await axe(page, 'Progress (en, dark)');

      // 390 px: nothing scrolls sideways, not even with every "Show data" table open.
      expect(await hasHorizontalScroll(page), 'horizontal scroll (closed tables)').toBe(false);
      const toggles = await page.getByText('Show data', { exact: true }).all();
      expect(toggles.length).toBeGreaterThanOrEqual(4);
      for (const toggle of toggles) await toggle.click();
      await expect(page.getByRole('table').first()).toBeVisible();
      await expect(card(page, 'Body weight', 'en').getByRole('table')).toContainText(/80\.5/);
      await expect(card(page, 'How you feel', 'en').getByRole('table')).toContainText(/3\.5/);
      expect(await hasHorizontalScroll(page), 'horizontal scroll (open tables)').toBe(false);

      // No Spanish left on screen.
      const leftovers = findSpanishWords(await allUiText(page));
      expect(leftovers, `Spanish text left on Progress: ${leftovers.join(', ')}`).toEqual([]);

      // Light theme.
      await page.emulateMedia({ colorScheme: 'light' });
      await expectTheme(page, 'light');
      if (browserName === 'chromium') await axe(page, 'Progress (en, light)');
      expect(await hasHorizontalScroll(page), 'horizontal scroll (light)').toBe(false);
    },
  );
});
