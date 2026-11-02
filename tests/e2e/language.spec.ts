import { expect, test } from '@playwright/test';
import {
  NAV_EN,
  NAV_ES,
  PAGES,
  allUiText,
  expectTheme,
  findSpanishWords,
  gotoReady,
  h1,
  mainNav,
  setLanguage,
  themeButton,
} from './helpers';

test.describe('language', () => {
  test.describe('phone in English', () => {
    test.use({ locale: 'en-US' });

    test('AC-LANG-01 · Spanish by default on a fresh install, whatever the phone language', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(h1(page, 'Hoy')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      await expect(page).toHaveTitle('Hoy · Certavi');
      const nav = mainNav(page, 'es');
      for (const [i, name] of NAV_ES.entries()) {
        await expect(nav.getByRole('link').nth(i)).toHaveAccessibleName(name);
      }
      await expect(page.getByText('Próximamente', { exact: true })).toBeVisible();
      await expect(themeButton(page)).toHaveAccessibleName(/^Tema /);
    });
  });

  test('AC-LANG-02 · switching to English in Settings, and back to Spanish', async ({ page }) => {
    await gotoReady(page, '/settings', 'Ajustes');
    await expect(page.getByRole('radio', { name: 'Español', exact: true })).toBeChecked();

    await page.getByRole('radio', { name: 'English', exact: true }).check();

    await expect(h1(page, 'Settings')).toBeVisible();
    await expect(page).toHaveTitle('Settings · Certavi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // "Español" stays in its own language.
    await expect(page.getByRole('radio', { name: 'Español', exact: true })).toBeVisible();

    const links = mainNav(page, 'en').getByRole('link');
    await expect(links).toHaveCount(5);
    for (const [i, name] of NAV_EN.entries()) {
      await expect(links.nth(i)).toHaveAccessibleName(name);
    }
    for (const radio of ['Automatic', 'Light', 'Dark']) {
      await expect(page.getByRole('radio', { name: radio, exact: true })).toBeVisible();
    }
    await expect(themeButton(page)).toHaveAccessibleName('Automatic theme. Switch to light');
    await expect(page.getByRole('link', { name: 'Skip to content', exact: true })).toBeAttached();

    await page.getByRole('radio', { name: 'Español', exact: true }).check();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveTitle('Ajustes · Certavi');
  });

  test('AC-LANG-02 · every page in English: title, content and no Spanish left', async ({
    page,
  }) => {
    await setLanguage(page, 'en');
    for (const p of PAGES) {
      await page.goto(p.path);
      await expect(h1(page, p.en)).toBeVisible();
      await expect(page).toHaveTitle(`${p.en} · Certavi`);
      if (p.contentEn) await expect(page.getByText(p.contentEn, { exact: true })).toBeVisible();
      if (p.soon) await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();
      const leftovers = findSpanishWords(await allUiText(page));
      expect(leftovers, `Spanish text left on ${p.path}: ${leftovers.join(', ')}`).toEqual([]);
    }
  });

  test('AC-LANG-03 · English (and a forced dark theme) are remembered after reload and reopen', async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await setLanguage(page, 'en');
    await page.getByRole('radio', { name: 'Dark', exact: true }).check();
    await expectTheme(page, 'dark');

    await page.reload();
    await expect(h1(page, 'Settings')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
    await expectTheme(page, 'dark');

    await page.close();
    const again = await context.newPage();
    await again.emulateMedia({ colorScheme: 'light' });
    await again.goto('/');
    await expect(h1(again, 'Today')).toBeVisible();
    await expect(again).toHaveTitle('Today · Certavi');
    await expect(themeButton(again)).toHaveAccessibleName('Dark theme. Switch to automatic');
    await expectTheme(again, 'dark');
  });

  test('AC-LANG-04 / 05 · dates, numbers and the warm-up symbol follow the language', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 2, 12, 0, 0));

    await gotoReady(page, '/', 'Hoy');
    await expect(page.getByText('lunes, 2 de noviembre', { exact: true })).toBeVisible();
    await gotoReady(page, '/dev/ui', 'Componentes');
    await expect(page.getByText('Número: 1234,5', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Hoy: .*2 de noviembre/)).toBeVisible();
    await expect(page.getByTitle('Calentamiento', { exact: true })).toHaveText('C');

    await setLanguage(page, 'en');
    await gotoReady(page, '/', 'Today');
    await expect(page.getByText('Monday 2 November', { exact: true })).toBeVisible();
    await gotoReady(page, '/dev/ui', 'Components');
    await expect(page.getByText('Number: 1,234.5', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Today: .*2 November/)).toBeVisible();
    await expect(page.getByTitle('Warm-up', { exact: true })).toHaveText('W');
  });
});
