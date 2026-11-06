import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoReady, h1, hasHorizontalScroll, mainNav } from './helpers';

// Spec: docs/spec/exercises.md (Phase 6, branch feature/exercise-catalog). Everything runs in
// Spanish on the 390x844 project viewport. No timers are waited for: toasts and dialogs are
// awaited by state.

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const TYPE = /^(Tipo de (la )?serie|Type of set)/;
const DONE = /^(Marcar serie hecha|Serie hecha|Mark set done|Set done)/;
const KG = /^(Peso|Lastre|Weight|Added)/i;
const REPS = /^(Repeticiones|Repetitions|Reps)/i;

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

function toast(page: Page, text: string): Locator {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first();
}

function button(scope: Page | Locator, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

function dialogOf(page: Page, name: string): Locator {
  return page
    .getByRole('dialog', { name, exact: true })
    .or(page.getByRole('alertdialog', { name, exact: true }));
}

/** The results list of the catalog. */
function list(page: Page): Locator {
  return page.getByRole('list', { name: 'Ejercicios', exact: true });
}

function items(page: Page): Locator {
  return list(page).getByRole('listitem');
}

/** The catalog item whose name is exactly `name`. */
function item(page: Page, name: string): Locator {
  return items(page).filter({ has: page.getByText(name, { exact: true }) });
}

function search(page: Page): Locator {
  return page.getByLabel('Buscar ejercicio', { exact: true });
}

function countLine(page: Page): Locator {
  return page.getByText(/^\d+ ejercicios?$/);
}

async function resultCount(page: Page): Promise<number> {
  const text = (await countLine(page).innerText()).trim();
  return Number(/^(\d+)/.exec(text)?.[1]);
}

/** First line of each catalog item (its name). */
async function itemNames(page: Page): Promise<string[]> {
  return items(page).evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).innerText.split('\n')[0]?.trim() ?? ''),
  );
}

async function openCatalog(page: Page): Promise<void> {
  await gotoReady(page, '/exercises', 'Ejercicios');
  await expect(list(page)).toBeVisible();
}

/** Picks an option of a single-choice field, whether it is a select or a set of radios/buttons. */
async function choose(page: Page, field: string, option: string): Promise<void> {
  const select = page.getByRole('combobox', { name: field, exact: true });
  if ((await select.count()) > 0) {
    await select.selectOption({ label: option });
    return;
  }
  await page
    .getByRole('radio', { name: option, exact: true })
    .or(page.getByRole('button', { name: option, exact: true }))
    .first()
    .click();
}

const NAME = (page: Page): Locator => page.getByLabel('Nombre', { exact: true });
const SETS = (page: Page): Locator => page.getByLabel('Series', { exact: true });
const REPS_FIELD = (page: Page): Locator => page.getByLabel('Repeticiones', { exact: true });
const RIR_FIELD = (page: Page): Locator => page.getByLabel('RIR', { exact: true });
const STEP = (page: Page): Locator => page.getByLabel('Incremento (kg)', { exact: true });

async function expectForm(page: Page, title = 'Crear ejercicio'): Promise<void> {
  await expect(h1(page, title)).toBeVisible();
  await expect(NAME(page)).toBeVisible();
}

async function fillForm(
  page: Page,
  o: { name: string; group?: string; equipment?: string },
): Promise<void> {
  await NAME(page).fill(o.name);
  if (o.group) await choose(page, 'Grupo principal', o.group);
  if (o.equipment) await choose(page, 'Equipo', o.equipment);
}

/** Creates an exercise from the catalog form and lands on its detail page. */
async function createExercise(
  page: Page,
  o: { name: string; group?: string; equipment?: string },
): Promise<void> {
  await page.goto('/exercises/new');
  await expectForm(page);
  await fillForm(page, o);
  await button(page, 'Guardar').click();
  await expect(toast(page, 'Ejercicio creado')).toBeVisible();
  await expect(detailTitle(page, o.name)).toBeVisible();
}

function detailTitle(page: Page, name: string): Locator {
  return page.getByRole('heading', { level: 2, name, exact: true });
}

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

async function logFirstSet(card: Locator, kg: string, reps: string): Promise<void> {
  const done = card.getByRole('button', { name: DONE }).first();
  await numberInput(card, KG).first().fill(kg);
  await numberInput(card, REPS).first().fill(reps);
  await done.click();
  await expect(card.getByRole('button', { name: DONE }).first()).toHaveAccessibleName(
    /^(Serie hecha|Set done)/,
  );
}

