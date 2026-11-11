import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  PAGES,
  THEME_COLORS,
  activeThemeColor,
  expectTheme,
  gotoReady,
  h1,
  mainNav,
  pageBackground,
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

  test('AC-THEME-09 · zero-dopamine mode: no colour has a hue anywhere (settings and a Progress page with data), at once; the theme button still cycles; turning it off brings the colour back', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.clock.setFixedTime(DATA_DAY);
    await gotoReady(page, '/settings', 'Ajustes');
    await expect(monoSwitch(page)).not.toBeChecked();
    await expect(page.getByText(MONO_HELP, { exact: true })).toBeVisible();
    // Colour is there to begin with: the check below is not vacuous.
    expect(
      (await hueOffenders(page)).length,
      'coloured elements before the switch',
    ).toBeGreaterThan(0);
    const noReload = await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
      return true;
    });
    expect(noReload).toBe(true);

    await monoSwitch(page).click();
    await expect(monoSwitch(page)).toBeChecked();
    // At once, without reloading: header, tabs, buttons, cards, switches ... all grey.
    await expect
      .poll(() => hueOffenders(page), { message: 'settings page in no-colour mode' })
      .toEqual([]);
    expect(
      await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
    ).toBe(true);

    // The theme still works and the button still cycles: light stays light grey, dark dark grey.
    const button = themeButton(page);
    await expect(button).toHaveAccessibleName(NAME.auto);
    expect(await luminance(page)).toBeGreaterThan(128);
    await button.click();
    await expect(button).toHaveAccessibleName(NAME.light);
    await expect.poll(() => luminance(page)).toBeGreaterThan(128);
    await button.click();
    await expect(button).toHaveAccessibleName(NAME.dark);
    await expect.poll(() => luminance(page)).toBeLessThan(80);
    await expect.poll(() => hueOffenders(page), { message: 'settings page, dark' }).toEqual([]);
    await button.click();
    await expect(button).toHaveAccessibleName(NAME.auto);
    await expect.poll(() => luminance(page)).toBeGreaterThan(128);

    // A Progress page with bars, in no-colour mode.
    await importSample(page);
    await expect(monoSwitch(page)).toBeChecked(); // importing a backup does not touch it
    await mainNav(page).getByRole('link', { name: 'Progreso', exact: true }).click();
    await expect(h1(page, 'Progreso')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Series por grupo muscular/ })).toBeVisible();
    await expect(page.getByRole('main').getByRole('listitem').first()).toBeVisible();
    await expect
      .poll(() => hueOffenders(page), { message: 'Progress in no-colour mode' })
      .toEqual([]);

    // Off again: the colours come back.
    await mainNav(page).getByRole('link', { name: 'Ajustes', exact: true }).click();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await monoSwitch(page).click();
    await expect(monoSwitch(page)).not.toBeChecked();
    await expect
      .poll(async () => (await hueOffenders(page)).length, { message: 'colour is back' })
      .toBeGreaterThan(0);
  });

  test('AC-THEME-10 · zero-dopamine mode is remembered and is already on at the first render, also on a dark phone; importing a backup does not change it', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await gotoReady(page, '/settings', 'Ajustes');
    await monoSwitch(page).click();
    await expect(monoSwitch(page)).toBeChecked();

    // From now on, record what the document looks like when the <body> first exists and when
    // the app first renders (before it, a page that still had its colours would flash them).
    await page.addInitScript(() => {
      const w = window as unknown as { __first: Record<string, unknown> };
      w.__first = {};
      // At the very start of the document there may be no <body> yet (the types say there is).
      const body = (): HTMLElement | null => document.querySelector('body');
      const snap = (): Record<string, string> => ({
        attrs: Array.from(document.documentElement.attributes)
          .filter((a) => a.name === 'class' || a.name.startsWith('data-'))
          .map((a) => `${a.name}=${a.value}`)
          .sort()
          .join(' '),
        htmlBg: getComputedStyle(document.documentElement).backgroundColor,
        bodyBg: body() ? getComputedStyle(document.body).backgroundColor : '',
      });
      const observer = new MutationObserver(() => {
        if (!w.__first.body && body()) w.__first.body = snap();
        if (!w.__first.render && body()?.querySelector('header, main, nav')) {
          w.__first.render = snap();
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
      window.addEventListener('load', () => {
        w.__first.final = snap();
      });
    });
    await page.reload();
    await expect(h1(page, 'Ajustes')).toBeVisible();
    await expect(monoSwitch(page)).toBeChecked();
    await expect.poll(() => hueOffenders(page), { message: 'after the reload' }).toEqual([]);

    interface Snap {
      attrs: string;
      htmlBg: string;
      bodyBg: string;
    }
    const first = await page.evaluate(
      () =>
        (window as unknown as { __first: { body?: Snap; render?: Snap; final?: Snap } }).__first,
    );
    expect(first.render, 'the app rendered').toBeDefined();
    expect(first.final, 'the page finished loading').toBeDefined();
    // Whatever marks the mode on the document is already there when the body first exists ...
    expect(first.body?.attrs, 'document attributes when the body first exists').toBe(
      first.final?.attrs,
    );
    // ... and no coloured background is ever seen (transparent = not painted yet).
    for (const [when, snap] of Object.entries({ body: first.body, render: first.render })) {
      for (const bg of [snap?.htmlBg, snap?.bodyBg]) {
        if (!bg || bg === 'rgba(0, 0, 0, 0)') continue;
        expect(isGrey(bg), `${when}: background ${bg} has a hue`).toBe(true);
      }
    }

    // A device setting: importing a backup leaves it on.
    await page.clock.setFixedTime(DATA_DAY);
    await importSample(page);
    await expect(monoSwitch(page)).toBeChecked();
    await page.reload();
    await expect(monoSwitch(page)).toBeChecked();
  });

  test('AC-THEME-11 · zero-dopamine mode: no serious axe issues on Progress in dark and in light, and theme-color matches the background', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.clock.setFixedTime(DATA_DAY);
    await gotoReady(page, '/settings', 'Ajustes');
    await monoSwitch(page).click();
    await expect(monoSwitch(page)).toBeChecked();
    await importSample(page);
    await mainNav(page).getByRole('link', { name: 'Progreso', exact: true }).click();
    await expect(h1(page, 'Progreso')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Series por grupo muscular/ })).toBeVisible();

    for (const scheme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      if (scheme === 'dark') await expect.poll(() => luminance(page)).toBeLessThan(80);
      else await expect.poll(() => luminance(page)).toBeGreaterThan(128);
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      // The browser colour is the page background (as hex).
      await expect
        .poll(async () => activeThemeColor(page), { message: `theme-color in ${scheme}` })
        .toBe(toHex(await pageBackground(page)));
      await expectNoSeriousViolations(page, `Progress, no-colour mode, ${scheme}`);
    }
  });

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

