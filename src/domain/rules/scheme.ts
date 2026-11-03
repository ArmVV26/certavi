// Reading set schemes: rep ranges, planned slots and set counts.
import type { SchemeBlockKind } from '../model/enums';
import type { PlanItem } from '../model/routine';
import type { RepRange, SetScheme } from '../model/scheme';

export interface RepBounds {
  min: number;
  max: number;
}

/** '6-8' → 6..8, '12' → 12..12, '~10' → 10..10, '' → null (no target). */
export function parseRepRange(range: RepRange): RepBounds | null {
  if (range === '') return null;
  const [a, b] = range.replace('~', '').split('-').map(Number) as [number, number | undefined];
  return { min: a, max: b ?? a };
}

export interface PlannedSlot {
  kind: SchemeBlockKind;
  reps: RepRange;
  /** 0-based position among all planned sets of the exercise. */
  slot: number;
}

/** One entry per planned set, in order: "1 aprox + 1 + 2" → approach, top, backoff, backoff. */
export function expandScheme(scheme: SetScheme): PlannedSlot[] {
  const slots: PlannedSlot[] = [];
  for (const block of scheme.blocks) {
    for (let i = 0; i < block.count; i++) {
      slots.push({ kind: block.kind, reps: block.reps, slot: slots.length });
    }
  }
  return slots;
}

/** Planned sets of a scheme. Approach sets count (they are effective sets, not warm-ups). */
export function countSchemeSets(scheme: SetScheme): number {
  return scheme.blocks.reduce((sum, block) => sum + block.count, 0);
}

export function countPlanSets(items: readonly PlanItem[]): number {
  return items.reduce((sum, item) => sum + countSchemeSets(item.scheme), 0);
}

export function hasBlock(scheme: SetScheme, kind: SchemeBlockKind): boolean {
  return scheme.blocks.some((block) => block.kind === kind);
}

/** First block of `kind`, if any. */
export function findBlock(scheme: SetScheme, kind: SchemeBlockKind) {
  return scheme.blocks.find((block) => block.kind === kind);
}
