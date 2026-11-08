import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectTheme, gotoReady, h1, mainNav, setLanguage } from './helpers';

// AC-STATE-01 · a screen that fails. The lazy screens are separate files under /assets/; aborting
// the request of one of them makes that screen fail without any network error on the others.
// Chromium only (engine-independent UI logic).
const CALENDAR_CHUNK = /\/assets\/CalendarPage-[^/]*\.js(\?.*)?$/;

async function blockCalendarChunk(page: Page): Promise<void> {
  await page.route(CALENDAR_CHUNK, (route) => route.abort('failed'));
}

test.describe('states · a screen that fails', () => {
  test('AC-STATE-01 · Spanish: the screen is replaced, the tab bar stays, retry brings it back', async ({
    page,
  }) => {
    await blockCalendarChunk(page);
    await gotoReady(page, '/', 'Hoy');
    const nav = mainNav(page);

    await nav.getByRole('link', { name: 'Calendario', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'No se pudo mostrar esta pantalla', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver a Hoy', exact: true })).toBeVisible();
    await expect(
      page.getByText('Tus datos están a salvo en este dispositivo.', { exact: false }),
    ).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();

    // Another tab still opens.
    await nav.getByRole('link', { name: 'Ajustes', exact: true }).click();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'No se pudo mostrar esta pantalla' }),
    ).toHaveCount(0);

    // Back on the failing screen (still blocked): the message is there again.
    await page.goBack();
    await expect(
      page.getByRole('heading', { name: 'No se pudo mostrar esta pantalla', exact: true }),
    ).toBeVisible();

    // The network is back: "Reintentar" reloads the app and the screen shows.
    await page.unroute(CALENDAR_CHUNK);
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(h1(page, 'Calendario')).toBeVisible();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(
      page.getByRole('heading', { name: 'No se pudo mostrar esta pantalla' }),
    ).toHaveCount(0);
    await expect(
      mainNav(page).getByRole('link', { name: 'Calendario', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('AC-STATE-01 · English: texts translated and "Back to Today" leaves the error', async ({
    page,
  }) => {
    await setLanguage(page, 'en');
    await blockCalendarChunk(page);
    await gotoReady(page, '/', 'Today');
    const nav = mainNav(page, 'en');

    await nav.getByRole('link', { name: 'Calendar', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'This screen could not be shown', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Your data is safe on this device.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
    await expect(nav).toBeVisible();
    // No Spanish left on the error screen.
    await expect(page.getByText('No se pudo mostrar esta pantalla')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);

    await page.getByRole('link', { name: 'Back to Today', exact: true }).click();
    await expect(h1(page, 'Today')).toBeVisible();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    await expect(page.getByRole('heading', { name: 'This screen could not be shown' })).toHaveCount(
      0,
    );
  });

  test('AC-STATE-01 · dark mode: the error screen uses the dark colours and passes axe', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await blockCalendarChunk(page);
    await gotoReady(page, '/', 'Hoy');
    await mainNav(page).getByRole('link', { name: 'Calendario', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'No se pudo mostrar esta pantalla', exact: true }),
    ).toBeVisible();
    await expectTheme(page, 'dark');

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id}: ${v.help}`),
      'serious axe violations on the error screen (dark)',
    ).toEqual([]);
  });
});
