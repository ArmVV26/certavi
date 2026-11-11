import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
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

// Spec: docs/spec/routines.md (Phase 6, branch feature/routine-editor). Spanish on the 390x844
// project viewport unless a test says otherwise. Nothing is waited for by time: toasts and
// dialogs are awaited by state. The device date is Monday 2 November 2026 where a test starts
// sessions (`page.clock.install` before the first `goto`).

const MON = new Date(2026, 10, 2, 9, 30);

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

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

function main(page: Page): Locator {
  return page.getByRole('main');
}

/** The links of the list of routines (one per routine). */
function routineLinks(page: Page): Locator {
  return page.locator('main a[href^="/routines/"]');
}

function routineLink(page: Page, name: string): Locator {
  return routineLinks(page).filter({ has: page.getByText(name, { exact: true }) });
}

/** Name of each routine in the list, in order (first line of each link). */
async function listedNames(page: Page): Promise<string[]> {
  return routineLinks(page).evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).innerText.split('\n')[0]?.trim() ?? ''),
  );
}

function summaryText(page: Page, text: string): Locator {
  return main(page).getByText(text, { exact: true });
}

/** The "Ejercicios de la rutina" list (viewer and editor). */
function exerciseList(page: Page, name = 'Ejercicios de la rutina'): Locator {
  return page.getByRole('list', { name, exact: true });
}

/** Viewer: the card of one exercise (its name is a level 4 heading, plain text). */
function viewerItem(page: Page, name: string, list = 'Ejercicios de la rutina'): Locator {
  return exerciseList(page, list)
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 4, name, exact: true }) });
}

/** Viewer: exercise names in order (the level 4 headings of the cards). */
async function viewerNames(page: Page, list = 'Ejercicios de la rutina'): Promise<string[]> {
  const headings = exerciseList(page, list).getByRole('heading', { level: 4 });
  await expect(headings.first()).toBeVisible();
  const names = await headings.allInnerTexts();
  return names.map((n) => n.trim());
}

/** Editor: the chips of "Ir a un ejercicio" (links or buttons, in order). */
function jumpChips(page: Page, name = 'Ir a un ejercicio'): Locator {
  return page.getByRole('navigation', { name, exact: true }).locator('a, button');
}

/** The chips as "<n> <name>" with the whitespace collapsed. */
async function chipTexts(page: Page): Promise<string[]> {
  const texts = await jumpChips(page).allInnerTexts();
  return texts.map((t) => t.replace(/\s+/g, ' ').trim());
}

function numbered(names: string[]): string[] {
  return names.map((n, i) => `${String(i + 1)} ${n}`);
}

/** Editor: exercise names in order (the level 3 headings). */
async function editorNames(page: Page): Promise<string[]> {
  const headings = main(page).getByRole('heading', { level: 3 });
  await expect(headings.first()).toBeVisible();
  const names = await headings.allInnerTexts();
  return names.map((n) => n.trim());
}

/** Editor: the group of one exercise (the outermost ancestor of its h3 holding no other h3). */
function exCard(page: Page, name: string): Locator {
  return page
    .getByRole('heading', { level: 3, name, exact: true })
    .locator('xpath=ancestor::*[count(.//h3) = 1][last()]');
}

function setRows(card: Locator): Locator {
  return card.getByRole('list', { name: 'Series', exact: true }).getByRole('listitem');
}

/** Reads "<n> ejercicios · <m> series" (the first one on the page). */
async function readSummary(page: Page): Promise<{ text: string; ex: number; sets: number }> {
  const el = main(page)
    .getByText(/^\d+ ejercicios? · \d+ series?$/)
    .first();
  await expect(el).toBeVisible();
  const text = (await el.innerText()).trim();
  const m = /^(\d+) ejercicios? · (\d+) series?$/.exec(text);
  return { text, ex: Number(m?.[1]), sets: Number(m?.[2]) };
}

