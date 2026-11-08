import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  PAGES,
  THEME_COLORS,
  activeThemeColor,
  expectTheme,
  gotoReady,
  h1,
  settle,
  themeButton,
} from './helpers';

const NAME = {
  auto: 'Tema automático. Cambiar a claro',
  light: 'Tema claro. Cambiar a oscuro',
  dark: 'Tema oscuro. Cambiar a automático',
} as const;

test.describe('theme', () => {
  test('AC-THEME-01 · a fresh install follows the phone (dark and light)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await gotoReady(page, '/', 'Hoy');
    await expectTheme(page, 'dark');
    await expect(themeButton(page)).toHaveAccessibleName(NAME.auto);

    // Nothing was chosen, so a light phone opens it in light.
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await expect(h1(page, 'Hoy')).toBeVisible();
    await expectTheme(page, 'light');
    await expect(themeButton(page)).toHaveAccessibleName(NAME.auto);
  });

  test('AC-THEME-02 / 07 · automatic follows a live change; theme-color follows the background', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await gotoReady(page, '/', 'Hoy');
    await expectTheme(page, 'light');
    await expect.poll(() => activeThemeColor(page)).toBe(THEME_COLORS.light.hex);
    await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
    });

    await page.emulateMedia({ colorScheme: 'dark' });
    await expectTheme(page, 'dark');
    await expect.poll(() => activeThemeColor(page)).toBe(THEME_COLORS.dark.hex);
    await page.emulateMedia({ colorScheme: 'light' });
    await expectTheme(page, 'light');

    expect(
      await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
    ).toBe(true);
    await expect(themeButton(page)).toHaveAccessibleName(NAME.auto);
  });

  test('AC-THEME-03 · header button cycles light → dark → automatic', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await gotoReady(page, '/', 'Hoy');
    const button = themeButton(page);
    await expect(button).toHaveAccessibleName(NAME.auto);
    await expectTheme(page, 'dark');

    await button.click();
    await expect(button).toHaveAccessibleName(NAME.light);
    await expectTheme(page, 'light');

    await button.click();
    await expect(button).toHaveAccessibleName(NAME.dark);
    await expectTheme(page, 'dark');

    await button.click();
    await expect(button).toHaveAccessibleName(NAME.auto);
    await expectTheme(page, 'dark');

    // Back on automatic it follows the phone again.
    await page.emulateMedia({ colorScheme: 'light' });
    await expectTheme(page, 'light');
  });

  test('AC-THEME-04 / 07 · a chosen dark theme is remembered over a light phone', async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await gotoReady(page, '/', 'Hoy');
    await themeButton(page).click(); // light
    await themeButton(page).click(); // dark
    await expect(themeButton(page)).toHaveAccessibleName(NAME.dark);
    await expectTheme(page, 'dark');
    await expect.poll(() => activeThemeColor(page)).toBe(THEME_COLORS.dark.hex);

    await page.reload();
    await expect(h1(page, 'Hoy')).toBeVisible();
    await expectTheme(page, 'dark');
    await expect.poll(() => activeThemeColor(page)).toBe(THEME_COLORS.dark.hex);

    // Close and open again.
    await page.close();
    const again = await context.newPage();
    await again.emulateMedia({ colorScheme: 'light' });
    await gotoReady(again, '/calendar', 'Calendario');
    await expectTheme(again, 'dark');
    await expect(themeButton(again)).toHaveAccessibleName(NAME.dark);
  });

  test('AC-THEME-05 · a forced light theme ignores the phone switching to dark', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await gotoReady(page, '/', 'Hoy');
    await themeButton(page).click(); // light
    await expect(themeButton(page)).toHaveAccessibleName(NAME.light);

    await page.emulateMedia({ colorScheme: 'dark' });
    // Give a live listener a chance to (wrongly) react.
    await settle(page);
    await expectTheme(page, 'light');
    await expect(themeButton(page)).toHaveAccessibleName(NAME.light);

    await page.reload();
    await expect(h1(page, 'Hoy')).toBeVisible();
    await expectTheme(page, 'light');
  });

  test('AC-THEME-06 · Settings and the header button agree', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await gotoReady(page, '/settings', 'Ajustes');
    const auto = page.getByRole('radio', { name: 'Automático', exact: true });
    const light = page.getByRole('radio', { name: 'Claro', exact: true });
    const dark = page.getByRole('radio', { name: 'Oscuro', exact: true });
    await expect(auto).toBeChecked();

    await light.check();
    await expectTheme(page, 'light');
    await expect(themeButton(page)).toHaveAccessibleName(NAME.light);

    await dark.check();
    await expectTheme(page, 'dark');
    await expect(themeButton(page)).toHaveAccessibleName(NAME.dark);

    await themeButton(page).click();
    await expect(themeButton(page)).toHaveAccessibleName(NAME.auto);
    await expect(auto).toBeChecked();
    await expect(dark).not.toBeChecked();
  });

  // Axe once per screen and theme. Its results do not depend on the engine, so Chromium only.
  for (const scheme of ['light', 'dark'] as const) {
    test(`AC-THEME-08 · no serious/critical axe issues on any screen (${scheme})`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'axe runs once, in Chromium');
      // Reduced motion: the dialog below is already still when axe looks at it.
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });

      for (const p of PAGES) {
        await gotoReady(page, p.path, p.es);
        await expectTheme(page, scheme);
        await expectNoSeriousViolations(page, p.path);
      }

      // The confirmation dialog, open.
      await gotoReady(page, '/dev/ui', 'Componentes');
      await page.getByRole('button', { name: /^Quitar serie(…|\.\.\.)$/ }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expectNoSeriousViolations(page, '/dev/ui with the dialog open');
    });
  }

  test('edge · site storage blocked: the app works with the defaults and does not remember', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => {
      const blocked = (): never => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      };
      // Only what holds the theme and the language: the local database has its own message
      // (docs/spec/states.md, AC-STATE-02), tested below.
      for (const key of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, key, { get: blocked, configurable: true });
      }
    });

    await gotoReady(page, '/', 'Hoy');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expectTheme(page, 'dark');

    await themeButton(page).click();
    await expect(themeButton(page)).toHaveAccessibleName(NAME.light);
    await expectTheme(page, 'light');

    // Navigation keeps the in-memory choice.
    await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expectTheme(page, 'light');
    await page.getByRole('radio', { name: 'English', exact: true }).check();
    await expect(h1(page, 'Settings')).toBeVisible();

    await page.reload();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expectTheme(page, 'dark');
    await expect(themeButton(page)).toHaveAccessibleName(NAME.auto);
    expect(errors).toEqual([]);
  });

  test('AC-STATE-02 · local database blocked: a message instead of an empty-looking app', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', {
        get: (): never => {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
        configurable: true,
      });
    });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'No se pueden abrir los datos de este dispositivo' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  });
});

async function expectNoSeriousViolations(page: Page, where: string): Promise<void> {
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
  expect(serious, `${where}\n${summary.join('\n')}`).toEqual([]);
}
