import { expect, test, type Locator, type Page } from '@playwright/test';
import { boxOf, gotoReady, h1, mainNav, viewportOf } from './helpers';

const OPEN_DIALOG = /^Quitar serie(…|\.\.\.)$/;

function confirmDialog(page: Page): Locator {
  return page.getByRole('alertdialog', { name: '¿Quitar esta serie?' });
}

/** The notification item that contains the given text (nearest ancestor with a button). */
function toast(page: Page, text: string): Locator {
  return page.getByText(text, { exact: true }).locator('xpath=ancestor-or-self::*[.//button][1]');
}

/**
 * Opens something the way a user would. WebKit (Safari) never moves focus to a button on
 * click/tap, so there the opener is activated from the keyboard (focus + Enter), which is the
 * path where "focus returns to the opener" is meaningful.
 */
async function activate(target: Locator): Promise<void> {
  if (test.info().project.name === 'webkit') {
    await target.focus();
    await target.press('Enter');
  } else {
    await target.click();
  }
}

async function openCatalog(page: Page): Promise<void> {
  await gotoReady(page, '/dev/ui', 'Componentes');
}

async function focusedName(page: Page, container: Locator): Promise<string | null> {
  const inside = await container.evaluate((c) => c.contains(document.activeElement));
  if (!inside) return null;
  return page.evaluate(() => {
    const el = document.activeElement;
    return el ? (el.getAttribute('aria-label') ?? el.textContent).trim() : '';
  });
}

