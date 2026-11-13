import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { createFakeSyncServer, E2E_SYNC_KEY } from '../mocks/sync-server';
import { boxOf, expectTheme, hasHorizontalScroll, mainNav, setLanguage } from './helpers';

/** A page title: a heading of any level (the app header holds the h1, the page title is an h2). */
function title(page: Page, name: string): Locator {
  return page.getByRole('heading', { name, exact: true }).first();
}

// Spec: docs/spec/blocks.md (optional blocks) and docs/spec/today.md §2.3 (the card on Today).
// The device date is fixed with `page.clock.setFixedTime` before the first `goto`. Nothing here
// waits for time: state is awaited with web-first assertions.

const WAIT = 10_000;

const MON = new Date(2026, 10, 2, 9, 30); // Monday 2 November 2026
const TUE = new Date(2026, 10, 3, 9, 30);
const SUN_BEFORE = new Date(2026, 10, 1, 9, 30); // Sunday 1 November
const SAT_BEFORE = new Date(2026, 9, 31, 9, 30); // Saturday 31 October
const SIXTY_DAYS_AGO = new Date(2026, 8, 3, 9, 30); // 3 September = 60 days before MON

const REHAB = 'Rehabilitación del tobillo';
const STAIRS = 'Dolor al bajar escaleras';

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

async function gotoAt(page: Page, date: Date, path: string, pageTitle: string): Promise<void> {
  await page.clock.setFixedTime(date);
  await page.goto(path);
  await expect(title(page, pageTitle)).toBeVisible();
}

async function reloadAt(page: Page, date: Date, pageTitle = 'Hoy'): Promise<void> {
  await page.clock.setFixedTime(date);
  await page.reload();
  await expect(title(page, pageTitle)).toBeVisible();
}

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

function field(scope: Page | Locator, name: string | RegExp): Locator {
  return scope
    .getByRole('textbox', { name, exact: true })
    .or(scope.getByRole('spinbutton', { name, exact: true }));
}

function group(scope: Page | Locator, name: string | RegExp): Locator {
  return scope
    .getByRole('radiogroup', { name, exact: true })
    .or(scope.getByRole('group', { name, exact: true }));
}

function option(scope: Locator, name: string | RegExp): Locator {
  return scope
    .getByRole('radio', { name, exact: true })
    .or(scope.getByRole('button', { name, exact: true }));
}

/** A button of a 0–10 scale ("4", or a name that ends in " 4"). */
function scaleValue(scale: Locator, n: number): Locator {
  return scale.getByRole('button', { name: new RegExp(`(^|\\s)${String(n)}$`) });
}

/** Link or button (the spec says "button"; a link that navigates is just as valid). */
function action(scope: Page | Locator, name: string): Locator {
  return scope
    .getByRole('button', { name, exact: true })
    .or(scope.getByRole('link', { name, exact: true }));
}

function indicator(page: Page): Locator {
  return page.getByRole('link', { name: /^(Sincronización|Sync): / });
}

/** Text that a chart exposes as its description (visible text or an accessible label). */
function description(scope: Page | Locator, text: RegExp): Locator {
  return scope.getByText(text).or(scope.getByLabel(text)).first();
}

async function goToday(page: Page, lang: 'es' | 'en' = 'es'): Promise<void> {
  const name = lang === 'es' ? 'Hoy' : 'Today';
  await mainNav(page, lang).getByRole('link', { name, exact: true }).click();
  await expect(title(page, name)).toBeVisible();
}

/** The "Nombre" text field of the editor that currently holds `value`. */
async function nameFieldWithValue(page: Page, value: string): Promise<Locator> {
  const fields = page.getByRole('textbox', { name: 'Nombre', exact: true });
  const values = await fields.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
  const index = values.indexOf(value);
  expect(
    index,
    `a "Nombre" field with the value "${value}" (found: ${values.join(' | ')})`,
  ).toBeGreaterThan(-1);
  return fields.nth(index);
}