// ---------------------------------------------------------------------------------------------
// Zero-dopamine mode helpers (AC-THEME-09 / 10 / 11)
// ---------------------------------------------------------------------------------------------

const MONO = 'Sin color (modo 0 dopamina)';
const MONO_HELP = 'Todo en blanco, negro y gris, sobre el tema claro u oscuro.';
const SAMPLE = path.join(process.cwd(), 'tests', 'fixtures', 'certavi-backup-sample.json');
/** A Wednesday inside the weeks of the sample's sessions, so Progress has bars to look at. */
const DATA_DAY = new Date(2026, 9, 21, 12, 0);

function monoSwitch(page: Page): Locator {
  return page.getByRole('switch', { name: MONO, exact: true });
}

/** Loads the synthetic Certavi backup from Settings ("Importar copia de Certavi"). */
async function importSample(page: Page): Promise<void> {
  await mainNav(page).getByRole('link', { name: 'Ajustes', exact: true }).click();
  await expect(h1(page, 'Ajustes')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar copia de Certavi', exact: true }).click();
  await (await chooser).setFiles(SAMPLE);
  const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(
    page.getByText('Registros importados: 29', { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(dialog).toBeHidden();
}

/** Red, green, blue (0-255) of an `rgb()` / `rgba()` / `color(srgb …)` string; undefined if other. */
function channels(color: string): [number, number, number] | undefined {
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(color);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255];
  return undefined;
}

function isGrey(color: string): boolean {
  const c = channels(color);
  return c !== undefined && Math.max(...c) - Math.min(...c) <= 1;
}

function toHex(color: string): string {
  const c = channels(color);
  if (!c) return `unparsed:${color}`;
  return `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Mean of the channels of the page background (0 black … 255 white). */
async function luminance(page: Page): Promise<number> {
  const c = channels(await pageBackground(page));
  return c ? (c[0] + c[1] + c[2]) / 3 : NaN;
}

/**
 * Every visible colour on the page that has a hue: text, backgrounds, borders and SVG fills and
 * strokes of the rendered elements (images are left out: a logo file is not a CSS colour).
 * Empty means the page is black, white and grey (channels within 1 of each other).
 */
async function hueOffenders(page: Page): Promise<string[]> {
  return page.evaluate((): string[] => {
    const parse = (value: string): { hue: boolean; transparent: boolean } => {
      const v = value.trim();
      if (v === '' || v === 'none' || v === 'transparent') return { hue: false, transparent: true };
      const num = (s: string): number => (s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s));
      const rgb = /^rgba?\(([^)]+)\)$/.exec(v);
      const srgb = /^color\((?:srgb|srgb-linear|display-p3)\s+([^)]+)\)$/.exec(v);
      const body = rgb?.[1] ?? srgb?.[1];
      if (body !== undefined) {
        const [color = '', alpha] = body.split('/');
        const parts = color
          .split(/[\s,]+/)
          .filter(Boolean)
          .map(num);
        const a = alpha !== undefined ? num(alpha.trim()) : (rgb && parts[3]) || 1;
        if (a === 0) return { hue: false, transparent: true };
        const [r = 0, g = 0, b = 0] = parts;
        const scale = srgb ? 255 : 1;
        return { hue: (Math.max(r, g, b) - Math.min(r, g, b)) * scale > 1, transparent: false };
      }
      const lab = /^(?:oklab|lab)\(\s*\S+\s+(\S+)\s+([^\s/)]+)/.exec(v);
      if (lab) {
        const limit = v.startsWith('oklab') ? 0.004 : 1;
        return {
          hue: Math.hypot(num(lab[1] ?? '0'), num(lab[2] ?? '0')) > limit,
          transparent: false,
        };
      }
      const lch = /^(?:oklch|lch)\(\s*\S+\s+(\S+)/.exec(v);
      if (lch) {
        const limit = v.startsWith('oklch') ? 0.004 : 1;
        return { hue: num(lch[1] ?? '0') > limit, transparent: false };
      }
      return { hue: true, transparent: false }; // a colour format we cannot read: report it
    };
    const out: string[] = [];
    const describe = (el: Element, prop: string, value: string): string => {
      const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24);
      const cls =
        typeof el.className === 'string' && el.className
          ? `.${el.className.split(' ')[0] ?? ''}`
          : '';
      return `${el.tagName.toLowerCase()}${cls} "${text}" ${prop}=${value}`;
    };
    const SVG_SHAPES = new Set([
      'path',
      'rect',
      'circle',
      'line',
      'polyline',
      'polygon',
      'ellipse',
      'text',
    ]);
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'img', 'meta', 'link', 'title'].includes(tag)) continue;
      if (el.getClientRects().length === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.opacity === '0') continue;
      const checks: [string, string][] = [['background-color', style.backgroundColor]];
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        if (style[`border${side}Style`] !== 'none' && parseFloat(style[`border${side}Width`]) > 0) {
          checks.push([`border-${side.toLowerCase()}-color`, style[`border${side}Color`]]);
        }
      }
      const ownText = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
      );
      if (ownText || ['input', 'select', 'textarea', 'button'].includes(tag)) {
        checks.push(['color', style.color]);
      }
      if (SVG_SHAPES.has(tag)) {
        checks.push(['fill', style.fill], ['stroke', style.stroke]);
      }
      for (const [prop, value] of checks) {
        if (parse(value).hue) out.push(describe(el, prop, value));
      }
    }
    return out.slice(0, 12);
  });
}