async function openRoutine(page: Page, name: string): Promise<void> {
  await gotoReady(page, '/routines', 'Rutinas');
  await routineLink(page, name).click();
  await expect(h1(page, 'Rutina')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
}

async function openEditor(page: Page, name: string): Promise<void> {
  await openRoutine(page, name);
  await page.getByRole('link', { name: 'Editar', exact: true }).click();
  await expect(h1(page, 'Editar rutina')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
}

async function save(page: Page): Promise<void> {
  await button(page, 'Guardar').click();
  await expect(toast(page, 'Rutina guardada')).toBeVisible();
  await expect(h1(page, 'Rutina')).toBeVisible();
}

async function addToRoutine(page: Page, search: string, shown: string): Promise<void> {
  await button(page, 'Añadir ejercicio').click();
  const sheet = dialogOf(page, 'Añadir ejercicio');
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('Buscar ejercicio', { exact: true }).fill(search);
  await sheet.getByText(shown, { exact: true }).first().click();
  await expect(sheet).toBeHidden();
}

const REPS = (scope: Page | Locator, n: number): Locator =>
  scope.getByRole('textbox', { name: `Repeticiones de la serie ${String(n)}`, exact: true });

const EDITED = (page: Page): Locator => main(page).getByText('Editada', { exact: true });

// ---------------------------------------------------------------------------------------------
// List, viewer, unknown routine
// ---------------------------------------------------------------------------------------------

test.describe('routines · list and viewer', { tag: '@all-engines' }, () => {
  test('AC-ROUTINES-01 / 02 / 03 / 20 · the six routines in order, the viewer creates nothing, a link to the exercise, an unknown id', async ({
    page,
  }) => {
    await page.clock.install({ time: MON });
    await gotoReady(page, '/', 'Hoy');
    await mainNav(page).getByRole('link', { name: 'Rutinas', exact: true }).click();
    await expect(h1(page, 'Rutinas')).toBeVisible();

    // AC-01
    await expect(
      page.getByRole('heading', { level: 2, name: 'Tus rutinas', exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => listedNames(page))
      .toEqual(['Push', 'Pull', 'Lower B', 'Upper', 'Lower A', 'Lower Full']);
    const days = ['Lunes', 'Martes', 'Miércoles', 'Viernes', 'Domingo', 'Sin día fijo'];
    const texts = await routineLinks(page).allInnerTexts();
    texts.forEach((t, i) => {
      expect(t, `routine ${String(i)}`).toContain(days[i] ?? '?');
    });
    expect(texts[0]).toContain('7 ejercicios · 19 series');
    expect(texts[1]).toContain('8 ejercicios · 23 series');
    await expect(EDITED(page)).toHaveCount(0);
    const sections = page.getByRole('navigation', { name: 'Rutinas y ejercicios', exact: true });
    await expect(sections.getByRole('link', { name: 'Rutinas', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(mainNav(page).getByRole('link', { name: 'Rutinas', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await hasHorizontalScroll(page), 'horizontal scroll on the list').toBe(false);

    // AC-02
    await routineLink(page, 'Push').click();
    await expect(h1(page, 'Rutina')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Push', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver a Rutinas', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editar', exact: true })).toBeVisible();
    await expect(button(page, 'Restaurar original')).toHaveCount(0);
    await expect(summaryText(page, '7 ejercicios · 19 series')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ejercicios', exact: true })).toBeVisible();
    expect(await viewerNames(page)).toHaveLength(7);
    await expect(viewerItem(page, 'Press inclinado con mancuernas')).toContainText(
      '1 top 6-8 + 2 back-off 8-10 · RIR 1-2',
    );
    expect(await hasHorizontalScroll(page), 'horizontal scroll on the viewer').toBe(false);

    // Opening a routine never creates a session.
    await mainNav(page).getByRole('link', { name: 'Hoy', exact: true }).click();
    await expect(h1(page, 'Hoy')).toBeVisible();
    await expect(button(page, 'Empezar Push')).toBeVisible();
    await expect(
      page
        .getByRole('button', { name: /^Continuar / })
        .or(page.getByRole('link', { name: /^Continuar / })),
    ).toHaveCount(0);

    // AC-03
    await mainNav(page).getByRole('link', { name: 'Rutinas', exact: true }).click();
    await routineLink(page, 'Push').click();
    await expect(h1(page, 'Rutina')).toBeVisible();
    const incline = viewerItem(page, 'Press inclinado con mancuernas');
    await expect(incline).toContainText('Pecho');
    // The name is plain text: the only link of the card is "Ver ficha de …".
    await expect(incline.getByRole('link')).toHaveCount(1);
    await expect(
      incline.getByRole('link', { name: 'Press inclinado con mancuernas', exact: true }),
    ).toHaveCount(0);
    const sheet = viewerItem(page, 'Aperturas en máquina').getByRole('link', {
      name: 'Ver ficha de Aperturas en máquina',
      exact: true,
    });
    await expect(sheet).toHaveAttribute('href', /\/exercises\/[^/]+$/);
    expect((await boxOf(sheet)).height, 'the link is at least 44 px high').toBeGreaterThanOrEqual(
      43.9,
    );
    await sheet.click();
    await expect(page).toHaveURL(/\/exercises\/[^/]+$/);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Aperturas en máquina', exact: true }),
    ).toBeVisible();
    await expect(main(page)).toContainText(/En rutinas[\s\S]*Push/);

    // AC-20
    for (const path of ['/routines/xyz', '/routines/xyz/edit']) {
      await page.goto(path);
      await expect(page.getByText('No encontramos esta rutina', { exact: true })).toBeVisible();
      await expect(main(page).locator('a[href="/routines"]')).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------------------------

test.describe('routines · editor structure', { tag: '@all-engines' }, () => {
  test('AC-ROUTINES-04 / 05 / 06 / 07 · add an exercise, one already in, remove and undo, reorder, save', async ({
    page,
  }) => {
    await openEditor(page, 'Push');
    expect(await hasHorizontalScroll(page), 'horizontal scroll on the editor').toBe(false);
    const base = await readSummary(page);
    expect(base.text).toBe('7 ejercicios · 19 series');
    expect(await editorNames(page)).toHaveLength(7);

    // AC-05: Press inclinado is already in the routine.
    await button(page, 'Añadir ejercicio').click();
    const sheet = dialogOf(page, 'Añadir ejercicio');
    await expect(sheet).toBeVisible();
    await sheet.getByLabel('Buscar ejercicio', { exact: true }).fill('inclinado');
    await expect(
      sheet
        .getByRole('button', { name: /Press inclinado con mancuernas/ })
        .getByText('Ya está en la rutina', { exact: true }),
    ).toBeVisible();
    await expect(
      sheet.getByRole('button', { name: /Press inclinado con mancuernas/ }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // AC-04: add Remo en T at the end.
    await addToRoutine(page, 'remo', 'Remo en T');
    const names = await editorNames(page);
    expect(names).toHaveLength(8);
    expect(names.at(-1)).toBe('Remo en T');
    const added = await readSummary(page);
    expect(added.ex).toBe(8);
    expect(added.sets).toBeGreaterThan(19);
    await save(page);
    await expect(summaryText(page, added.text)).toBeVisible();
    expect((await viewerNames(page)).at(-1)).toBe('Remo en T');
    await page.getByRole('link', { name: 'Volver a Rutinas', exact: true }).click();
    await expect(routineLink(page, 'Push')).toContainText(added.text);

    // AC-06: remove "Aperturas en máquina" and undo it.
    await routineLink(page, 'Push').click();
    await page.getByRole('link', { name: 'Editar', exact: true }).click();
    await expect(h1(page, 'Editar rutina')).toBeVisible();
    const before = await editorNames(page);
    const index = before.indexOf('Aperturas en máquina');
    expect(index).toBeGreaterThanOrEqual(0);
    await expect(setRows(exCard(page, 'Aperturas en máquina'))).toHaveCount(3);
    await button(page, 'Quitar Aperturas en máquina').click();
    await expect(page.getByRole('heading', { level: 3, name: 'Aperturas en máquina' })).toHaveCount(
      0,
    );
    await expect(toast(page, 'Aperturas en máquina quitado')).toBeVisible();
    expect((await readSummary(page)).sets).toBe(added.sets - 3);
    await button(page, 'Deshacer').click();
    expect(await editorNames(page)).toEqual(before);
    await expect(setRows(exCard(page, 'Aperturas en máquina'))).toHaveCount(3);
    expect((await readSummary(page)).sets).toBe(added.sets);

    // AC-07: reorder.
    await button(page, 'Bajar Press inclinado con mancuernas').click();
    const moved = await editorNames(page);
    expect(moved.slice(0, 2)).toEqual([
      'Press de pecho en máquina vertical',
      'Press inclinado con mancuernas',
    ]);
    await expect(button(page, `Subir ${moved[0] ?? ''}`)).toBeDisabled();
    await expect(button(page, `Bajar ${moved.at(-1) ?? ''}`)).toBeDisabled();
    await save(page);
    expect((await viewerNames(page)).slice(0, 2)).toEqual(moved.slice(0, 2));
  });

  test('AC-ROUTINES-08 · add and remove sets, up to the limit of 20', async ({ page }) => {
    await openEditor(page, 'Push');
    const aper = exCard(page, 'Aperturas en máquina');
    const base = await readSummary(page);
    await expect(setRows(aper)).toHaveCount(3);
    await button(aper, 'Añadir serie').click();
    await expect(setRows(aper)).toHaveCount(4);
    expect((await readSummary(page)).sets).toBe(base.sets + 1);
    await button(aper, 'Quitar serie 4').click();
    await expect(setRows(aper)).toHaveCount(3);
    await button(aper, 'Quitar serie 3').click();
    await button(aper, 'Quitar serie 2').click();
    await expect(setRows(aper)).toHaveCount(1);
    await expect(button(aper, 'Quitar serie 1')).toBeDisabled();
    // Real clicks were used above. The rest only fill the card up to the limit, so they are sent
    // as events: 19 real clicks, each with Playwright's stability checks, took the whole 60 s of
    // the test in WebKit on CI (2026-11-06), where frames are slow.
    const addSet = button(aper, 'Añadir serie');
    for (let i = 1; i < 20; i++) await addSet.dispatchEvent('click');
    await expect(setRows(aper)).toHaveCount(20);
    await expect(addSet).toBeDisabled();

    // Leave without saving.
    await button(page, 'Descartar').click();
    await button(dialogOf(page, '¿Descartar los cambios?'), 'Descartar cambios').click();
    await expect(h1(page, 'Rutina')).toBeVisible();
    await expect(summaryText(page, base.text)).toBeVisible();
  });

  test('AC-ROUTINES-22 · jump chips: all seven visible at 390 px, the last one focuses its heading below the header without changing anything, and they follow move / remove / undo / add', async ({
    page,
  }) => {
    await openEditor(page, 'Push');
    const names = await editorNames(page);
    expect(names).toHaveLength(7);
    const chips = jumpChips(page);
    await expect(chips).toHaveCount(7);
    await expect.poll(() => chipTexts(page)).toEqual(numbered(names));

    // All chips are on the screen: no sideways scroll, each one inside the 390 px width.
    const { width, height } = viewportOf(page);
    expect(width).toBe(390);
    expect(await hasHorizontalScroll(page), 'horizontal scroll with the chips').toBe(false);
    for (const chip of await chips.all()) {
      const box = await boxOf(chip);
      expect(box.x, 'chip inside the screen (left)').toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, 'chip inside the screen (right)').toBeLessThanOrEqual(width + 0.5);
    }

    // The last chip: the card comes into view, not under the header, and its heading has focus.
    const lastName = names[6] ?? '';
    await chips.last().click();
    const heading = page.getByRole('heading', { level: 3, name: lastName, exact: true });
    await expect(heading).toBeFocused();
    // In view and not covered by anything (the sticky header): polled, the scroll may be smooth.
    await expect
      .poll(
        () =>
          heading.evaluate((el, viewHeight) => {
            const r = el.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            const uncovered = top !== null && (top === el || el.contains(top));
            return uncovered && r.top >= 0 && r.bottom <= viewHeight;
          }, height),
        { message: 'the heading is in view and not under the header' },
      )
      .toBe(true);

    // Tapping a chip changed nothing: "Descartar" leaves without asking.
    await button(page, 'Descartar').click();
    await expect(h1(page, 'Rutina')).toBeVisible();
    await expect(dialogOf(page, '¿Descartar los cambios?')).toHaveCount(0);
    await page.getByRole('link', { name: 'Editar', exact: true }).click();
    await expect(h1(page, 'Editar rutina')).toBeVisible();

    // Moving an exercise changes the order and the numbers.
    await button(page, 'Bajar Press inclinado con mancuernas').click();
    await expect
      .poll(async () => (await chipTexts(page)).slice(0, 2))
      .toEqual(['1 Press de pecho en máquina vertical', '2 Press inclinado con mancuernas']);
    const moved = await editorNames(page);
    await expect.poll(() => chipTexts(page)).toEqual(numbered(moved));

    // Removing one takes its chip out and renumbers; "Deshacer" puts it back in its place.
    await button(page, 'Quitar Aperturas en máquina').click();
    const without = moved.filter((n) => n !== 'Aperturas en máquina');
    expect(without).toHaveLength(6);
    await expect.poll(() => chipTexts(page)).toEqual(numbered(without));
    await button(page, 'Deshacer').click();
    await expect.poll(() => chipTexts(page)).toEqual(numbered(moved));

    // Adding one appends its chip.
    await addToRoutine(page, 'remo', 'Remo en T');
    await expect.poll(() => chipTexts(page)).toEqual(numbered([...moved, 'Remo en T']));
  });

  test('AC-ROUTINES-09 / 10 · type, reps, RIR, optional and note', async ({ page }) => {
    // AC-09
    await openEditor(page, 'Push');
    const press = exCard(page, 'Press inclinado con mancuernas');
    await press
      .getByRole('combobox', { name: 'Tipo de la serie 1', exact: true })
      .selectOption({ label: 'Serie de trabajo' });
    await REPS(press, 1).fill('5');
    await press.getByRole('textbox', { name: 'RIR objetivo', exact: true }).fill('2');
    await save(page);
    await expect(viewerItem(page, 'Press inclinado con mancuernas')).toContainText(
      '1 × 5 + 2 back-off 8-10 · RIR 2',
    );

    // AC-10: Pull, "Remo en T" optional with a note.
    await openEditor(page, 'Pull');
    const remo = exCard(page, 'Remo en T');
    await remo.getByRole('checkbox', { name: 'Opcional', exact: true }).check();
    await remo.getByRole('textbox', { name: 'Nota', exact: true }).fill('Agarre ancho');
    await save(page);
    const item = viewerItem(page, 'Remo en T');
    await expect(item).toContainText('Opcional');
    await expect(item).toContainText('Agarre ancho');

    // A note that came with the app can be emptied.
    await openEditor(page, 'Lower B');
    const calf = exCard(page, 'Elevaciones de gemelo en hack');
    const note = calf.getByRole('textbox', { name: 'Nota', exact: true });
    await expect(note).not.toHaveValue('');
    const original = await note.inputValue();
    await note.fill('');
    await save(page);
    await expect(viewerItem(page, 'Elevaciones de gemelo en hack')).not.toContainText(
      original.slice(0, 20),
    );
  });

  test('AC-ROUTINES-11 · invalid values are not saved; an approach set may have no reps; a routine needs an exercise', async ({
    page,
  }) => {
    await openEditor(page, 'Push');
    const first = (await editorNames(page))[0] ?? '';
    const card = exCard(page, first);
    const reps = REPS(card, 1);
    const rir = card.getByRole('textbox', { name: 'RIR objetivo', exact: true });
    const alert = page
      .getByRole('alert')
      .filter({ hasText: 'Revisa la rutina: hay campos con errores' });

    await reps.fill('');
    await button(page, 'Guardar').click();
    await expect(alert).toBeVisible();
    await expect(card.getByText('Indica las repeticiones', { exact: true })).toBeVisible();
    await expect(reps).toBeFocused();
    await expect(h1(page, 'Editar rutina')).toBeVisible();

    await reps.fill('10-6');
    await button(page, 'Guardar').click();
    await expect(
      card.getByText('Escribe las repeticiones como 8, ~10 o 6-8', { exact: true }),
    ).toBeVisible();

    await reps.fill('6-8');
    await rir.fill('abc');
    await button(page, 'Guardar').click();
    await expect(card.getByText('Escribe el RIR como 2 o 1-2', { exact: true })).toBeVisible();
    await expect(h1(page, 'Editar rutina')).toBeVisible();

    // Fixed: an approach set with empty reps is valid.
    await rir.fill('1-2');
    await card
      .getByRole('combobox', { name: 'Tipo de la serie 1', exact: true })
      .selectOption({ label: 'Aproximación' });
    await reps.fill('');
    await save(page);
    await expect(viewerItem(page, first)).toContainText('aprox.');

    // A routine without exercises cannot be saved.
    await page.getByRole('link', { name: 'Editar', exact: true }).click();
    await expect(h1(page, 'Editar rutina')).toBeVisible();
    for (const name of await editorNames(page)) {
      await button(page, `Quitar ${name}`).click();
    }
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(0);
    await button(page, 'Guardar').click();
    await expect(
      page.getByText('La rutina necesita al menos un ejercicio', { exact: true }),
    ).toBeVisible();
    await expect(h1(page, 'Editar rutina')).toBeVisible();
    await expect(toast(page, 'Rutina guardada')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Leaving, reload, persistence
// ---------------------------------------------------------------------------------------------

test.describe('routines · leaving and persistence', { tag: '@all-engines' }, () => {
  test('AC-ROUTINES-12 / 13 / 14 · discard asks only with changes; tabs ask too; a reload loses the unsaved change', async ({
    page,
  }) => {
    await openEditor(page, 'Push');
    const editUrl = page.url();
    const base = await readSummary(page);
    const asked = dialogOf(page, '¿Descartar los cambios?');

    // No changes: "Descartar" goes to the viewer at once.
    await button(page, 'Descartar').click();
    await expect(h1(page, 'Rutina')).toBeVisible();
    await expect(asked).toHaveCount(0);

    // AC-12
    await page.getByRole('link', { name: 'Editar', exact: true }).click();
    await expect(h1(page, 'Editar rutina')).toBeVisible();
    await button(page, 'Quitar Aperturas en máquina').click();
    await button(page, 'Descartar').click();
    await expect(asked).toBeVisible();
    await expect(asked).toContainText('Tienes cambios sin guardar en esta rutina.');
    await expect(button(asked, 'Seguir editando')).toBeFocused();
    await button(asked, 'Seguir editando').click();
    await expect(asked).toBeHidden();
    await expect(h1(page, 'Editar rutina')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Aperturas en máquina' })).toHaveCount(
      0,
    );
    await button(page, 'Descartar').click();
    await button(asked, 'Descartar cambios').click();
    await expect(h1(page, 'Rutina')).toBeVisible();
    await expect(summaryText(page, base.text)).toBeVisible();
    expect(await viewerNames(page)).toContain('Aperturas en máquina');

    // AC-13: another tab of the bottom navigation.
    await page.getByRole('link', { name: 'Editar', exact: true }).click();
    await expect(h1(page, 'Editar rutina')).toBeVisible();
    await button(page, 'Quitar Aperturas en máquina').click();
    await mainNav(page).getByRole('link', { name: 'Calendario', exact: true }).click();
    await expect(asked).toBeVisible();
    await button(asked, 'Seguir editando').click();
    await expect(asked).toBeHidden();
    await expect(page).toHaveURL(editUrl);
    await expect(page.getByRole('heading', { level: 3, name: 'Aperturas en máquina' })).toHaveCount(
      0,
    );
    await mainNav(page).getByRole('link', { name: 'Calendario', exact: true }).click();
    await button(asked, 'Descartar cambios').click();
    await expect(h1(page, 'Calendario')).toBeVisible();

    // AC-14: reload in the middle (the browser's own warning is accepted).
    await page.goto(editUrl);
    await expect(h1(page, 'Editar rutina')).toBeVisible();
    await button(page, 'Quitar Aperturas en máquina').click();
    await expect(page.getByRole('heading', { level: 3, name: 'Aperturas en máquina' })).toHaveCount(
      0,
    );
    page.on('dialog', (d) => void d.accept());
    await page.reload();
    await expect(h1(page, 'Editar rutina')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: 'Aperturas en máquina' }),
    ).toBeVisible();
    expect((await readSummary(page)).text).toBe(base.text);
  });

  test('AC-ROUTINES-15 / 16 / 17 · a saved edit survives a reload without connection, new sessions use it, started ones keep theirs, the week follows', async ({
    page,
    context,
  }) => {
    await page.clock.install({ time: MON });
    await gotoReady(page, '/', 'Hoy');
    const todayCard = page
      .getByRole('heading', { name: /^Esta semana/ })
      .locator('xpath=ancestor::*[count(.//h2) = 1][last()]');
    await expect(todayCard).toContainText('0 / 104');

    // A Push session started before the edit.
    await button(page, 'Empezar Push').click();
    await expect(page).toHaveURL(/\/session\/[^/]+$/);
    await expect(main(page).getByText('7 ejercicios · 19 series', { exact: true })).toBeVisible();

    // AC-15: remove "Aperturas en máquina" and save.
    await openEditor(page, 'Push');
    await button(page, 'Quitar Aperturas en máquina').click();
    await save(page);
    await expect(EDITED(page)).toBeVisible();
    await expect(summaryText(page, '6 ejercicios · 16 series')).toBeVisible();
    await expect(button(page, 'Restaurar original')).toBeVisible();
    await page.getByRole('link', { name: 'Volver a Rutinas', exact: true }).click();
    await expect(routineLink(page, 'Push')).toContainText('Editada');
    await expect(routineLink(page, 'Push')).toContainText('6 ejercicios · 16 series');
    await expect(routineLink(page, 'Pull')).not.toContainText('Editada');

    // Reload with the network cut: the change is still there (the page has no service worker
    // yet, so only the API stays unreachable, as in today.spec.ts).
    const unreachable = (route: Route) => route.abort('internetdisconnected');
    await context.route('**/api/v1/**', unreachable);
    await page.reload();
    await expect(h1(page, 'Rutinas')).toBeVisible();
    await expect(routineLink(page, 'Push')).toContainText('Editada');
    await expect(routineLink(page, 'Push')).toContainText('6 ejercicios · 16 series');

    // AC-17: the week plans fewer sets.
    await mainNav(page).getByRole('link', { name: 'Hoy', exact: true }).click();
    await expect(h1(page, 'Hoy')).toBeVisible();
    await expect(todayCard).toContainText('Esta semana');
    await expect(todayCard).not.toContainText('0 / 104');
    const planned = Number(/\d+ \/ (\d+)/.exec(await todayCard.innerText())?.[1]);
    expect(planned).toBeLessThan(104);

    // AC-16: a new session of Push on another date has six exercises.
    await page.getByLabel('Fecha', { exact: true }).fill('2026-11-01');
    await button(
      page
        .getByRole('heading', { name: 'Otra sesión u otro día', exact: true })
        .locator('xpath=ancestor::*[count(.//h2) = 1][last()]'),
      'Push',
    ).click();
    await expect(page).toHaveURL(/\/session\/[^/]+$/);
    await expect(main(page).getByText('6 ejercicios · 16 series', { exact: true })).toBeVisible();
    await expect(main(page)).not.toContainText('Aperturas en máquina');

    // The session started before the edit keeps all of its exercises.
    await mainNav(page).getByRole('link', { name: 'Hoy', exact: true }).click();
    await expect(h1(page, 'Hoy')).toBeVisible();
    await page
      .getByRole('button', { name: 'Continuar Push', exact: true })
      .or(page.getByRole('link', { name: 'Continuar Push', exact: true }))
      .click();
    await expect(page).toHaveURL(/\/session\/[^/]+$/);
    await expect(main(page).getByText('7 ejercicios · 19 series', { exact: true })).toBeVisible();
    await expect(main(page)).toContainText('Aperturas en máquina');
  });

  test('AC-ROUTINES-18 / 19 · a routine with my own exercise; its exercise cannot be archived; restore the original', async ({
    page,
  }) => {
    // The exercise "Mi remo" (exercises.md).
    await page.goto('/exercises/new');
    await expect(h1(page, 'Crear ejercicio')).toBeVisible();
    await page.getByLabel('Nombre', { exact: true }).fill('Mi remo');
    for (const [field, option] of [
      ['Grupo principal', 'Hombro'],
      ['Equipo', 'Barra'],
    ] as const) {
      await page
        .getByRole('combobox', { name: field, exact: true })
        .selectOption({ label: option });
    }
    await button(page, 'Guardar').click();
    await expect(toast(page, 'Ejercicio creado')).toBeVisible();

    // AC-19: add it to Pull.
    await openEditor(page, 'Pull');
    await addToRoutine(page, 'mi remo', 'Mi remo');
    expect((await editorNames(page)).at(-1)).toBe('Mi remo');
    await save(page);
    expect((await viewerNames(page)).at(-1)).toBe('Mi remo');
    await viewerItem(page, 'Mi remo')
      .getByRole('link', { name: 'Ver ficha de Mi remo', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Mi remo', exact: true }),
    ).toBeVisible();
    await expect(main(page)).toContainText(/En rutinas[\s\S]*Pull/);
    await button(page, 'Archivar').click();
    const refused = dialogOf(page, 'No se puede archivar');
    await expect(refused).toBeVisible();
    await expect(refused).toContainText('Está en la rutina Pull. Quítalo de la rutina antes.');
    await button(refused, 'Entendido').click();
    await expect(refused).toBeHidden();

    // AC-18: restore (Pull is edited now).
    await openRoutine(page, 'Pull');
    await expect(EDITED(page)).toBeVisible();
    await button(page, 'Restaurar original').click();
    const dlg = dialogOf(page, '¿Restaurar la rutina original?');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText(
      'Se perderán los cambios que hiciste en Pull. Las sesiones ya empezadas no cambian.',
    );
    await expect(button(dlg, 'Cancelar')).toBeFocused();
    await button(dlg, 'Cancelar').click();
    await expect(dlg).toBeHidden();
    expect(await viewerNames(page)).toContain('Mi remo');
    await expect(EDITED(page)).toBeVisible();

    await button(page, 'Restaurar original').click();
    await button(dlg, 'Restaurar').click();
    await expect(toast(page, 'Rutina restaurada')).toBeVisible();
    await expect(summaryText(page, '8 ejercicios · 23 series')).toBeVisible();
    expect(await viewerNames(page)).not.toContain('Mi remo');
    await expect(EDITED(page)).toHaveCount(0);
    await expect(button(page, 'Restaurar original')).toHaveCount(0);
    await page.getByRole('link', { name: 'Volver a Rutinas', exact: true }).click();
    await expect(routineLink(page, 'Pull')).toContainText('8 ejercicios · 23 series');
    await expect(routineLink(page, 'Pull')).not.toContainText('Editada');
  });
});

// ---------------------------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------------------------

test.describe('routines · appearance', () => {
  test('AC-ROUTINES-21 · light and dark without serious axe issues on the list, viewer and editor; English texts without Spanish', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await gotoReady(page, '/routines', 'Rutinas');
    // An edited routine shows the tag too.
    await openEditor(page, 'Push');
    await button(page, 'Quitar Aperturas en máquina').click();
    await save(page);
    await page.getByRole('link', { name: 'Volver a Rutinas', exact: true }).click();

    const screens: { name: string; go: () => Promise<void> }[] = [
      { name: 'list', go: () => gotoReady(page, '/routines', 'Rutinas') },
      { name: 'viewer', go: () => openRoutine(page, 'Push') },
      { name: 'editor', go: () => openEditor(page, 'Push') },
    ];
    for (const mode of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: mode });
      for (const s of screens) {
        await s.go();
        await expectTheme(page, mode);
        expect(await hasHorizontalScroll(page), `horizontal scroll, ${s.name} ${mode}`).toBe(false);
        await axe(page, `${s.name} ${mode}`);
      }
    }
    await page.emulateMedia({ colorScheme: 'light' });

    // English.
    await setLanguage(page, 'en');
    await gotoReady(page, '/routines', 'Routines');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Your routines', exact: true }),
    ).toBeVisible();
    const texts = await routineLinks(page).allInnerTexts();
    expect(texts[0]).toContain('Monday');
    expect(texts[0]).toContain('Edited');
    expect(texts[0]).toContain('6 exercises · 16 sets');
    expect(texts[1]).toContain('Tuesday');
    expect(texts[5]).toContain('Any day');
    expect(findSpanishWords(await allUiText(page))).toEqual([]);

    await routineLink(page, 'Push').click();
    await expect(h1(page, 'Routine')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Routines', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
    await expect(button(page, 'Restore original')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Exercises', exact: true })).toBeVisible();
    const firstCard = exerciseList(page, 'Routine exercises').getByRole('listitem').first();
    await expect(firstCard.getByRole('heading', { level: 4 })).toBeVisible();
    await expect(firstCard).toContainText('1 top 6-8 + 2 back-off 8-10 · RIR 1-2');
    await expect(firstCard.getByRole('link', { name: /^View .+ sheet$/ })).toBeVisible();
    expect(findSpanishWords(await allUiText(page))).toEqual([]);

    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(h1(page, 'Edit routine')).toBeVisible();
    await expect(button(page, 'Save')).toBeVisible();
    await expect(button(page, 'Discard')).toBeVisible();
    await expect(button(page, 'Add exercise')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Routine exercises', exact: true })).toBeVisible();
    await expect(jumpChips(page, 'Jump to an exercise').first()).toBeVisible();
    const first = main(page).getByRole('heading', { level: 3 }).first();
    const card = first.locator('xpath=ancestor::*[count(.//h3) = 1][last()]');
    await expect(card.getByRole('combobox', { name: 'Type of set 1', exact: true })).toBeVisible();
    await expect(card.getByRole('textbox', { name: 'Reps of set 1', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Remove set 1', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Add set', exact: true })).toBeVisible();
    await expect(card.getByRole('textbox', { name: 'Target RIR', exact: true })).toBeVisible();
    await expect(card.getByRole('textbox', { name: 'Note', exact: true })).toBeVisible();
    await expect(card.getByRole('checkbox', { name: 'Optional', exact: true })).toBeVisible();
    await expect(card.getByText('For example 2 or 1-2', { exact: true })).toBeVisible();
    expect(findSpanishWords(await allUiText(page))).toEqual([]);
  });
});
