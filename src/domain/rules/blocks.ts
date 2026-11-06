// Optional blocks on a given day: which ones apply and how their daily log changes.
import { isoWeekday } from '../dates';
import { blockLogId, type BlockLog, type BlockMetric, type OptionalBlock } from '../model/block';

/** Active blocks planned for the weekday of `date` that have something to do or measure. */
export function blocksForDay<T extends OptionalBlock>(blocks: readonly T[], date: string): T[] {
  const weekday = isoWeekday(date);
  return blocks.filter(
    (b) => b.active && b.days.includes(weekday) && (b.items.length > 0 || b.metrics.length > 0),
  );
}

/** A change to one block log: tick an item, set or clear (null) a metric, or the note. */
export type BlockLogPatch =
  | { done: { itemId: string; value: boolean } }
  | { metric: { metricId: string; value: number | null } }
  | { note: string };

/** An empty log of `blockId` on `date` (without `updatedAt`). */
export function emptyBlockLog(blockId: string, date: string): Omit<BlockLog, 'updatedAt'> {
  return {
    id: blockLogId(blockId, date),
    type: 'blockLog',
    date,
    blockId,
    done: {},
    metrics: {},
    note: '',
  };
}

/** The log after `patch`. Clearing a metric removes it; nothing else is touched. */
export function applyBlockLogPatch<T extends Omit<BlockLog, 'updatedAt'>>(
  log: T,
  patch: BlockLogPatch,
): T {
  if ('done' in patch) {
    return { ...log, done: { ...log.done, [patch.done.itemId]: patch.done.value } };
  }
  if ('metric' in patch) {
    const { metricId, value } = patch.metric;
    const others = Object.entries(log.metrics).filter(([id]) => id !== metricId);
    const metrics = Object.fromEntries(value === null ? others : [...others, [metricId, value]]);
    return { ...log, metrics };
  }
  return { ...log, note: patch.note };
}

/** Items of `block` ticked in `log`. */
export function doneCount(
  block: Pick<OptionalBlock, 'items'>,
  log: Pick<BlockLog, 'done'> | undefined,
) {
  return block.items.filter((item) => log?.done[item.id] === true).length;
}

/** True when the value is above the metric's warning threshold (pain > 3/10). */
export function isAboveThreshold(
  metric: Pick<BlockMetric, 'threshold'>,
  value: number | undefined,
) {
  return value !== undefined && metric.threshold !== undefined && value > metric.threshold;
}
