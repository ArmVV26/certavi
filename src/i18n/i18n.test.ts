import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';
import { createI18n } from './index';

type Tree = { [key: string]: string | Tree };

/** "a.b.c" → value, for every leaf of a nested resource object. */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (text: string) =>
  [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

const esKeys = flatten(es);
const enKeys = flatten(en);

describe('translations', () => {
  it('have exactly the same keys in Spanish and English', () => {
    expect([...enKeys.keys()].sort()).toEqual([...esKeys.keys()].sort());
  });

  it('have no empty texts', () => {
    for (const [key, value] of [...esKeys, ...enKeys]) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('use the same {{placeholders}} in both languages', () => {
    for (const [key, value] of esKeys) {
      expect(placeholders(enKeys.get(key) ?? ''), key).toEqual(placeholders(value));
    }
  });

  it('localizes the warm-up symbol: C in Spanish, W in English', () => {
    expect(es.sets.warmupSymbol).toBe('C');
    expect(en.sets.warmupSymbol).toBe('W');
  });
});

describe('createI18n', () => {
  it('is ready synchronously in the requested language', () => {
    const i18n = createI18n('en');
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.t('nav.today')).toBe('Today');
  });

  it('interpolates without HTML-escaping (React escapes)', () => {
    const i18n = createI18n('es');
    expect(i18n.t('app.documentTitle', { page: 'Hoy & más' })).toBe('Hoy & más · Certavi');
  });

  it('switches language', async () => {
    const i18n = createI18n('es');
    expect(i18n.t('nav.settings')).toBe('Ajustes');
    await i18n.changeLanguage('en');
    expect(i18n.t('nav.settings')).toBe('Settings');
  });
});
