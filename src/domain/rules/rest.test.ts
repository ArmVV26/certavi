import { describe, expect, it } from 'vitest';
import { DEFAULT_REST } from '../model/settings';
import { adjustRest, restSeconds } from './rest';

describe('restSeconds', () => {
  it('rests 60 s after a warm-up and 90 s after an approach set', () => {
    expect(restSeconds('warmup', 'compound', DEFAULT_REST)).toBe(60);
    expect(restSeconds('approach', 'compound', DEFAULT_REST)).toBe(90);
    expect(restSeconds('warmup', 'isolation', DEFAULT_REST)).toBe(60);
  });

  it('rests the basic time plus 30 s after a top set', () => {
    expect(restSeconds('top', 'compound', DEFAULT_REST)).toBe(210);
    expect(restSeconds('top', 'compound', { compound: 150, isolation: 90 })).toBe(180);
  });

  it('rests the basic or the isolation time after any other row', () => {
    for (const kind of ['backoff', 'straight', 'bilbo', 'dropset', 'extra'] as const) {
      expect(restSeconds(kind, 'compound', DEFAULT_REST)).toBe(180);
      expect(restSeconds(kind, 'isolation', DEFAULT_REST)).toBe(120);
    }
  });
});

describe('adjustRest', () => {
  it('adds or removes 15 s', () => {
    expect(adjustRest(100, 15)).toBe(115);
    expect(adjustRest(100, -15)).toBe(85);
  });

  it('never goes below 15 s, also when the time was already up', () => {
    expect(adjustRest(20, -15)).toBe(15);
    expect(adjustRest(0, 15)).toBe(15);
    expect(adjustRest(0, -15)).toBe(15);
  });

  it('rounds the time left to whole seconds', () => {
    expect(adjustRest(99.6, 15)).toBe(115);
  });
});
