// No orphan translations: every key of es.json is used by the app. The opposite direction (every
// key the app uses exists) is checked by the typed `t()` and by seedKeys.test.ts.
//
// Most keys are written out in the source (`t('nav.today')`). Some are built at run time
// (`t(`sync.status.${status}`)`): they are accepted when a template prefix matches AND the last
// part of the key (the variant: `wrongKey`, `warmup`, `press-inclinado-mancuernas`…) still appears
// as a string somewhere in the source, so a variant that no code produces any more is reported.
import { describe, expect, it } from 'vitest';
import es from './es.json';

const files = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const source = Object.entries(files)
  .filter(([path]) => !/\.test\.tsx?$|\.d\.ts$|\/test\/|\/testing\//.test(path))
  .map(([, text]) => text)
  .join('\n');

function leaves(node: object, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]: [string, unknown]) =>
    typeof value === 'object' && value !== null
      ? leaves(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

/** `key_one`, `key_other`… are the plural forms of the key `key`. */
const baseKey = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

const written = (key: string) =>
  [`'${key}'`, `"${key}"`, `\`${key}\``].some((q) => source.includes(q)) ||
  // The seed blocks write their keys through the helper `k('names.ankleRehab')` = 'blocks.names…'.
  (key.startsWith('blocks.') && source.includes(`k('${key.slice('blocks.'.length)}')`));

const templatePrefixes = [
  ...source.matchAll(/`([\w.-]+)\.\$\{/g),
  ...source.matchAll(/'([\w.-]+)\.'\s*\+/g),
].map((m) => m[1] as string);

function dynamicallyUsed(key: string) {
  const variant = key.slice(key.lastIndexOf('.') + 1);
  const prefix = key.slice(0, key.lastIndexOf('.'));
  const built = templatePrefixes.some((p) => prefix === p || prefix.startsWith(`${p}.`));
  return (
    built && [`'${variant}'`, `"${variant}"`, `\`${variant}\``].some((q) => source.includes(q))
  );
}

describe('translations in use', () => {
  const keys = [...new Set(leaves(es).map(baseKey))];

  it('finds the source and the keys', () => {
    expect(source.length).toBeGreaterThan(100_000);
    expect(keys.length).toBeGreaterThan(500);
    expect(templatePrefixes.length).toBeGreaterThan(5);
  });

  it('has no key that nothing uses', () => {
    const unused = keys.filter((key) => !written(key) && !dynamicallyUsed(key));
    expect(unused).toEqual([]);
  });
});
