import { describe, expect, it } from 'vitest';
import { createI18n } from '.';
import { resolveText } from './text';

describe('resolveText', () => {
  it('translates seed keys and shows user text as typed', () => {
    const { t } = createI18n('es');
    expect(resolveText(t, { key: 'routines.names.lowerB' })).toBe('Lower B');
    expect(resolveText(t, { key: 'exercises.names.remo-t' })).toBe('Remo en T');
    expect(resolveText(t, { text: 'Mi ejercicio' })).toBe('Mi ejercicio');
    expect(resolveText(createI18n('en').t, { key: 'routines.free' })).toBe('Free session');
  });
});