/** Starts a free session from Today and returns its URL. */
async function startFreeSession(page: Page): Promise<string> {
  await gotoReady(page, '/', 'Hoy');
  const other = await exCard(page, 'Otra sesión u otro día');
  await button(other, 'Sesión libre').click();
  await expect(page).toHaveURL(/\/session\/[^/]+$/);
  await expect(h1(page, 'Sesión')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sesión libre', exact: true })).toBeVisible();
  return page.url();
}

async function openAddSheet(page: Page): Promise<Locator> {
  await button(page, '+ Añadir ejercicio').click();
  const sheet = dialogOf(page, 'Añadir ejercicio');
  await expect(sheet).toBeVisible();
  return sheet;
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

const MSG = {
  name: 'Escribe un nombre',
  dup: 'Ya existe un ejercicio con ese nombre',
  long: 'El nombre puede tener hasta 80 caracteres',
  step: 'El incremento debe estar entre 0,25 y 50 kg',
  sets: 'Las series deben ser de 1 a 10',
  reps: 'Repeticiones no válidas: usa 10, ~10 u 8-12',
  rir: 'RIR no válido: usa 2 o 1-2, o déjalo vacío',
} as const;

// ---------------------------------------------------------------------------------------------
// Catalog (read-only, Chromium only)
// ---------------------------------------------------------------------------------------------

test.describe('exercise catalog', () => {
  test('AC-EXERCISES-01 / 02 · reach the catalog from Rutinas; the list is alphabetical with "Straps" on Remo en T; axe', async ({
    page,
  }) => {
    await gotoReady(page, '/', 'Hoy');
    await mainNav(page).getByRole('link', { name: 'Rutinas', exact: true }).click();
    await expect(h1(page, 'Rutinas')).toBeVisible();
    const sections = page.getByRole('navigation', { name: 'Rutinas y ejercicios', exact: true });
    await expect(sections.getByRole('link', { name: 'Rutinas', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await sections.getByRole('link', { name: 'Ejercicios', exact: true }).click();

    await expect(h1(page, 'Ejercicios')).toBeVisible();
    await expect(page).toHaveURL(/\/exercises$/);
    await expect(sections.getByRole('link', { name: 'Ejercicios', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(sections.getByRole('link', { name: 'Rutinas', exact: true })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(mainNav(page).getByRole('link', { name: 'Rutinas', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('link', { name: 'Crear ejercicio', exact: true })).toBeVisible();

    // AC-02: the seed catalog, alphabetical, with "<grupo> · <equipo>" and a matching count.
    await expect(items(page).first()).toBeVisible();
    const total = await items(page).count();
    expect(total).toBeGreaterThan(20);
    await expect(countLine(page)).toHaveText(`${String(total)} ejercicios`);
    expect(await resultCount(page)).toBe(total);
    const names = await itemNames(page);
    const collator = new Intl.Collator('es', { sensitivity: 'base' });
    for (let i = 1; i < names.length; i++) {
      expect(
        collator.compare(names[i - 1] ?? '', names[i] ?? ''),
        `"${names[i - 1] ?? ''}" should come before "${names[i] ?? ''}"`,
      ).toBeLessThanOrEqual(0);
    }
    const texts = await items(page).allInnerTexts();
    for (const t of texts) expect(t, 'group · equipment line').toMatch(/\S · \S/);

    const remo = item(page, 'Remo en T');
    await expect(remo).toBeVisible();
    await expect(remo.getByText('Straps', { exact: true })).toBeVisible();
    await expect(remo).toContainText('Espalda · ');
    const aperturas = item(page, 'Aperturas en máquina');
    await expect(aperturas).toBeVisible();
    await expect(aperturas.getByText('Straps', { exact: true })).toHaveCount(0);
    await expect(items(page).filter({ hasText: 'Propio' })).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);

    await axe(page, 'exercise catalog (light)');
  });

  test('AC-EXERCISES-03 / 04 · search ignores case and accents; combined filters', async ({
    page,
  }) => {
    await openCatalog(page);
    const all = await items(page).count();

    // AC-03
    await search(page).fill('REMO');
    await expect(item(page, 'Remo en T')).toBeVisible();
    await expect.poll(async () => (await items(page).count()) < all).toBe(true);
    for (const n of await itemNames(page)) expect(n.toLowerCase()).toContain('remo');
    await expect(countLine(page)).toHaveText(
      new RegExp(`^${String(await items(page).count())} ejercicios?$`),
    );
    await search(page).fill('maquina');
    await expect(item(page, 'Aperturas en máquina')).toBeVisible();
    await search(page).fill('zzz');
    await expect(page.getByText('Ningún ejercicio coincide', { exact: true })).toBeVisible();
    await expect(items(page)).toHaveCount(0);
    await search(page).fill('');
    await expect(items(page)).toHaveCount(all);

    // AC-04
    const espalda = button(page, 'Espalda');
    const straps = button(page, 'Straps');
    const dumbbell = button(page, 'Mancuernas');
    await expect(espalda).toHaveAttribute('aria-pressed', 'false');
    await espalda.click();
    await expect(espalda).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await items(page).count()) < all).toBe(true);
    const backOnly = await items(page).count();
    await straps.click();
    await expect(straps).toHaveAttribute('aria-pressed', 'true');
    await expect(item(page, 'Remo en T')).toBeVisible();
    const both = await items(page).allInnerTexts();
    expect(both.length).toBeGreaterThan(0);
    expect(both.length).toBeLessThanOrEqual(backOnly);
    for (const t of both) {
      expect(t).toContain('Espalda · ');
      expect(t).toMatch(/(^|\n)Straps(\n|$)/);
    }
    await dumbbell.click();
    await expect(dumbbell).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Ningún ejercicio coincide', { exact: true })).toBeVisible();
    await dumbbell.click();
    await expect(dumbbell).toHaveAttribute('aria-pressed', 'false');
    await expect(item(page, 'Remo en T')).toBeVisible();
    await straps.click();
    await expect(straps).toHaveAttribute('aria-pressed', 'false');
    await expect(espalda).toHaveAttribute('aria-pressed', 'true');
    await expect(items(page)).toHaveCount(backOnly);

    // The filters are not remembered.
    await page.reload();
    await expect(h1(page, 'Ejercicios')).toBeVisible();
    await expect(button(page, 'Espalda')).toHaveAttribute('aria-pressed', 'false');
    await expect(items(page)).toHaveCount(all);
  });
});

// ---------------------------------------------------------------------------------------------
// Everything below saves data
// ---------------------------------------------------------------------------------------------

test.describe('exercises · data', { tag: '@all-engines' }, () => {
  test('AC-EXERCISES-06 / 07 / 08 · never-logged message, change the weight step, invalid steps', async ({
    page,
  }) => {
    await openCatalog(page);
    await search(page).fill('dominadas');
    await item(page, 'Dominadas').getByRole('link').first().click();

    await expect(h1(page, 'Ejercicio')).toBeVisible();
    await expect(detailTitle(page, 'Dominadas')).toBeVisible();
    await expect(
      page.getByText('Aún no has registrado este ejercicio', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Récords', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Historial', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Editar', exact: true })).toHaveCount(0);
    await expect(button(page, 'Archivar')).toHaveCount(0);

    // AC-07
    await expect(STEP(page)).toBeVisible();
    await STEP(page).fill('5');
    await button(page, 'Guardar incremento').click();
    await expect(toast(page, 'Incremento guardado')).toBeVisible();
    await page.reload();
    await expect(detailTitle(page, 'Dominadas')).toBeVisible();
    await expect(STEP(page)).toHaveValue('5');

    // AC-08: 0 and 60 are refused and the saved step stays 5.
    for (const bad of ['0', '60']) {
      await STEP(page).fill(bad);
      await button(page, 'Guardar incremento').click();
      await expect(page.getByText(MSG.step, { exact: true })).toBeVisible();
      await page.reload();
      await expect(detailTitle(page, 'Dominadas')).toBeVisible();
      await expect(STEP(page)).toHaveValue('5');
    }
    await expect(page.getByText(MSG.step, { exact: true })).toHaveCount(0);
  });

  test('AC-EXERCISES-09 / 13 · create "Press landmine", find it with "Creados por mí", survives a reload; axe on the form and the detail page', async ({
    page,
    browserName,
  }) => {
    await openCatalog(page);
    const before = await items(page).count();
    await page.getByRole('link', { name: 'Crear ejercicio', exact: true }).click();
    await expectForm(page);
    await expect(page).toHaveURL(/\/exercises\/new$/);
    await expect(mainNav(page).getByRole('link', { name: 'Rutinas', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    if (browserName === 'chromium') await axe(page, 'exercise form (light)');
    expect(await hasHorizontalScroll(page)).toBe(false);

    await fillForm(page, { name: 'Press landmine', group: 'Hombro', equipment: 'Barra' });
    await button(page, 'Guardar').click();

    await expect(toast(page, 'Ejercicio creado')).toBeVisible();
    await expect(detailTitle(page, 'Press landmine')).toBeVisible();
    await expect(h1(page, 'Ejercicio')).toBeVisible();
    await expect(page.getByRole('main').getByText('Propio', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editar', exact: true })).toBeVisible();
    await expect(button(page, 'Archivar')).toBeVisible();
    await expect(page.getByText('En ninguna rutina', { exact: true })).toBeVisible();
    await expect(page.getByText('Aún no has registrado este ejercicio')).toBeVisible();
    if (browserName === 'chromium') await axe(page, 'exercise detail (light)');

    await page.getByRole('link', { name: 'Volver a Ejercicios', exact: true }).click();
    await expect(h1(page, 'Ejercicios')).toBeVisible();
    await expect(items(page)).toHaveCount(before + 1);
    const mine = item(page, 'Press landmine');
    await expect(mine).toContainText('Hombro · Barra');
    await expect(mine.getByText('Propio', { exact: true })).toBeVisible();

    await button(page, 'Creados por mí').click();
    await expect(button(page, 'Creados por mí')).toHaveAttribute('aria-pressed', 'true');
    await expect(items(page)).toHaveCount(1);
    await expect(countLine(page)).toHaveText('1 ejercicio');
    await expect(item(page, 'Press landmine')).toBeVisible();

    // AC-13
    await page.reload();
    await expect(h1(page, 'Ejercicios')).toBeVisible();
    await expect(items(page)).toHaveCount(before + 1);
    await search(page).fill('landmine');
    await expect(item(page, 'Press landmine')).toContainText('Hombro · Barra');
  });

  test('AC-EXERCISES-10 / 11 · empty, duplicate and wrong values are refused and nothing is saved', async ({
    page,
  }) => {
    await openCatalog(page);
    const before = await items(page).count();
    await page.getByRole('link', { name: 'Crear ejercicio', exact: true }).click();
    await expectForm(page);

    // AC-10
    await button(page, 'Guardar').click();
    await expect(page.getByText(MSG.name, { exact: true })).toBeVisible();
    await expect(NAME(page)).toBeFocused();
    await expect(NAME(page)).toHaveAccessibleDescription(MSG.name);
    await expect(page).toHaveURL(/\/exercises\/new$/);

    for (const dup of ['REMO EN T', 'remo en t']) {
      await NAME(page).fill(dup);
      await button(page, 'Guardar').click();
      await expect(page.getByText(MSG.dup, { exact: true })).toBeVisible();
      await expect(NAME(page)).toBeFocused();
      await expect(page).toHaveURL(/\/exercises\/new$/);
    }

    await NAME(page).fill('a'.repeat(81));
    await button(page, 'Guardar').click();
    await expect(page.getByText(MSG.long, { exact: true })).toBeVisible();

    // AC-11: every wrong field shows its own message; the first one gets the focus.
    await NAME(page).fill('Ejercicio inválido');
    await SETS(page).fill('0');
    await REPS_FIELD(page).fill('abc');
    await RIR_FIELD(page).fill('x');
    await STEP(page).fill('0');
    await button(page, 'Guardar').click();
    await expect(page.getByText(MSG.sets, { exact: true })).toBeVisible();
    await expect(page.getByText(MSG.reps, { exact: true })).toBeVisible();
    await expect(page.getByText(MSG.rir, { exact: true })).toBeVisible();
    await expect(page.getByText(MSG.step, { exact: true })).toBeVisible();
    await expect(page.getByText(MSG.name, { exact: true })).toHaveCount(0);
    await expect(SETS(page)).toBeFocused();
    await expect(REPS_FIELD(page)).toHaveAccessibleDescription(MSG.reps);
    await expect(page).toHaveURL(/\/exercises\/new$/);

    // Sets 11 is also out of range.
    await SETS(page).fill('11');
    await button(page, 'Guardar').click();
    await expect(page.getByText(MSG.sets, { exact: true })).toBeVisible();

    // "Cancelar" leaves without saving or asking.
    await page.getByRole('link', { name: 'Cancelar', exact: true }).click();
    await expect(h1(page, 'Ejercicios')).toBeVisible();
    await expect(items(page)).toHaveCount(before);
    await search(page).fill('inválido');
    await expect(page.getByText('Ningún ejercicio coincide', { exact: true })).toBeVisible();
  });

  test('AC-EXERCISES-14 / 15 · create from a session: "Cancelar" adds nothing, "Guardar" adds the last card', async ({
    page,
  }) => {
    const sessionUrl = await startFreeSession(page);
    const main = page.getByRole('main');
    await expect(main.getByText('Sin ejercicios todavía.', { exact: true })).toBeVisible();

    // One exercise from the sheet first, so "last card" means something.
    let sheet = await openAddSheet(page);
    await search(page).fill('remo en t');
    await sheet.getByText('Remo en T').first().click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Remo en T', exact: true })).toBeVisible();

    // Cancel: back in the session, nothing added.
    sheet = await openAddSheet(page);
    await button(sheet, 'Crear ejercicio')
      .or(sheet.getByRole('link', { name: 'Crear ejercicio' }))
      .click();
    await expectForm(page);
    await NAME(page).fill('No me guardes');
    await page.getByRole('link', { name: 'Cancelar', exact: true }).click();
    await expect(page).toHaveURL(sessionUrl);
    await expect(h1(page, 'Sesión')).toBeVisible();
    expect(await exerciseOrder(page)).toEqual(['Remo en T']);
    await expect(page.getByText('Ejercicio creado y añadido a la sesión')).toHaveCount(0);

    // Save: the new exercise is the last card, with its toast.
    sheet = await openAddSheet(page);
    await button(sheet, 'Crear ejercicio')
      .or(sheet.getByRole('link', { name: 'Crear ejercicio' }))
      .click();
    await expectForm(page);
    await fillForm(page, { name: 'Curl landmine', group: 'Bíceps' });
    await button(page, 'Guardar').click();

    await expect(page).toHaveURL(sessionUrl);
    await expect(toast(page, 'Ejercicio creado y añadido a la sesión')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Curl landmine', exact: true })).toBeVisible();
    expect(await exerciseOrder(page)).toEqual(['Remo en T', 'Curl landmine']);
    await expect(main.getByText(/^2 ejercicios · \d+ series$/)).toBeVisible();

    // It is now a normal exercise of the catalog, marked as mine.
    await page.reload();
    await expect(h1(page, 'Sesión')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Curl landmine', exact: true })).toBeVisible();
    expect(await exerciseOrder(page)).toEqual(['Remo en T', 'Curl landmine']);
    await openCatalog(page);
    await expect(item(page, 'Curl landmine').getByText('Propio', { exact: true })).toBeVisible();
  });

  test('AC-EXERCISES-16 / 17 · edit a created exercise used in a session; seed exercises cannot be edited', async ({
    page,
  }) => {
    // Create it from a free session and log one set.
    await startFreeSession(page);
    const sheet = await openAddSheet(page);
    await button(sheet, 'Crear ejercicio')
      .or(sheet.getByRole('link', { name: 'Crear ejercicio' }))
      .click();
    await expectForm(page);
    await fillForm(page, { name: 'Press landmine', group: 'Hombro', equipment: 'Barra' });
    await button(page, 'Guardar').click();
    await expect(toast(page, 'Ejercicio creado y añadido a la sesión')).toBeVisible();
    const card = await exCard(page, 'Press landmine');
    expect(await card.getByRole('button', { name: TYPE }).count()).toBe(3);
    await logFirstSet(card, '40', '8');

    // Open it from the catalog (in-app navigation) and edit it.
    await mainNav(page).getByRole('link', { name: 'Rutinas', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Rutinas y ejercicios', exact: true })
      .getByRole('link', { name: 'Ejercicios', exact: true })
      .click();
    await expect(h1(page, 'Ejercicios')).toBeVisible();
    await item(page, 'Press landmine').getByRole('link').first().click();
    await expect(detailTitle(page, 'Press landmine')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Historial', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /40 × 8/ })).toBeVisible();

    await page.getByRole('link', { name: 'Editar', exact: true }).click();
    await expectForm(page, 'Editar ejercicio');
    await expect(NAME(page)).toHaveValue('Press landmine');
    await fillForm(page, { name: 'Press landmine unilateral', equipment: 'Mancuernas' });
    await button(page, 'Guardar').click();

    await expect(toast(page, 'Cambios guardados')).toBeVisible();
    await expect(detailTitle(page, 'Press landmine unilateral')).toBeVisible();
    await expect(page.getByRole('main').getByText('Mancuernas').first()).toBeVisible();
    // The history keeps the sets under the new name.
    const entry = page.getByRole('link', { name: /40 × 8/ });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page).toHaveURL(/\/session\/[^/]+$/);
    const renamed = await exCard(page, 'Press landmine unilateral');
    await expect(numberInput(renamed, KG).first()).toHaveValue('40');
    await expect(numberInput(renamed, REPS).first()).toHaveValue('8');
    await expect(page.getByRole('heading', { name: 'Press landmine', exact: true })).toHaveCount(0);

    // AC-17: seed exercises show neither "Editar" nor "Archivar".
    await page.goto('/exercises/remo-t');
    await expect(detailTitle(page, 'Remo en T')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editar', exact: true })).toHaveCount(0);
    await expect(button(page, 'Archivar')).toHaveCount(0);
    await expect(STEP(page)).toBeVisible();
    await page.goto('/exercises/remo-t/edit');
    await expect(detailTitle(page, 'Remo en T')).toBeVisible();
    await expect(h1(page, 'Ejercicio')).toBeVisible();
    await expect(NAME(page)).toHaveCount(0);
    await expect(mainNav(page).getByRole('link', { name: 'Rutinas', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('AC-EXERCISES-18 / 19 · cancel keeps it; archive hides it from the list and the session sheet; unarchive restores it', async ({
    page,
  }) => {
    await createExercise(page, { name: 'Press landmine', group: 'Hombro', equipment: 'Barra' });
    const detailUrl = page.url();

    // It is offered by the session sheet while active ("Hombro · Barra").
    const sessionUrl = await startFreeSession(page);
    let sheet = await openAddSheet(page);
    await sheet.getByLabel('Buscar ejercicio', { exact: true }).fill('landmine');
    await expect(sheet).toContainText('Press landmine');
    await expect(sheet).toContainText('Hombro · Barra');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // AC-19: Cancelar and Escape leave it as it was.
    await page.goto(detailUrl);
    await expect(detailTitle(page, 'Press landmine')).toBeVisible();
    for (const how of ['Cancelar', 'Escape'] as const) {
      await button(page, 'Archivar').click();
      const dlg = dialogOf(page, '¿Archivar este ejercicio?');
      await expect(dlg).toBeVisible();
      await expect(dlg).toContainText('Su historial se conserva');
      if (how === 'Cancelar') await button(dlg, 'Cancelar').click();
      else await page.keyboard.press('Escape');
      await expect(dlg).toBeHidden();
      await expect(button(page, 'Archivar')).toBeVisible();
      await expect(page.getByText('Archivado', { exact: true })).toHaveCount(0);
    }

    // AC-18: confirm.
    await button(page, 'Archivar').click();
    await button(dialogOf(page, '¿Archivar este ejercicio?'), 'Archivar').click();
    await expect(toast(page, 'Ejercicio archivado')).toBeVisible();
    await expect(page.getByRole('main').getByText('Archivado', { exact: true })).toBeVisible();
    await expect(button(page, 'Desarchivar')).toBeVisible();
    await expect(button(page, 'Archivar')).toHaveCount(0);

    await openCatalog(page);
    await search(page).fill('landmine');
    await expect(page.getByText('Ningún ejercicio coincide', { exact: true })).toBeVisible();
    await button(page, 'Mostrar archivados').click();
    await expect(button(page, 'Mostrar archivados')).toHaveAttribute('aria-pressed', 'true');
    const archived = item(page, 'Press landmine');
    await expect(archived).toBeVisible();
    await expect(archived.getByText('Archivado', { exact: true })).toBeVisible();
    await expect(archived.getByText('Propio', { exact: true })).toBeVisible();

    // Not offered by the session sheet any more.
    await page.goto(sessionUrl);
    await expect(h1(page, 'Sesión')).toBeVisible();
    sheet = await openAddSheet(page);
    await sheet.getByLabel('Buscar ejercicio', { exact: true }).fill('landmine');
    await expect(sheet.getByText('Ningún ejercicio coincide', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // Unarchive (no dialog) and it is listed again without the switch.
    await page.goto(detailUrl);
    await expect(page.getByRole('main').getByText('Archivado', { exact: true })).toBeVisible();
    await button(page, 'Desarchivar').click();
    await expect(toast(page, 'Ejercicio restaurado')).toBeVisible();
    await expect(button(page, 'Archivar')).toBeVisible();
    await expect(page.getByText('Archivado', { exact: true })).toHaveCount(0);
    await openCatalog(page);
    await search(page).fill('landmine');
    await expect(item(page, 'Press landmine')).toBeVisible();
    await expect(item(page, 'Press landmine').getByText('Archivado', { exact: true })).toHaveCount(
      0,
    );
  });
});