/** The visible names of the checkboxes of a card, in order. */
async function checklist(block: Locator): Promise<string[]> {
  return block.getByRole('checkbox').evaluateAll((els) =>
    els.map((el) => {
      const input = el as HTMLInputElement;
      return (
        input.getAttribute('aria-label') ??
        input.labels?.[0]?.textContent ??
        input.closest('label')?.textContent ??
        ''
      ).trim();
    }),
  );
}

async function axe(page: Page, label: string): Promise<void> {
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

/** From Today, opens the tracking page of a block card ("Ver seguimiento") and returns its URL. */
async function openTracking(page: Page, blockName: string, pageTitle = blockName): Promise<string> {
  const block = await card(page, blockName);
  await action(block, 'Ver seguimiento').click();
  await expect(title(page, pageTitle)).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/blocks\/[^/]+$/);
  return page.url();
}

/** Logs a value on the stairs scale of the rehab card on Today. */
async function logStairs(page: Page, n: number): Promise<void> {
  const rehab = await card(page, REHAB);
  const scale = group(rehab, STAIRS);
  await scaleValue(scale, n).click();
  await expect(scaleValue(scale, n)).toHaveAttribute('aria-pressed', 'true');
}

async function expectBelow(upper: Locator, lower: Locator): Promise<void> {
  const a = await boxOf(upper);
  const b = await boxOf(lower);
  expect(b.y, 'the second element is below the first').toBeGreaterThan(a.y);
}

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

