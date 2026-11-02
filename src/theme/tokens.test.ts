// Guards the design tokens: every theme defines every colour, the two dark blocks match,
// theme-color equals --bg, and every colour pair the UI uses meets WCAG AA (4.5:1).
import { describe, expect, it } from 'vitest';
import { THEME_COLOR } from './theme';
import tokensCss from './tokens.css?raw';

type Declarations = Map<string, string>;

/**
 * Flat rule blocks of the stylesheet, keyed by selector (rules nested in @media included).
 * The first rule for a selector wins, so the later `:root` override inside
 * `prefers-reduced-motion` does not hide the base `:root` block.
 */
function parseRules(css: string): Map<string, Declarations> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = new Map<string, Declarations>();
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '').trim().replace(/\s+/g, ' ');
    if (rules.has(selector)) continue;
    const declarations: Declarations = new Map();
    for (const declaration of (match[2] ?? '').split(';')) {
      const colon = declaration.indexOf(':');
      if (colon === -1) continue;
      declarations.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
    }
    rules.set(selector, declarations);
  }
  return rules;
}

const rules = parseRules(tokensCss);
const LIGHT = ":root, :root[data-theme='light']";
const DARK_SYSTEM = ':root:not([data-theme])';
const DARK_APP = ":root[data-theme='dark']";

function block(selector: string): Declarations {
  const found = rules.get(selector);
  if (!found) throw new Error(`tokens.css has no rule for ${selector}`);
  return found;
}

const COLOR_TOKENS = [
  '--bg',
  '--surface',
  '--surface-2',
  '--border',
  '--text',
  '--text-muted',
  '--accent',
  '--on-accent',
  '--success',
  '--warning',
  '--danger',
  '--warmup',
] as const;
type ColorToken = (typeof COLOR_TOKENS)[number];
type TintToken =
  '--accent-tint' | '--success-tint' | '--warning-tint' | '--danger-tint' | '--warmup-tint';
type Palette = Record<ColorToken | TintToken, string>;

// ---------- WCAG 2.x contrast ----------
const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const [r = 0, g = 0, b = 0] = toRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Same as CSS `color-mix(in srgb, fg amount, bg)`. */
const mix = (fg: string, bg: string, amount: number) => {
  const b = toRgb(bg);
  return (
    '#' +
    toRgb(fg)
      .map((v, i) =>
        Math.round(v * amount + (b[i] ?? 0) * (1 - amount))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
};

const tintAmount = parseFloat(block(':root').get('--tint-amount') ?? 'NaN') / 100;

function palette(selector: string): Palette {
  const declarations = block(selector);
  const colors = Object.fromEntries(
    COLOR_TOKENS.map((token) => [token, declarations.get(token) ?? '']),
  ) as Record<ColorToken, string>;
  const tint = (token: ColorToken) => mix(colors[token], colors['--surface'], tintAmount);
  return {
    ...colors,
    '--accent-tint': tint('--accent'),
    '--success-tint': tint('--success'),
    '--warning-tint': tint('--warning'),
    '--danger-tint': tint('--danger'),
    '--warmup-tint': tint('--warmup'),
  };
}

// Foreground / background pairs used by the UI (same list as the design selector).
const TEXT_PAIRS: readonly [keyof Palette, keyof Palette, string][] = [
  ['--text', '--bg', 'main text on the page'],
  ['--text', '--surface', 'main text on a card'],
  ['--text', '--surface-2', 'text on a secondary button / field'],
  ['--text-muted', '--bg', 'secondary text on the page'],
  ['--text-muted', '--surface', 'secondary text on a card'],
  ['--text-muted', '--surface-2', 'suggested value in a field'],
  ['--accent', '--surface', 'active tab, links'],
  ['--accent', '--bg', 'accent text on the page'],
  ['--on-accent', '--accent', 'primary button label'],
  ['--accent', '--accent-tint', 'rest timer, accent chip'],
  ['--success', '--surface', 'done set, improvement'],
  ['--text', '--success-tint', 'numbers in a done set'],
  ['--warning', '--surface', 'warning text'],
  ['--warning', '--warning-tint', 'warning chip'],
  ['--danger', '--surface', 'danger text'],
  ['--danger', '--danger-tint', 'danger chip'],
  ['--warmup', '--surface', 'warm-up text'],
  ['--warmup', '--warmup-tint', 'warm-up badge (C / W)'],
];

describe('design tokens', () => {
  it.each([LIGHT, DARK_SYSTEM, DARK_APP])(
    '%s defines every colour token as a hex value',
    (selector) => {
      const declarations = block(selector);
      for (const token of COLOR_TOKENS) {
        expect(declarations.get(token), token).toMatch(/^#[0-9a-f]{6}$/);
      }
    },
  );

  it('keeps the system-dark and app-dark blocks identical', () => {
    expect(Object.fromEntries(block(DARK_SYSTEM))).toEqual(Object.fromEntries(block(DARK_APP)));
  });

  it('uses a 12 % tint for badges and chips', () => {
    expect(tintAmount).toBe(0.12);
  });

  it('matches theme-color with --bg in each theme', () => {
    expect(block(LIGHT).get('--bg')).toBe(THEME_COLOR.light);
    expect(block(DARK_APP).get('--bg')).toBe(THEME_COLOR.dark);
  });

  describe.each([
    ['light', LIGHT],
    ['dark', DARK_APP],
  ])('%s theme contrast (WCAG AA ≥ 4.5:1)', (_name, selector) => {
    const colors = palette(selector);
    it.each(TEXT_PAIRS)('%s on %s (%s)', (fg, bg) => {
      expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
    });
  });
});
