// public/theme-init.js runs before the page is drawn and must give the same result as initTheme()
// (src/theme/theme.ts), which runs later; this keeps the two copies of the logic in step.
import { describe, expect, it } from 'vitest';
import { setSystemDark } from '../test/matchMedia';
import indexHtml from '../../index.html?raw';
import themeInitScript from '../../public/theme-init.js?raw';
import { MONO_STORAGE_KEY, THEME_STORAGE_KEY, initTheme } from './theme';

type Setting = 'light' | 'dark' | 'system' | 'purple' | null;

const root = document.documentElement;
const marks = () => ({ theme: root.dataset.theme, mono: root.hasAttribute('data-mono') });
const clear = () => {
  delete root.dataset.theme;
  root.removeAttribute('data-mono');
};

function runScript() {
  clear();
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- the script is plain JavaScript, run the way a browser runs it
  new Function(themeInitScript)();
  return marks();
}

describe('public/theme-init.js', () => {
  it('is loaded by index.html as a blocking script before the app', () => {
    expect(indexHtml).toMatch(/<script src="\/theme-init\.js"><\/script>/);
    expect(indexHtml.indexOf('/theme-init.js')).toBeLessThan(indexHtml.indexOf('type="module"'));
  });

  it('reads the same storage keys as the app', () => {
    expect(themeInitScript).toContain(`'${THEME_STORAGE_KEY}'`);
    expect(themeInitScript).toContain(`'${MONO_STORAGE_KEY}'`);
  });

  it.each<[Setting, boolean, boolean]>([
    [null, false, false],
    [null, true, false],
    ['light', true, false],
    ['dark', false, true],
    ['system', true, true],
    ['system', false, true],
    ['purple', true, false],
    [null, false, true],
    ['dark', true, true],
  ])('gives what initTheme gives: theme %s, phone dark %s, no-colour %s', (theme, dark, mono) => {
    setSystemDark(dark);
    if (theme) localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (mono) localStorage.setItem(MONO_STORAGE_KEY, 'on');

    const early = runScript();
    clear();
    initTheme(window);
    expect(early).toEqual(marks());
    expect(early.mono).toBe(mono);
  });

  it('does nothing, and does not throw, when the storage is blocked', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    try {
      expect(runScript()).toEqual({ theme: undefined, mono: false });
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});