test.describe('optional blocks', () => {
  test(
    'AC-BLK-01 / 02 · the 0-10 scale is on one row at 390 px; the entry points reach the list and the tracking page',
    { tag: '@all-engines' },
    async ({ page }) => {
      await gotoAt(page, MON, '/', 'Hoy');
      const rehab = await card(page, REHAB);
      const scale = group(rehab, STAIRS);
      await expect(scale.getByRole('button')).toHaveCount(11);
      await scale.scrollIntoViewIfNeeded();

      // AC-01: one row, nothing cut off, no sideways scroll.
      const zero = await boxOf(scaleValue(scale, 0));
      const ten = await boxOf(scaleValue(scale, 10));
      expect(Math.abs(ten.y - zero.y), '"10" is level with "0"').toBeLessThanOrEqual(1);
      for (let n = 0; n <= 10; n++) {
        const box = await boxOf(scaleValue(scale, n));
        expect(box.x, `box ${String(n)} starts inside the screen`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `box ${String(n)} ends inside the screen`).toBeLessThanOrEqual(
          390,
        );
        expect(box.height, `box ${String(n)} is at least 44 px high`).toBeGreaterThanOrEqual(43.5);
        expect(Math.abs(box.y - zero.y), `box ${String(n)} is on the same row`).toBeLessThanOrEqual(
          1,
        );
      }
      expect(zero.width).toBeGreaterThan(20);
      expect(zero.width).toBeLessThan(40);
      expect(await hasHorizontalScroll(page), 'no horizontal page scroll').toBe(false);

      // AC-02: Today -> tracking page.
      await action(rehab, 'Ver seguimiento').click();
      await expect(title(page, REHAB)).toBeVisible();
      await expect(action(page, 'Editar bloque')).toBeVisible();

      // AC-02: Settings -> card "Bloques opcionales" -> "Gestionar bloques" -> list.
      await mainNav(page).getByRole('link', { name: 'Ajustes', exact: true }).click();
      await expect(title(page, 'Ajustes')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Bloques opcionales', exact: true }),
      ).toBeVisible();
      await page.getByRole('link', { name: 'Gestionar bloques', exact: true }).click();
      await expect(page).toHaveURL(/\/settings\/blocks$/);
      await expect(title(page, 'Bloques opcionales')).toBeVisible();
      await expect(action(page, 'Nuevo bloque')).toBeVisible();
      const active = page.getByRole('heading', { name: 'Activos', exact: true });
      const inactive = page.getByRole('heading', { name: 'Inactivos', exact: true });
      const ankle = page.getByRole('link', { name: new RegExp(`^${REHAB}`) });
      const stretching = page.getByRole('link', { name: /^Estiramientos/ });
      await expect(ankle).toContainText('8 ejercicios · todos los días');
      await expect(ankle).toContainText('Rehabilitación');
      await expect(stretching).toContainText('Sin ejercicios');
      await expectBelow(active, ankle);
      await expectBelow(ankle, inactive);
      await expectBelow(inactive, stretching);
      expect(await hasHorizontalScroll(page)).toBe(false);

      // The list link opens the tracking page.
      await ankle.click();
      await expect(title(page, REHAB)).toBeVisible();

      // AC-01 (session): the five buttons 1..5 of "¿Cómo llegas?" are on one row too.
      await goToday(page);
      await button(page, 'Empezar Push').click();
      await expect(page).toHaveURL(/\/session\/[^/]+$/);
      const readiness = group(page, '¿Cómo llegas?');
      await expect(readiness.getByRole('button')).toHaveCount(5);
      const first = await boxOf(scaleValue(readiness, 1));
      const last = await boxOf(scaleValue(readiness, 5));
      expect(Math.abs(first.y - last.y)).toBeLessThanOrEqual(1);
      expect(last.x + last.width).toBeLessThanOrEqual(390);
      expect(await hasHorizontalScroll(page)).toBe(false);
    },
  );

  test('AC-BLK-03 / 04 · create a block; fill in the empty "Estiramientos" block with days; it shows on a Monday and not on a Tuesday', async ({
    page,
  }) => {
    await gotoAt(page, MON, '/settings/blocks', 'Bloques opcionales');

    // AC-03: create.
    await action(page, 'Nuevo bloque').click();
    await expect(page).toHaveURL(/\/settings\/blocks\/new$/);
    await field(page, 'Nombre').fill('Movilidad de cadera');
    // A new block is active and has every day pressed.
    await expect(page.getByRole('checkbox', { name: 'Activo', exact: true })).toBeChecked();
    for (const day of ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']) {
      await expect(
        page.getByRole('button', { name: day, exact: true, pressed: true }),
      ).toBeVisible();
    }
    await button(page, 'Añadir ejercicio').click();
    await field(page, 'Nombre').last().fill('Sentadilla profunda');
    await field(page, 'Dosis').last().fill('3 × 30 s');
    await button(page, 'Guardar').click();
    await expect(toast(page, 'Bloque guardado')).toBeVisible();
    await expect(page).toHaveURL(/\/settings\/blocks\/[^/]+$/);
    await expect(title(page, 'Movilidad de cadera')).toBeVisible();

    await page.goto('/settings/blocks');
    await expect(title(page, 'Bloques opcionales')).toBeVisible();
    const hip = page.getByRole('link', { name: /^Movilidad de cadera/ });
    await expect(hip).toContainText(/1 ejercicios? · todos los días/);
    await expectBelow(page.getByRole('heading', { name: 'Activos', exact: true }), hip);

    await goToday(page);
    const hipCard = await card(page, 'Movilidad de cadera');
    await expect(hipCard.getByRole('checkbox', { name: /^Sentadilla profunda/ })).toBeVisible();
    await expect(hipCard).toContainText('3 × 30 s');

    // AC-04: fill in "Estiramientos".
    await page.goto('/settings/blocks');
    await page.getByRole('link', { name: /^Estiramientos/ }).click();
    await expect(title(page, 'Estiramientos')).toBeVisible();
    await action(page, 'Editar bloque').click();
    await expect(page).toHaveURL(/\/edit$/);
    await expect(page.getByRole('checkbox', { name: 'Activo', exact: true })).not.toBeChecked();
    await button(page, 'Añadir ejercicio').click();
    await field(page, 'Nombre').last().fill('Isquios');
    await field(page, 'Dosis').last().fill('2 × 30 s');
    await button(page, 'Añadir ejercicio').click();
    await field(page, 'Nombre').last().fill('Cuádriceps');
    // The seed block has no days: press L, X and V only.
    await expect(
      page.getByRole('button', {
        name: /^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)$/,
        pressed: true,
      }),
    ).toHaveCount(0);
    for (const day of ['lunes', 'miércoles', 'viernes']) {
      await page.getByRole('button', { name: day, exact: true }).click();
      await expect(page.getByRole('button', { name: day, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    await page.getByRole('checkbox', { name: 'Activo', exact: true }).check();
    await button(page, 'Guardar').click();
    await expect(toast(page, 'Bloque guardado')).toBeVisible();

    await page.goto('/settings/blocks');
    const stretching = page.getByRole('link', { name: /^Estiramientos/ });
    await expect(stretching).toContainText('2 ejercicios · L, X, V');
    await expectBelow(page.getByRole('heading', { name: 'Activos', exact: true }), stretching);
    await expect(page.getByRole('heading', { name: 'Inactivos', exact: true })).toHaveCount(0);

    // Monday: its card is on Today. Tuesday: it is not.
    await gotoAt(page, MON, '/', 'Hoy');
    const stretchCard = await card(page, 'Estiramientos');
    await expect(stretchCard.getByRole('checkbox')).toHaveCount(2);
    await reloadAt(page, TUE);
    await expect(page.getByRole('heading', { name: REHAB, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Estiramientos', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Movilidad de cadera', exact: true }),
    ).toBeVisible();
  });

  test('AC-BLK-05 / 06 · edit the seed block (rename, move, remove) keeping the tick; deactivate and reactivate', async ({
    page,
  }) => {
    await gotoAt(page, MON, '/', 'Hoy');
    let rehab = await card(page, REHAB);
    await expect(rehab).toContainText('Ejercicios · 0/8');
    const before = await checklist(rehab);
    expect(before).toHaveLength(8);

    // A tick, a value and a note given before the edit.
    const roller = rehab.getByRole('checkbox', { name: /^Rodillo en gemelo/ });
    await roller.click();
    await expect(roller).toBeChecked();
    await logStairs(page, 2);

    await openTracking(page, REHAB);
    await action(page, 'Editar bloque').click();
    await expect(page).toHaveURL(/\/edit$/);
    await expect(page.getByRole('textbox', { name: 'Nombre', exact: true }).first()).toHaveValue(
      REHAB,
    );

    // Edge case: the first item cannot go up and the last cannot go down.
    await expect(page.getByRole('button', { name: /^Subir /, disabled: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Bajar /, disabled: true })).toHaveCount(1);

    const rollerName = await nameFieldWithValue(page, 'Rodillo en gemelo');
    await expect(rollerName).toBeVisible();
    await rollerName.fill('Rodillo');
    await button(page, 'Bajar Rodillo').click();
    await button(page, 'Quitar Pogos').click();
    await button(page, 'Guardar').click();
    await expect(toast(page, 'Bloque guardado')).toBeVisible();

    await goToday(page);
    rehab = await card(page, REHAB);
    await expect(rehab).toContainText('Ejercicios · 1/7');
    await expect(rehab.getByRole('checkbox')).toHaveCount(7);
    await expect(rehab.getByRole('checkbox', { name: /^Rodillo/ })).toBeChecked();
    await expect(rehab.getByRole('checkbox', { name: /^Pogos/ })).toHaveCount(0);
    await expect(rehab.getByRole('checkbox', { name: /^Rodillo en gemelo/ })).toHaveCount(0);
    // New order: the old one with "Rodillo en gemelo" one place down and "Pogos" gone.
    const expected = [...before];
    const at = expected.findIndex((n) => n.startsWith('Rodillo en gemelo'));
    expect(at).toBeGreaterThan(-1);
    if (at < expected.length - 1) {
      const next = expected[at + 1];
      expected[at + 1] = expected[at] ?? '';
      expected[at] = next ?? '';
    }
    const expectedNames = expected
      .filter((n) => !n.startsWith('Pogos'))
      .map((n) => (n.startsWith('Rodillo en gemelo') ? 'Rodillo' : n));
    const after = await checklist(rehab);
    expect(after).toHaveLength(7);
    after.forEach((n, i) => {
      expect(n.startsWith(expectedNames[i] ?? '\u0000'), `item ${String(i)}: "${n}"`).toBe(true);
    });

    // AC-06: deactivate.
    await openTracking(page, REHAB);
    await action(page, 'Editar bloque').click();
    await page.getByRole('checkbox', { name: 'Activo', exact: true }).uncheck();
    await button(page, 'Guardar').click();
    await expect(toast(page, 'Bloque guardado')).toBeVisible();
    await goToday(page);
    await expect(page.getByRole('heading', { name: REHAB, exact: true })).toHaveCount(0);
    await page.goto('/settings/blocks');
    const ankle = page.getByRole('link', { name: new RegExp(`^${REHAB}`) });
    await expectBelow(page.getByRole('heading', { name: 'Inactivos', exact: true }), ankle);

    // Reactivate: the card is back with what was logged that day.
    await ankle.click();
    await action(page, 'Editar bloque').click();
    await page.getByRole('checkbox', { name: 'Activo', exact: true }).check();
    await button(page, 'Guardar').click();
    await expect(toast(page, 'Bloque guardado')).toBeVisible();
    await goToday(page);
    rehab = await card(page, REHAB);
    await expect(rehab).toContainText('Ejercicios · 1/7');
    await expect(rehab.getByRole('checkbox', { name: /^Rodillo/ })).toBeChecked();
    await expect(scaleValue(group(rehab, STAIRS), 2)).toHaveAttribute('aria-pressed', 'true');
  });

  test('AC-BLK-07 · validation: messages under the field, focus on the first error, nothing saved', async ({
    page,
  }) => {
    await gotoAt(page, MON, '/settings/blocks', 'Bloques opcionales');
    await page.getByRole('link', { name: new RegExp(`^${REHAB}`) }).click();
    await action(page, 'Editar bloque').click();
    await expect(page).toHaveURL(/\/edit$/);

    // An empty name on the seed block.
    const name = field(page, 'Nombre').first();
    await expect(name).toHaveValue(REHAB);
    await name.fill('');
    await button(page, 'Guardar').click();
    await expect(page.getByText('Escribe un nombre.', { exact: true })).toBeVisible();
    await expect(name).toBeFocused();
    await expect(page).toHaveURL(/\/edit$/);
    await action(page, 'Cancelar').click();
    await expect(title(page, REHAB)).toBeVisible();
    await page.goto('/settings/blocks');
    await expect(page.getByRole('link', { name: new RegExp(`^${REHAB}`) })).toBeVisible();

    // A new block with an empty exercise name, a bad frequency and a limit out of range.
    await action(page, 'Nuevo bloque').click();
    await field(page, 'Nombre').fill('Bloque con errores');
    await button(page, 'Añadir ejercicio').click();
    await field(page, 'Veces por semana').fill('abc');
    await button(page, 'Añadir métrica').click();
    await field(page, 'Límite').fill('12');
    await button(page, 'Guardar').click();
    await expect(page.getByText('Escribe un nombre.', { exact: true })).toHaveCount(0);
    await expect(
      page.getByText('Escribe el nombre de cada ejercicio.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Usa un número o un rango, como 3 o 3-5.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('El límite va de 0 a 9.', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Escribe el nombre de cada métrica.', { exact: true }),
    ).toBeVisible();
    // The first error in page order (the exercise name) takes focus.
    await expect(field(page, 'Nombre').nth(1)).toBeFocused();
    await expect(page).toHaveURL(/\/settings\/blocks\/new$/);

    // Nothing was saved.
    await action(page, 'Cancelar').click();
    await expect(title(page, 'Bloques opcionales')).toBeVisible();
    await expect(page.getByRole('link', { name: /^Bloque con errores/ })).toHaveCount(0);
  });

  test('AC-BLK-08 · chart with the dashed 3/10 limit, "Ver datos" table and the period selector', async ({
    page,
  }) => {
    // Values on several days by moving the date: 60 days ago, Saturday, Sunday and today.
    await gotoAt(page, SIXTY_DAYS_AGO, '/', 'Hoy');
    await logStairs(page, 4);
    await reloadAt(page, SAT_BEFORE);
    await logStairs(page, 2);
    await reloadAt(page, SUN_BEFORE);
    await logStairs(page, 5);
    await reloadAt(page, MON);
    await logStairs(page, 1);

    await openTracking(page, REHAB);
    const chart = await card(page, STAIRS);
    await expect(chart).toBeVisible();
    await expect(chart.getByText('Límite 3/10', { exact: true })).toBeVisible();
    const dashed = await chart.locator('svg *').evaluateAll(
      (els) =>
        els.filter((el) => {
          const dash = getComputedStyle(el).strokeDasharray;
          return dash !== 'none' && dash !== '' && dash !== '0';
        }).length,
    );
    expect(dashed, 'a dashed line is drawn').toBeGreaterThan(0);

    // Default period: 30 days -> 3 points; the value of 60 days ago is not there.
    await expect(selectedPeriod(page, '30 días')).toBeVisible();
    await expect(description(chart, /3 puntos, de 1 a 5/)).toBeAttached();
    await chart.getByText('Ver datos', { exact: true }).click();
    await expect(chart.getByText('5 (por encima del límite)', { exact: true })).toBeVisible();
    await expect(chart.getByRole('table').getByText('(por encima del límite)')).toHaveCount(1);

    // "Todo": the older value appears.
    await option(group(page, 'Periodo'), 'Todo').click();
    await expect(description(chart, /4 puntos, de 1 a 5/)).toBeAttached();
    await option(group(page, 'Periodo'), '90 días').click();
    await expect(description(chart, /4 puntos, de 1 a 5/)).toBeAttached();
    await option(group(page, 'Periodo'), '30 días').click();
    await expect(description(chart, /3 puntos, de 1 a 5/)).toBeAttached();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test(
    'AC-BLK-09 · weekly wall test: save, reload, replace the same week',
    { tag: '@all-engines' },
    async ({ page }) => {
      await gotoAt(page, MON, '/', 'Hoy');
      await openTracking(page, REHAB);
      const wall = await card(page, 'Test de la pared');
      await expect(wall).toContainText(/2\s*–\s*8 nov/);
      await expect(wall.getByText('Aún no hay registros.')).toHaveCount(2);

      await field(wall, 'Izquierda (cm)').fill('9,5');
      await field(wall, 'Derecha (cm)').fill('11');
      await button(wall, 'Guardar').click();
      await expect(toast(page, /^Test de la pared guardado · 2\s*–\s*8 nov\.?$/)).toBeVisible();

      await page.reload();
      await expect(title(page, REHAB)).toBeVisible();
      const wallAgain = await card(page, 'Test de la pared');
      await expect(field(wallAgain, 'Izquierda (cm)')).toHaveValue('9,5');
      await expect(field(wallAgain, 'Derecha (cm)')).toHaveValue('11');
      await expect(wallAgain.getByText('Aún no hay registros.')).toHaveCount(0);
      await expect(description(wallAgain, /Izquierda.*1 punto/)).toBeAttached();
      await expect(description(wallAgain, /Derecha.*1 punto/)).toBeAttached();

      // Replace: "Derecha" = 12 for the same week.
      await field(wallAgain, 'Derecha (cm)').fill('12');
      await button(wallAgain, 'Guardar').click();
      await expect(toast(page, /^Test de la pared guardado · /)).toBeVisible();
      await expect(description(wallAgain, /Derecha.*1 punto/)).toBeAttached();
      const views = wallAgain.getByText('Ver datos', { exact: true });
      const total = await views.count();
      expect(total).toBe(2);
      for (let i = 0; i < total; i++) await views.nth(i).click();
      await expect(wallAgain.getByText('12', { exact: true }).first()).toBeVisible();
      await expect(wallAgain.getByRole('cell', { name: /^11(,0)? ?(cm)?$/ })).toHaveCount(0);
      await page.reload();
      await expect(field(await card(page, 'Test de la pared'), 'Derecha (cm)')).toHaveValue('12');
    },
  );

  test(
    'AC-BLK-12 · offline: create a block, log a value and save the wall test; all survive a reload and wait as pending',
    { tag: '@all-engines' },
    async ({ page, context }) => {
      const server = createFakeSyncServer();
      await server.attach(context);
      await gotoAt(page, MON, '/settings', 'Ajustes');
      await page.getByLabel('Clave de sincronización', { exact: true }).fill(E2E_SYNC_KEY);
      await button(page, 'Guardar clave').click();
      await expect(toast(page, 'Clave guardada.')).toBeVisible();
      await expect
        .poll(() => server.requestCount('/api/v1/sync'), { timeout: WAIT })
        .toBeGreaterThan(0);
      await expect(indicator(page)).toHaveAccessibleName('Sincronización: Sincronizado', {
        timeout: WAIT,
      });
      // The block screens are lazy routes (separate files, downloaded when opened; the service
      // worker would have them stored, but it is blocked in this spec): open the ones used below
      // while online, so the offline part only navigates inside what is already loaded.
      await page.getByRole('link', { name: 'Gestionar bloques', exact: true }).click();
      await action(page, 'Nuevo bloque').click();
      await expect(title(page, 'Nuevo bloque')).toBeVisible();
      await goToday(page);
      await openTracking(page, REHAB);
      await mainNav(page).getByRole('link', { name: 'Ajustes', exact: true }).click();
      await expect(title(page, 'Ajustes')).toBeVisible();

      const before = server.requestCount();
      await context.setOffline(true);
      await expect(indicator(page)).toHaveAccessibleName(/^Sincronización: Sin conexión/, {
        timeout: WAIT,
      });

      // Create a block (no page load: navigate inside the app).
      await page.getByRole('link', { name: 'Gestionar bloques', exact: true }).click();
      await action(page, 'Nuevo bloque').click();
      await field(page, 'Nombre').fill('Bloque sin red');
      await button(page, 'Añadir ejercicio').click();
      await field(page, 'Nombre').last().fill('Gemelo sin red');
      await button(page, 'Guardar').click();
      await expect(toast(page, 'Bloque guardado')).toBeVisible();

      // Log a value on Today.
      await goToday(page);
      await logStairs(page, 4);

      // Save the wall test.
      await openTracking(page, REHAB);
      const wall = await card(page, 'Test de la pared');
      await field(wall, 'Izquierda (cm)').fill('8');
      await field(wall, 'Derecha (cm)').fill('10,5');
      await button(wall, 'Guardar').click();
      await expect(toast(page, /^Test de la pared guardado · /)).toBeVisible();

      await expect(indicator(page)).toHaveAccessibleName(
        /^Sincronización: Sin conexión · \d+ pendientes?$/,
        { timeout: WAIT },
      );
      expect(server.requestCount(), 'no request while offline').toBe(before);

      // Reload with only the API cut (the page itself needs the network: no service worker yet).
      const unreachable = (route: Route) => route.abort('internetdisconnected');
      await context.route('**/api/v1/**', unreachable);
      await context.setOffline(false);
      await page.clock.setFixedTime(MON);
      await page.reload();
      await expect(title(page, REHAB)).toBeVisible();
      const wallAgain = await card(page, 'Test de la pared');
      await expect(field(wallAgain, 'Izquierda (cm)')).toHaveValue('8');
      await expect(field(wallAgain, 'Derecha (cm)')).toHaveValue('10,5');
      await expect(indicator(page)).toHaveAccessibleName(/ · \d+ pendientes?$/, { timeout: WAIT });

      await goToday(page);
      const rehab = await card(page, REHAB);
      await expect(scaleValue(group(rehab, STAIRS), 4)).toHaveAttribute('aria-pressed', 'true');
      const mine = await card(page, 'Bloque sin red');
      await expect(mine.getByRole('checkbox', { name: /^Gemelo sin red/ })).toBeVisible();
      await page.goto('/settings/blocks');
      await expect(page.getByRole('link', { name: /^Bloque sin red/ })).toBeVisible();
      await context.unroute('**/api/v1/**', unreachable);
    },
  );
});

// Language, theme and axe do not depend on the engine: Chromium only (.claude/rules/e2e.md).
test.describe('optional blocks · language and theme', () => {
  test('AC-BLK-11 · English and dark mode; axe on the list, tracking and editor in light and dark', async ({
    page,
  }) => {
    await gotoAt(page, MON, '/', 'Hoy');
    await logStairs(page, 5);
    const trackingUrl = await openTracking(page, REHAB);
    const editUrl = `${trackingUrl}/edit`;
    const screens: [string, string, string][] = [
      ['list', '/settings/blocks', 'Bloques opcionales'],
      ['tracking', trackingUrl, REHAB],
      ['editor', editUrl, 'Editar bloque'],
    ];

    // Light, Spanish.
    await page.emulateMedia({ colorScheme: 'light' });
    for (const [label, url, screenTitle] of screens) {
      await page.clock.setFixedTime(MON);
      await page.goto(url);
      if (label === 'editor') await expect(field(page, 'Nombre').first()).toHaveValue(REHAB);
      else await expect(title(page, screenTitle)).toBeVisible();
      await expectTheme(page, 'light');
      await axe(page, `${label} · light`);
    }

    // Dark, English.
    await setLanguage(page, 'en');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.clock.setFixedTime(MON);
    await page.goto('/settings');
    await expectTheme(page, 'dark');
    await expect(page.getByRole('heading', { name: 'Optional blocks', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Manage blocks', exact: true }).click();
    await expect(title(page, 'Optional blocks')).toBeVisible();
    await expect(action(page, 'New block')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inactive', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Ankle rehab/ })).toContainText(
      '8 exercises · every day',
    );
    await expect(page.getByRole('link', { name: /^Stretching/ })).toContainText('No exercises');
    await axe(page, 'list · dark · en');

    await page.clock.setFixedTime(MON);
    await page.goto(trackingUrl);
    await expect(title(page, 'Ankle rehab')).toBeVisible();
    await expect(action(page, 'Edit block')).toBeVisible();
    await expect(page.getByText('Limit 3/10', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wall test', exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('group', { name: 'Period', exact: true })
        .or(page.getByRole('radiogroup', { name: 'Period', exact: true })),
    ).toBeVisible();
    await expectTheme(page, 'dark');
    await axe(page, 'tracking · dark · en');

    await page.clock.setFixedTime(MON);
    await page.goto(editUrl);
    await expect(field(page, 'Name').first()).toHaveValue('Ankle rehab');
    await expect(button(page, 'Add exercise')).toBeVisible();
    await expect(
      page.getByText('Weekly values: Wall test (cm): Left, Right', { exact: true }),
    ).toBeVisible();
    await expectTheme(page, 'dark');
    await axe(page, 'editor · dark · en');

    // Today in English: the card link.
    await page.clock.setFixedTime(MON);
    await page.goto('/');
    await expect(title(page, 'Today')).toBeVisible();
    await expect(action(page, 'See tracking')).toBeVisible();
  });
});

/** The period option that is selected (radio checked or toggle pressed). */
function selectedPeriod(page: Page, name: string): Locator {
  const scope = group(page, 'Periodo');
  return scope
    .getByRole('radio', { name, exact: true, checked: true })
    .or(scope.getByRole('button', { name, exact: true, pressed: true }));
}