test.describe('dialog', () => {
  test('AC-DIALOG-01 / 02 · confirmation opens on Cancelar, keeps focus inside, blocks the page', async ({
    page,
  }) => {
    await openCatalog(page);
    const settingsLink = mainNav(page).getByRole('link', { name: 'Ajustes', exact: true });
    const behind = await boxOf(settingsLink);

    await page.getByRole('button', { name: OPEN_DIALOG }).click();
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(
      dialog.getByText('La serie 2 de Remo en T se quitará de esta sesión.', { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();

    const seen = new Set<string>();
    for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      const name = await focusedName(page, dialog);
      expect(name, `${key} left the dialog`).not.toBeNull();
      expect(['Cancelar', 'Quitar']).toContain(name);
      if (name) seen.add(name);
    }
    expect([...seen].sort()).toEqual(['Cancelar', 'Quitar']);

    // Tapping the navigation bar behind the dialog does nothing.
    await page.mouse.click(behind.x + behind.width / 2, behind.y + behind.height / 2);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/dev\/ui$/);
    await expect(h1(page, 'Componentes')).toBeVisible();
    await expect(page.getByText('Serie quitada', { exact: true })).toHaveCount(0);
  });

  test('AC-DIALOG-03 · Escape and Cancelar cancel and return focus to the opener', async ({
    page,
  }) => {
    await openCatalog(page);
    const opener = page.getByRole('button', { name: OPEN_DIALOG });
    const dialog = confirmDialog(page);

    await activate(opener);
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();

    await activate(opener);
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();

    await page.waitForTimeout(300);
    await expect(page.getByText('Serie quitada', { exact: true })).toHaveCount(0);
  });

  test('AC-DIALOG-04 · confirm, then undo', async ({ page }) => {
    await openCatalog(page);
    await page.getByRole('button', { name: OPEN_DIALOG }).click();
    const dialog = confirmDialog(page);
    await dialog.getByRole('button', { name: 'Quitar', exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Serie quitada', { exact: true })).toBeVisible();
    await toast(page, 'Serie quitada')
      .getByRole('button', { name: 'Deshacer', exact: true })
      .click();
    await expect(page.getByText('Serie recuperada', { exact: true })).toBeVisible();
  });

  test('AC-DIALOG-05 · a plain notification sits above the bar, goes in ~4 s, and Cerrar closes it', async ({
    page,
  }) => {
    await page.clock.install();
    await openCatalog(page);
    const show = page.getByRole('button', { name: 'Mostrar aviso', exact: true });
    await show.scrollIntoViewIfNeeded();
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 1000);

    await show.click();
    await page.clock.runFor(100);
    const msg = page.getByText('Guardado en el móvil', { exact: true });
    await expect(msg).toBeVisible();

    const toastBox = await boxOf(toast(page, 'Guardado en el móvil'));
    const navBox = await boxOf(mainNav(page));
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(navBox.y + 1);

    await page.clock.runFor(3400); // t = 3.5 s
    await expect(msg).toBeVisible();
    await page.clock.runFor(1500); // t = 5.0 s
    await expect(msg).toBeHidden();

    await page.clock.resume();
    await show.click();
    await expect(msg).toBeVisible();
    await toast(page, 'Guardado en el móvil')
      .getByRole('button', { name: 'Cerrar', exact: true })
      .click();
    await expect(msg).toBeHidden({ timeout: 1500 });
  });

  test('AC-DIALOG-05 · a notification with Deshacer stays ~6 s', async ({ page }) => {
    await page.clock.install();
    await openCatalog(page);
    await page.getByRole('button', { name: OPEN_DIALOG }).click();
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 1000);

    await dialog.getByRole('button', { name: 'Quitar', exact: true }).click();
    await page.clock.runFor(100);
    const msg = page.getByText('Serie quitada', { exact: true });
    await expect(msg).toBeVisible();

    await page.clock.runFor(5400); // t = 5.5 s: longer than a plain one
    await expect(msg).toBeVisible();
    await page.clock.runFor(1500); // t = 7.0 s
    await expect(msg).toBeHidden();
  });
});

test.describe('bottom sheet', () => {
  async function openSheet(page: Page): Promise<{ opener: Locator; sheet: Locator }> {
    const opener = page.getByRole('button', { name: 'Añadir ejercicio', exact: true });
    await activate(opener);
    const sheet = page.getByRole('dialog', { name: 'Añadir ejercicio' });
    await expect(sheet).toBeVisible();
    return { opener, sheet };
  }

  test('AC-SHEET-01 · slides up from the bottom; Cerrar and Escape close it', async ({ page }) => {
    await openCatalog(page);
    let { opener, sheet } = await openSheet(page);
    const vh = viewportOf(page).height;
    await expect
      .poll(async () => {
        const b = await sheet.boundingBox();
        return b ? Math.round(b.y + b.height) : -1;
      })
      .toBeGreaterThanOrEqual(vh - 1);
    expect((await boxOf(sheet)).width).toBeGreaterThan(300);

    await sheet.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused();

    ({ opener, sheet } = await openSheet(page));
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('AC-SHEET-01 · a tap inside keeps it open; a tap outside closes it', async ({ page }) => {
    await openCatalog(page);
    const { opener, sheet } = await openSheet(page);
    await page.waitForTimeout(500); // let it finish sliding up
    const box = await boxOf(sheet);

    await page.touchscreen.tap(box.x + box.width / 2, box.y + Math.min(40, box.height / 2));
    await page.waitForTimeout(300);
    await expect(sheet).toBeVisible();

    expect(box.y).toBeGreaterThan(20);
    await page.touchscreen.tap(195, Math.max(5, Math.floor(box.y / 2)));
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page).toHaveURL(/\/dev\/ui$/);
  });
});

test.describe('number fields', () => {
  function weight(page: Page): Locator {
    return page.getByLabel('Peso (kg)', { exact: true });
  }

  test('AC-NUM-01 / 02 / 05 · decimal point or comma, zero is a value, empty again when cleared', async ({
    page,
  }) => {
    await openCatalog(page);
    const field = weight(page);
    await expect(field).toHaveAttribute('inputmode', 'decimal');
    const emptyBefore = await page.getByText('Valor: vacío', { exact: true }).count();

    await field.click();
    await field.pressSequentially('27.5');
    await expect(page.getByText('Valor: 27,5', { exact: true })).toBeVisible();
    await field.blur();
    await expect(field).toHaveValue('27,5');

    await field.fill('');
    await field.blur();
    await expect(field).toHaveValue('');
    await expect(page.getByText('Valor: vacío', { exact: true })).toHaveCount(emptyBefore);

    await field.click();
    await field.pressSequentially('0');
    await field.blur();
    await expect(field).toHaveValue('0');
    await expect(page.getByText('Valor: 0', { exact: true })).toBeVisible();
    await expect(page.getByText('Valor: vacío', { exact: true })).toHaveCount(emptyBefore - 1);
  });

  test('AC-NUM-03 / 04 · letters and extra separators are ignored; 600 becomes the maximum 500', async ({
    page,
  }) => {
    await openCatalog(page);
    const field = weight(page);
    await field.click();
    await field.pressSequentially('1x2,a5,');
    await expect(field).toHaveValue('12,5');
    await expect(page.getByText('Valor: 12,5', { exact: true })).toBeVisible();

    await field.fill('');
    await field.pressSequentially('600');
    await field.blur();
    await expect(field).toHaveValue('500');
    await expect(page.getByText('Valor: 500', { exact: true })).toBeVisible();
  });

  test('AC-NUM-04 · − / + start from the suggested 27,5 and stop at 0', async ({ page }) => {
    await openCatalog(page);
    const field = weight(page);
    const inc = page.getByRole('button', { name: 'Aumentar Peso', exact: true });
    const dec = page.getByRole('button', { name: 'Disminuir Peso', exact: true });
    await expect(field).toHaveAttribute('placeholder', '27,5');

    await inc.click();
    await expect(field).toHaveValue('30');
    await dec.click();
    await expect(field).toHaveValue('27,5');

    await field.fill('2,5');
    await field.blur();
    await dec.click();
    await expect(field).toHaveValue('0');
    await expect(page.getByText('Valor: 0', { exact: true })).toBeVisible();
    await expect(dec).toBeDisabled();
  });
});

test.describe('edge · reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  async function longRunningAnimations(page: Page): Promise<number> {
    return page.evaluate(
      () =>
        document.getAnimations().filter((a) => {
          const t = a.effect?.getComputedTiming();
          return a.playState === 'running' && typeof t?.duration === 'number' && t.duration > 50;
        }).length,
    );
  }

  test('dialog, sheet and notification appear without animation', async ({ page }) => {
    await openCatalog(page);

    await page.getByRole('button', { name: OPEN_DIALOG }).click();
    await expect(confirmDialog(page)).toBeVisible();
    expect(await longRunningAnimations(page)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(confirmDialog(page)).toBeHidden();

    await page.getByRole('button', { name: 'Añadir ejercicio', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Añadir ejercicio' })).toBeVisible();
    expect(await longRunningAnimations(page)).toBe(0);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Mostrar aviso', exact: true }).click();
    await expect(page.getByText('Guardado en el móvil', { exact: true })).toBeVisible();
    expect(await longRunningAnimations(page)).toBe(0);
  });
});
