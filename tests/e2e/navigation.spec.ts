import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  NAV_ES,
  NAV_PATHS,
  PAGES,
  boxOf,
  gotoReady,
  h1,
  hasHorizontalScroll,
  mainNav,
  themeButton,
  viewportOf,
  type Box,
} from './helpers';

test.describe('navigation', () => {
  test('AC-NAV-01 · opens on Today with the main navigation in order', async ({ page }) => {
    await page.goto('/');

    await expect(h1(page, 'Hoy')).toBeVisible();
    await expect(page).toHaveTitle('Hoy · Certavi');

    const nav = mainNav(page);
    await expect(nav).toBeVisible();
    const links = nav.getByRole('link');
    await expect(links).toHaveCount(5);
    for (const [i, name] of NAV_ES.entries()) {
      await expect(links.nth(i)).toHaveAccessibleName(name);
    }

    await expect(nav.getByRole('link', { name: 'Hoy', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test('AC-NAV-02 · every bar link moves to its section, marks it current and focuses its heading', async ({
    page,
  }) => {
    await gotoReady(page, '/', 'Hoy');
    const nav = mainNav(page);
    // Visit in reverse so every link is clicked from another section.
    const items = NAV_ES.map((name, i) => ({ name, path: NAV_PATHS[i] })).reverse();
    for (const { name, path: expectedPath } of items) {
      await nav.getByRole('link', { name, exact: true }).click();
      await expect(h1(page, name)).toBeVisible();
      await expect.poll(() => new URL(page.url()).pathname).toBe(expectedPath);
      await expect(page).toHaveTitle(`${name} · Certavi`);
      await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(h1(page, name)).toBeFocused();
    }
  });

  test('AC-NAV-03 · every page shows its title, content and theme button, and fits 390 px', async ({
    page,
  }) => {
    for (const p of PAGES) {
      await page.goto(p.path);
      await expect(h1(page, p.es)).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page).toHaveTitle(`${p.es} · Certavi`);
      if (p.contentEs) await expect(page.getByText(p.contentEs, { exact: true })).toBeVisible();
      if (p.soon) await expect(page.getByText('Próximamente', { exact: true })).toBeVisible();
      await expect(page.getByRole('banner').getByRole('button', { name: /^Tema / })).toBeVisible();
      expect(await hasHorizontalScroll(page), `horizontal scroll on ${p.path}`).toBe(false);
    }

    // The five labels of the bar fit side by side without being clipped.
    await page.goto('/');
    const links = mainNav(page).getByRole('link');
    const boxes: Box[] = [];
    for (const [i, name] of NAV_ES.entries()) {
      const link = links.nth(i);
      await expect(link).toContainText(name);
      const box = await boxOf(link);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      const clipped = await link.evaluate((el) =>
        [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))].some(
          (n) => n.scrollWidth > n.clientWidth + 1 && n.clientWidth > 0,
        ),
      );
      expect(clipped, `label "${name}" is clipped`).toBe(false);
      const prev = boxes.at(-1);
      if (prev) expect(box.x).toBeGreaterThanOrEqual(prev.x + prev.width - 0.5);
      boxes.push(box);
    }
  });

  test('AC-NAV-04 · reload keeps the page', async ({ page }) => {
    await gotoReady(page, '/progress', 'Progreso');
    await page.reload();
    await expect(page).toHaveURL(/\/progress$/);
    await expect(h1(page, 'Progreso')).toBeVisible();
    await expect(
      mainNav(page).getByRole('link', { name: 'Progreso', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('AC-NAV-05 · unknown addresses show not found and a way back', async ({ page }) => {
    await page.goto('/routines/does/not/exist');
    await expect(h1(page, 'Página no encontrada')).toBeVisible();

    await page.goto('/no-such-page');
    await expect(h1(page, 'Página no encontrada')).toBeVisible();
    await expect(page).toHaveTitle('Página no encontrada · Certavi');
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(0);

    await page.getByRole('link', { name: 'Volver a Hoy', exact: true }).click();
    await expect(h1(page, 'Hoy')).toBeVisible();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  });

  test('AC-NAV-06 · browser back button returns to the previous section', async ({ page }) => {
    await gotoReady(page, '/', 'Hoy');
    const nav = mainNav(page);
    await nav.getByRole('link', { name: 'Rutinas', exact: true }).click();
    await expect(h1(page, 'Rutinas')).toBeVisible();
    await nav.getByRole('link', { name: 'Ajustes', exact: true }).click();
    await expect(h1(page, 'Ajustes')).toBeVisible();

    await page.goBack();
    await expect(h1(page, 'Rutinas')).toBeVisible();
    await expect(page).toHaveURL(/\/routines$/);
    await expect(nav.getByRole('link', { name: 'Rutinas', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.goBack();
    await expect(h1(page, 'Hoy')).toBeVisible();
    await page.goForward();
    await expect(h1(page, 'Rutinas')).toBeVisible();
  });

  test('AC-NAV-07 · on a phone the bar is fixed at the bottom, even when scrolling', async ({
    page,
  }) => {
    const viewport = viewportOf(page);
    expect(viewport).toEqual({ width: 390, height: 844 });

    // /dev/ui is the longest page, so it scrolls.
    await gotoReady(page, '/dev/ui', 'Componentes');
    const nav = mainNav(page);

    const before = await boxOf(nav);
    expect(Math.abs(before.y + before.height - viewport.height)).toBeLessThanOrEqual(1);
    expect(before.y).toBeGreaterThan(viewport.height / 2);

    const lastLine = page.getByText('Número: 1234,5', { exact: true });
    const lastBefore = await boxOf(lastLine);
    await page.evaluate(() => {
      const se = document.scrollingElement ?? document.documentElement;
      se.scrollTop = se.scrollHeight;
    });
    const lastAfter = await boxOf(lastLine);
    expect(lastAfter.y).toBeLessThan(lastBefore.y);

    const after = await boxOf(nav);
    expect(Math.abs(after.y + after.height - viewport.height)).toBeLessThanOrEqual(1);
    expect(after.y).toBeCloseTo(before.y, 0);
    // The last content ends above the bar, not hidden behind it.
    expect(lastAfter.y + lastAfter.height).toBeLessThanOrEqual(after.y + 1);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  async function expectSkipLinkHidden(skip: Locator): Promise<void> {
    const hidden = await skip.boundingBox();
    const offscreenOrTiny =
      hidden === null ||
      hidden.width <= 1 ||
      hidden.height <= 1 ||
      hidden.y + hidden.height <= 0 ||
      hidden.x + hidden.width <= 0;
    expect(offscreenOrTiny, 'skip link should be hidden until focused').toBe(true);
  }

  async function expectSkipLinkShownAndJumps(page: Page, skip: Locator): Promise<void> {
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    const shown = await boxOf(skip);
    expect(shown.width).toBeGreaterThan(10);
    expect(shown.height).toBeGreaterThan(10);

    await page.keyboard.press('Enter');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const main = document.querySelector('main');
          const active = document.activeElement;
          return !!main && !!active && (main === active || main.contains(active));
        }),
      )
      .toBe(true);
  }

  test('AC-NAV-09 · skip link appears on the first Tab and jumps to the main content', async ({
    page,
    browserName,
  }) => {
    // Documented WebKit exception: with Safari's default settings Tab never reaches links (only
    // form controls and buttons), so "press Tab once" cannot reach the skip link there. The
    // keyboard step is checked in Chromium; visibility and the jump are checked in both engines
    // by the next test.
    test.skip(browserName === 'webkit', 'WebKit does not Tab to links by default');
    await gotoReady(page, '/routines', 'Rutinas');
    const skip = page.getByRole('link', { name: 'Saltar al contenido', exact: true });
    await expectSkipLinkHidden(skip);
    await page.keyboard.press('Tab');
    await expectSkipLinkShownAndJumps(page, skip);
    expect(new URL(page.url()).pathname).toBe('/routines');
  });

  test('AC-NAV-09 · a focused skip link is visible and Enter jumps to the main content', async ({
    page,
  }) => {
    await gotoReady(page, '/routines', 'Rutinas');
    const skip = page.getByRole('link', { name: 'Saltar al contenido', exact: true });
    await expectSkipLinkHidden(skip);
    await skip.focus();
    await expectSkipLinkShownAndJumps(page, skip);
    await expect(h1(page, 'Rutinas')).toBeVisible();
  });

  test('AC-NAV-10 · component catalog from Settings, not in the bar', async ({ page }) => {
    await gotoReady(page, '/settings', 'Ajustes');
    await expect(page.getByText('Desarrollo', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Catálogo de componentes', exact: true }).click();

    await expect(page).toHaveURL(/\/dev\/ui$/);
    await expect(h1(page, 'Componentes')).toBeVisible();
    await expect(page).toHaveTitle('Componentes · Certavi');

    const links = mainNav(page).getByRole('link');
    await expect(links).toHaveCount(5);
    const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
    expect(hrefs.some((h) => h.includes('/dev/ui'))).toBe(false);
  });

  test('edge · offline after loading, the shell keeps working without network requests', async ({
    page,
    context,
  }) => {
    await gotoReady(page, '/', 'Hoy');
    await page.waitForLoadState('networkidle');

    const requests: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return;
      if (r.resourceType() === 'font' || /\.(woff2?|ttf|otf)(\?|$)/.test(url)) return;
      requests.push(`${r.method()} ${url}`);
    });
    await context.setOffline(true);

    const nav = mainNav(page);
    for (const name of ['Calendario', 'Rutinas', 'Progreso', 'Ajustes', 'Hoy']) {
      await nav.getByRole('link', { name, exact: true }).click();
      await expect(h1(page, name)).toBeVisible();
    }
    await themeButton(page).click();
    await nav.getByRole('link', { name: 'Ajustes', exact: true }).click();
    await page.getByRole('link', { name: 'Catálogo de componentes', exact: true }).click();
    await expect(h1(page, 'Componentes')).toBeVisible();

    expect(requests).toEqual([]);
    await context.setOffline(false);
  });
});

test.describe('navigation · wide screen', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('AC-NAV-08 · on a 1024 px screen the navigation is at the top, in the header', async ({
    page,
  }) => {
    await gotoReady(page, '/', 'Hoy');
    expect(viewportOf(page).width).toBe(1024);

    const nav = mainNav(page);
    await expect(nav).toBeVisible();
    const navBox = await boxOf(nav);
    const vh = viewportOf(page).height;
    expect(navBox.y + navBox.height).toBeLessThan(vh / 4);

    const headerBox = await boxOf(page.getByRole('banner'));
    expect(navBox.y).toBeGreaterThanOrEqual(headerBox.y - 1);
    expect(navBox.y + navBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height + 1);

    await nav.getByRole('link', { name: 'Progreso', exact: true }).click();
    await expect(h1(page, 'Progreso')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
