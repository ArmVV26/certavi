// Every i18n key referenced by the domain seed (exercise names, routines, blocks) must exist.
// Parity between es and en is checked in i18n.test.ts.
import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT,
  MUSCLE_GROUPS,
  SEED_BLOCKS,
  SEED_EXERCISES,
  SEED_ROUTINES,
  type TextRef,
} from '../domain';
import en from './en.json';
import es from './es.json';

function lookup(tree: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree);
}

function seedKeys(): string[] {
  const keys: string[] = [];
  const add = (ref: TextRef | undefined) => {
    if (ref && 'key' in ref) keys.push(ref.key);
  };
  for (const e of SEED_EXERCISES) add(e.name);
  for (const r of SEED_ROUTINES) {
    add(r.name);
    for (const i of r.items) add(i.note);
  }
  for (const b of SEED_BLOCKS) {
    add(b.name);
    for (const i of b.items) [i.name, i.dose, i.description].forEach(add);
    for (const m of b.metrics) add(m.name);
    for (const w of b.weeklyMetrics) [w.name, ...w.parts.map((p) => p.name)].forEach(add);
  }
  for (const g of MUSCLE_GROUPS) keys.push(`exercises.groups.${g}`);
  for (const q of EQUIPMENT) keys.push(`exercises.equipment.${q}`);
  return keys;
}

describe('seed translations', () => {
  it.each([
    ['es', es],
    ['en', en],
  ])('exist in %s', (_lang, resources) => {
    const keys = seedKeys();
    expect(keys.length).toBeGreaterThan(70);
    for (const key of keys) expect(typeof lookup(resources, key), key).toBe('string');
  });

  it('keep the renamed pulldowns', () => {
    expect(es.exercises.names['jalon-pecho']).toBe('Jalón de pecho · agarre abierto neutro');
    expect(es.exercises.names['jalon-cerrado']).toBe('Jalón de pecho · agarre cerrado prono');
  });
});
