import { expect, type Locator, type Page } from '@playwright/test';

/** Background / theme-color values from the spec (AC-THEME-07). */
export const THEME_COLORS = {
  light: { hex: '#f4f5f7', rgb: 'rgb(244, 245, 247)' },
  dark: { hex: '#0b0f14', rgb: 'rgb(11, 15, 20)' },
} as const;

export type Mode = keyof typeof THEME_COLORS;

export interface PageInfo {
  path: string;
  es: string;
  en: string;
  /** Visible content that identifies the page (heading or text), es / en. */
  contentEs?: string;
  contentEn?: string;
  /** Shows the "Próximamente" / "Coming soon" label. */
  soon?: boolean;
}

export const PAGES: readonly PageInfo[] = [
  {
    path: '/',
    es: 'Hoy',
    en: 'Today',
    contentEs: 'La sesión de hoy',
    contentEn: "Today's session",
    // Real content since Phase 5 (docs/spec/today.md): no "Próximamente" any more.
  },
  {
    path: '/calendar',
    es: 'Calendario',
    en: 'Calendar',
    contentEs: 'Nada registrado este mes',
    contentEn: 'Nothing logged this month',
    // Real content since Phase 7 (docs/spec/calendar.md): no "Próximamente" any more.
  },
  {
    path: '/routines',
    es: 'Rutinas',
    en: 'Routines',
    contentEs: 'Tus rutinas',
    contentEn: 'Your routines',
    // Real content since Phase 6 (docs/spec/routines.md): no "Próximamente" any more.
  },
  {
    path: '/progress',
    es: 'Progreso',
    en: 'Progress',
    contentEs: 'Todavía no hay datos',
    contentEn: 'No data yet',
    // Real content since Phase 7 (docs/spec/progress.md): no "Próximamente" any more.
  },
  {
    path: '/settings',
    es: 'Ajustes',
    en: 'Settings',
    contentEs: 'Apariencia',
    contentEn: 'Appearance',
  },
  {
    path: '/dev/ui',
    es: 'Componentes',
    en: 'Components',
    contentEs: 'Botones',
    contentEn: 'Buttons',
  },
  { path: '/no-such-page', es: 'Página no encontrada', en: 'Page not found' },
];

export const NAV_ES = ['Hoy', 'Calendario', 'Rutinas', 'Progreso', 'Ajustes'] as const;
export const NAV_EN = ['Today', 'Calendar', 'Routines', 'Progress', 'Settings'] as const;
export const NAV_PATHS = ['/', '/calendar', '/routines', '/progress', '/settings'] as const;

export function h1(page: Page, name?: string): Locator {
  return name === undefined
    ? page.getByRole('heading', { level: 1 })
    : page.getByRole('heading', { level: 1, name, exact: true });
}

export function mainNav(page: Page, lang: 'es' | 'en' = 'es'): Locator {
  return page.getByRole('navigation', { name: lang === 'es' ? 'Principal' : 'Main', exact: true });
}

/** The header theme button, whatever its current state or language. */
export function themeButton(page: Page): Locator {
  return page.getByRole('button', {
    name: /^(Tema (automático|claro|oscuro)\. Cambiar a|(Automatic|Light|Dark) theme\. Switch to)/,
  });
}

/** Effective page background (body, falling back to html). */
export async function pageBackground(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (const el of [document.body, document.documentElement]) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
    }
    return 'transparent';
  });
}

/** The theme-color meta that currently applies (honours `media` attributes). */
export async function activeThemeColor(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const metas = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
    );
    const active = metas.find((m) => !m.media || window.matchMedia(m.media).matches);
    return active ? active.content.trim().toLowerCase() : null;
  });
}

/** Asserts the page is rendered in the given theme (background colour from the spec). */
export async function expectTheme(page: Page, mode: Mode): Promise<void> {
  await expect
    .poll(() => pageBackground(page), { message: `page background should be ${mode}` })
    .toBe(THEME_COLORS[mode].rgb);
}

export async function gotoReady(page: Page, path: string, title: string): Promise<void> {
  await page.goto(path);
  await expect(h1(page, title)).toBeVisible();
}

/** Switches the language from Settings. */
export async function setLanguage(page: Page, lang: 'es' | 'en'): Promise<void> {
  await page.goto('/settings');
  await expect(h1(page)).toBeVisible();
  await page
    .getByRole('radio', { name: lang === 'en' ? 'English' : 'Español', exact: true })
    .check();
  await expect(h1(page, lang === 'en' ? 'Settings' : 'Ajustes')).toBeVisible();
}

export async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

/** Spanish UI words from the spec that must not appear once the UI is in English. */
export const SPANISH_UI_WORDS = [
  'Hoy',
  'Calendario',
  'Rutinas',
  'Progreso',
  'Ajustes',
  'Principal',
  'Apariencia',
  'Tema',
  'Idioma',
  'Automático',
  'Claro',
  'Oscuro',
  'Desarrollo',
  'Catálogo de componentes',
  'Próximamente',
  'Saltar al contenido',
  'La sesión de hoy',
  'Nada registrado este mes',
  'Tus rutinas',
  'Tu progreso',
  'Todavía no hay datos',
  'Página no encontrada',
  'Volver a Hoy',
  'Componentes',
  'Botones',
  'Botones de icono',
  'Chips y etiquetas',
  'Tarjeta',
  'Campos numéricos',
  'Selector segmentado',
  'Interruptor',
  'Diálogo',
  'Hoja inferior',
  'Avisos',
  'Estado vacío',
  'Fechas y números',
  'Número',
  'Valor',
  'vacío',
  'Peso',
  'Repeticiones',
  'Periodo',
  'Esta semana',
  'Pasada',
  'Media 4 sem',
  'Sonido al acabar el descanso',
  'Vibración',
  'Mostrar aviso',
  'Añadir ejercicio',
  'Añadir serie',
  'Quitar serie',
  'Quitar',
  'Cancelar',
  'Cerrar',
  'Empezar sesión',
  'Otra rutina',
  'Desactivado',
  'Banda',
  'Creados por mí',
  'Calentamiento',
  'Disminuir',
  'Aumentar',
] as const;

/** Returns the Spanish UI words found as whole words in the given text. */
export function findSpanishWords(text: string): string[] {
  return SPANISH_UI_WORDS.filter((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'u').test(text);
  });
}

/** Text of all accessible names (aria-label / title / alt) on the page, plus visible text. */
export async function allUiText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [document.body.innerText, document.title];
    document.querySelectorAll('[aria-label],[title],[alt],[placeholder]').forEach((el) => {
      for (const attr of ['aria-label', 'title', 'alt', 'placeholder']) {
        const v = el.getAttribute(attr);
        if (v) parts.push(v);
      }
    });
    return parts.join('\n');
  });
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding box of a visible element (fails the test if it has none). */
export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`No bounding box for ${locator.toString()}`);
  return box;
}

export function viewportOf(page: Page): { width: number; height: number } {
  const vp = page.viewportSize();
  if (!vp) throw new Error('No viewport');
  return vp;
}

/**
 * Resolves after two animation frames: whatever the page reacts to has been rendered. For checks
 * that "nothing happens" after an action. It only covers what the page does synchronously or in
 * the next frames; if the thing that must not happen would come from an app timer, move that
 * timer with `page.clock` instead. Never a real-time wait (see .claude/rules.md).
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}
