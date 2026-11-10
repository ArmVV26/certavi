import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  NAV_ES,
  NAV_PATHS,
  PAGES,
  boxOf,
  expectTheme,
  gotoReady,
  h1,
  hasHorizontalScroll,
  mainNav,
  themeButton,
  viewportOf,
  type Box,
} from './helpers';

interface LogoInfo {
  found: boolean;
  decorative: boolean;
  inLink: boolean;
  beforeTitle: boolean;
  /** Distance (px) from the right edge of the logo to the left edge of the title text. */
  gapToTitle: number;
  /** Vertical centre of the logo is inside the vertical span of the title. */
  sameRow: boolean;
  width: number;
  height: number;
  insideViewport: boolean;
}

/** The logo of the header: the first image or drawing in the header that is not a button or a bar link. */
async function logoInfo(page: Page): Promise<LogoInfo> {
  return page.getByRole('banner').evaluate((banner): LogoInfo => {
    const empty: LogoInfo = {
      found: false,
      decorative: false,
      inLink: false,
      beforeTitle: false,
      gapToTitle: NaN,
      sameRow: false,
      width: 0,
      height: 0,
      insideViewport: false,
    };
    const logo = Array.from(banner.querySelectorAll('svg, img')).find(
      (el) => !el.closest('nav') && !el.closest('button'),
    );
    const title = document.querySelector('h1');
    if (!logo || !title) return empty;
    const hidden =
      logo.closest('[aria-hidden="true"]') !== null ||
      ['none', 'presentation'].includes(logo.getAttribute('role') ?? '');
    const named =
      !!logo.getAttribute('aria-label') ||
      !!logo.getAttribute('aria-labelledby') ||
      !!logo.querySelector('title') ||
      !!logo.getAttribute('alt');
    const range = document.createRange();
    range.selectNodeContents(title);
    const text = range.getBoundingClientRect();
    const box = logo.getBoundingClientRect();
    const mid = box.top + box.height / 2;
    return {
      found: true,
      decorative: hidden || (!named && logo.getAttribute('role') !== 'img'),
      inLink: logo.closest('a') !== null,
      beforeTitle: (logo.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      gapToTitle: text.left - box.right,
      sameRow: mid >= text.top && mid <= text.bottom,
      width: box.width,
      height: box.height,
      insideViewport: box.left >= 0 && box.right <= window.innerWidth && box.top >= 0,
    };
  });
}

async function expectLogoOnEverySection(page: Page): Promise<void> {
  for (const p of PAGES.slice(0, 5)) {
    await gotoReady(page, p.path, p.es);
    const logo = await logoInfo(page);
    expect(logo.found, `logo in the header of ${p.path}`).toBe(true);
    expect(logo.decorative, `logo of ${p.path} is hidden from screen readers`).toBe(true);
    expect(logo.inLink, `logo of ${p.path} is not a link`).toBe(false);
    expect(logo.beforeTitle, `logo of ${p.path} comes before the title`).toBe(true);
    expect(logo.gapToTitle, `logo of ${p.path} is to the left of the title`).toBeGreaterThanOrEqual(
      -1,
    );
    expect(logo.sameRow, `logo of ${p.path} is on the title row`).toBe(true);
    expect(logo.width, `logo of ${p.path} has a size`).toBeGreaterThanOrEqual(12);
    expect(logo.height).toBeGreaterThanOrEqual(12);
    expect(logo.insideViewport, `logo of ${p.path} is on screen`).toBe(true);
    // Not announced: no image in the header's accessibility tree.
    await expect(page.getByRole('banner').getByRole('img')).toHaveCount(0);
  }
}

/** Waits until the page of `name` is whole: opaque, uncovered, with content, no running fade. */
async function expectPageSettled(page: Page, name: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const title = document.querySelector('h1');
          const main = document.querySelector('main');
          if (!title || !main) return { ok: false, why: 'no title or main' };
          let opacity = 1;
          for (let el: Element | null = title; el; el = el.parentElement) {
            opacity *= parseFloat(getComputedStyle(el).opacity);
          }
          const box = title.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          const fading = document.getAnimations().filter((a) => {
            const effect = a.effect as KeyframeEffect | null;
            return (
              a.playState === 'running' &&
              (effect?.pseudoElement ?? '').startsWith('::view-transition')
            );
          }).length;
          const why = [
            opacity < 0.99 ? `opacity ${String(opacity)}` : '',
            hit && (hit === title || title.contains(hit)) ? '' : 'title covered',
            main.innerText.trim().length < 3 ? 'main is blank' : '',
            getComputedStyle(main).visibility === 'visible' ? '' : 'main hidden',
            fading > 0 ? `${String(fading)} view transitions running` : '',
          ]
            .filter(Boolean)
            .join('; ');
          return { ok: why === '', why };
        }),
      { message: `page "${name}" must be whole once the change has finished` },
    )
    .toEqual({ ok: true, why: '' });
}

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

  test(
    'AC-NAV-03 · every page shows its title, content and theme button, and fits 390 px',
    {
      tag: '@all-engines',
    },
    async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(p.path);
        await expect(h1(page, p.es)).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(page).toHaveTitle(`${p.es} · Certavi`);
        if (p.contentEs) await expect(page.getByText(p.contentEs, { exact: true })).toBeVisible();
        if (p.soon) await expect(page.getByText('Próximamente', { exact: true })).toBeVisible();
        await expect(
          page.getByRole('banner').getByRole('button', { name: /^Tema / }),
        ).toBeVisible();
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
    },
  );

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

  test('AC-NAV-11 · at 390 px every section shows a decorative logo before the title, in both themes', async ({
    page,
  }) => {
    expect(viewportOf(page).width).toBe(390);
    await expectLogoOnEverySection(page);

    await page.emulateMedia({ colorScheme: 'dark' });
    await gotoReady(page, '/', 'Hoy');
    await expectTheme(page, 'dark');
    const dark = await logoInfo(page);
    expect(dark.found).toBe(true);
    expect(dark.width).toBeGreaterThanOrEqual(12);
    expect(dark.decorative).toBe(true);
  });

  test('AC-NAV-12 · changing section shows and focuses the heading, changes the address and never leaves the page blank, covered or faded', async ({
    page,
  }) => {
    await gotoReady(page, '/', 'Hoy');
    await expectPageSettled(page, 'Hoy');
    const nav = mainNav(page);
    const visits = [
      ...PAGES.slice(1, 5).map((p) => ({ name: p.es, path: p.path, content: p.contentEs })),
      { name: 'Hoy', path: '/', content: PAGES[0]?.contentEs },
    ];
    for (const { name, path, content } of visits) {
      await nav.getByRole('link', { name, exact: true }).click();
      await expect(h1(page, name)).toBeVisible();
      await expect(h1(page, name)).toBeFocused();
      await expect.poll(() => new URL(page.url()).pathname).toBe(path);
      if (content) await expect(page.getByText(content, { exact: true })).toBeVisible();
      await expectPageSettled(page, name);
    }

    // Quick succession: two taps in a row still end on the last section, whole.
    await nav.getByRole('link', { name: 'Rutinas', exact: true }).click();
    await nav.getByRole('link', { name: 'Progreso', exact: true }).click();
    await expect(h1(page, 'Progreso')).toBeFocused();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/progress');
    await expectPageSettled(page, 'Progreso');
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test('AC-ABOUT-01 · Settings ends with the "Acerca de" card: name, version from package.json and the GitHub link', async ({
    page,
  }) => {
    const version = (
      JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
        version: string;
      }
    ).version;
    await gotoReady(page, '/settings', 'Ajustes');
    const main = page.getByRole('main');
    await expect(main.getByText('Acerca de', { exact: true })).toBeVisible();

    // The card: the outermost ancestor of the title that holds no other card title.
    const about = main
      .getByText('Acerca de', { exact: true })
      .locator(
        'xpath=ancestor::*[not(.//*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5 or self::h6][normalize-space(.)!="Acerca de"]) and not(.//*[normalize-space(text())="Apariencia"]) and not(.//*[normalize-space(text())="Desarrollo"])][last()]',
      );

    // It is the last card: nothing with text follows it, at any level up to <main>.
    const nothingAfter = await about.evaluate((card) => {
      const main = document.querySelector('main');
      for (let el: Element | null = card; el && el !== main; el = el.parentElement) {
        for (let s = el.nextElementSibling; s; s = s.nextElementSibling) {
          if (s.textContent.trim() !== '') return false;
        }
      }
      return true;
    });
    expect(nothingAfter, 'no card after "Acerca de"').toBe(true);
    // Reading order, which does not depend on where the page is scrolled to.
    const titles = await main.getByRole('heading', { level: 2 }).allTextContents();
    expect(titles.at(-1), 'the last card of Ajustes').toBe('Acerca de');
    for (const earlier of ['Apariencia', 'Desarrollo']) {
      expect(titles.indexOf(earlier), `"${earlier}" comes before "Acerca de"`).toBeGreaterThan(-1);
    }

    await expect(about.getByText('Certavi', { exact: true })).toBeVisible();
    await expect(about.getByText(`Versión ${version}`, { exact: true })).toBeVisible();
    const link = about.getByRole('link', { name: 'Código fuente en GitHub', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /^https:\/\/github\.com\//);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /(^|\s)noopener(\s|$)/);
  });

  test('edge · offline after loading, the shell keeps working without network requests', async ({
    page,
    context,
  }) => {
    await gotoReady(page, '/', 'Hoy');
    // Every screen but Today is a lazy route (its code is a separate file, downloaded when it is
    // opened; the service worker, blocked in this spec, would have it stored). Open them once
    // while online so the offline part below only exercises navigation that is already loaded.
    for (const name of ['Calendario', 'Rutinas', 'Progreso', 'Ajustes']) {
      await mainNav(page).getByRole('link', { name, exact: true }).click();
      await expect(h1(page, name)).toBeVisible();
    }
    await page.getByRole('link', { name: 'Catálogo de componentes', exact: true }).click();
    await expect(h1(page, 'Componentes')).toBeVisible();
    await mainNav(page).getByRole('link', { name: 'Hoy', exact: true }).click();
    await expect(h1(page, 'Hoy')).toBeVisible();
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

  test('AC-NAV-11 · at 1024 px every section shows a decorative logo before the title', async ({
    page,
  }) => {
    expect(viewportOf(page).width).toBe(1024);
    await expectLogoOnEverySection(page);
  });

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
