// Creating and editing optional blocks: the draft the form works with, its validation and the
// block built from it. Seed blocks are edited too; their texts stay i18n keys until changed.
import { plainText, type TextRef } from '../model/envelope';
import { WEEKDAYS, type BlockType, type Weekday } from '../model/enums';
import type { BlockItem, BlockMetric, OptionalBlock } from '../model/block';
import { normalizeText } from './exerciseFilter';

export const MAX_BLOCK_NAME = 60;
export const MAX_ITEM_NAME = 80;
export const MAX_DOSE = 60;
/** Allowed limits of a daily metric (above it is a warning); the scale is always 0–10. */
export const LIMIT_RANGE = { min: 0, max: 9 } as const;
export const METRIC_SCALE = { min: 0, max: 10 } as const;

/** What a block looks like before the repository stamps it. */
export type BlockInput = Omit<OptionalBlock, 'type' | 'updatedAt' | 'deleted' | 'serverSeq'>;

/** A stored text and how it reads in the active language. */
export interface TextSource {
  ref: TextRef;
  text: string;
}

export interface ItemDraft {
  /** Stable key of the row in the form: the id of a stored item, or a temporary one. */
  key: string;
  /** The stored id; absent for a new item. */
  id?: string;
  name: string;
  dose: string;
  timesPerWeek: string;
  /** The stored texts this row started from: kept while the typed text is unchanged. */
  source?: { name: TextSource; dose?: TextSource };
}

export interface MetricDraft {
  key: string;
  id?: string;
  name: string;
  /** Empty when the metric has no limit. */
  limit: string;
  source?: { name: TextSource };
}

export interface BlockDraft {
  name: string;
  nameSource?: TextSource;
  blockType: BlockType;
  active: boolean;
  days: Weekday[];
  /** `YYYY-MM-DD` or empty. */
  startDate: string;
  reviewDate: string;
  items: ItemDraft[];
  metrics: MetricDraft[];
}

export type BlockDraftField = 'name' | 'itemName' | 'timesPerWeek' | 'metricName' | 'limit';

export type BlockDraftErrorCode = 'empty' | 'too-long' | 'invalid' | 'range';

export interface BlockDraftError {
  field: BlockDraftField;
  code: BlockDraftErrorCode;
  /** The row the error belongs to (an item or metric `key`); absent for the name. */
  key?: string;
}

/** A new, empty block: active every day. */
export function newBlockDraft(): BlockDraft {
  return {
    name: '',
    blockType: 'mobility',
    active: true,
    days: [...WEEKDAYS],
    startDate: '',
    reviewDate: '',
    items: [],
    metrics: [],
  };
}

export const emptyItemDraft = (key: string): ItemDraft => ({
  key,
  name: '',
  dose: '',
  timesPerWeek: '',
});

export const emptyMetricDraft = (key: string): MetricDraft => ({ key, name: '', limit: '' });

/** The form's state for a stored block. `text` resolves a text to the active language. */
export function draftFromBlock(block: OptionalBlock, text: (ref: TextRef) => string): BlockDraft {
  const source = (ref: TextRef): TextSource => ({ ref, text: text(ref) });
  return {
    name: text(block.name),
    nameSource: source(block.name),
    blockType: block.blockType,
    active: block.active,
    days: [...block.days],
    startDate: block.startDate ?? '',
    reviewDate: block.reviewDate ?? '',
    items: block.items.map((item) => ({
      key: item.id,
      id: item.id,
      name: text(item.name),
      dose: item.dose ? text(item.dose) : '',
      timesPerWeek: item.timesPerWeek ?? '',
      source: {
        name: source(item.name),
        ...(item.dose ? { dose: source(item.dose) } : {}),
      },
    })),
    metrics: block.metrics.map((metric) => ({
      key: metric.id,
      id: metric.id,
      name: text(metric.name),
      limit: metric.threshold === undefined ? '' : String(metric.threshold),
      source: { name: source(metric.name) },
    })),
  };
}

const TIMES_PER_WEEK = /^\d(-\d)?$/;

/** What is wrong with the draft, in the order of the form. Empty when it can be saved. */
export function validateBlockDraft(draft: BlockDraft): BlockDraftError[] {
  const errors: BlockDraftError[] = [];
  const name = draft.name.trim();
  if (name === '') errors.push({ field: 'name', code: 'empty' });
  else if (name.length > MAX_BLOCK_NAME) errors.push({ field: 'name', code: 'too-long' });

  for (const item of draft.items) {
    const itemName = item.name.trim();
    if (itemName === '') errors.push({ field: 'itemName', code: 'empty', key: item.key });
    else if (itemName.length > MAX_ITEM_NAME || item.dose.trim().length > MAX_DOSE) {
      errors.push({ field: 'itemName', code: 'too-long', key: item.key });
    }
    const times = item.timesPerWeek.trim();
    if (times !== '' && !TIMES_PER_WEEK.test(times)) {
      errors.push({ field: 'timesPerWeek', code: 'invalid', key: item.key });
    }
  }

  for (const metric of draft.metrics) {
    const metricName = metric.name.trim();
    if (metricName === '') errors.push({ field: 'metricName', code: 'empty', key: metric.key });
    else if (metricName.length > MAX_ITEM_NAME) {
      errors.push({ field: 'metricName', code: 'too-long', key: metric.key });
    }
    const limit = metric.limit.trim();
    if (limit !== '') {
      const value = Number(limit);
      if (!Number.isInteger(value) || value < LIMIT_RANGE.min || value > LIMIT_RANGE.max) {
        errors.push({ field: 'limit', code: 'range', key: metric.key });
      }
    }
  }
  return errors;
}

/** An id for a new item or metric: the name as a slug, unique among `taken`. */
export function localIdFrom(name: string, taken: ReadonlySet<string>, fallback: string): string {
  const slug = normalizeText(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
  const base = /^[a-z]/.test(slug) ? slug : `${fallback}${slug === '' ? '' : `-${slug}`}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${String(n)}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** The text to store: the original reference while the typed text is unchanged. */
function textOf(typed: string, source: TextSource | undefined): TextRef {
  const text = typed.trim();
  return source && text === source.text.trim() ? source.ref : plainText(text);
}

/**
 * The block built from the draft. `base` is the stored block being edited: it keeps what the form
 * does not show (type, weekly metrics, whether it came with the app).
 */
export function blockFromDraft(draft: BlockDraft, id: string, base?: OptionalBlock): BlockInput {
  const itemIds = new Set(draft.items.flatMap((item) => (item.id ? [item.id] : [])));
  const items: BlockItem[] = draft.items.map((item) => {
    const itemId = item.id ?? localIdFrom(item.name, itemIds, 'item');
    itemIds.add(itemId);
    const dose = item.dose.trim();
    const times = item.timesPerWeek.trim();
    return {
      id: itemId,
      name: textOf(item.name, item.source?.name),
      ...(dose === '' ? {} : { dose: textOf(item.dose, item.source?.dose) }),
      ...(times === '' ? {} : { timesPerWeek: times }),
    };
  });

  const metricIds = new Set(draft.metrics.flatMap((metric) => (metric.id ? [metric.id] : [])));
  const metrics: BlockMetric[] = draft.metrics.map((metric) => {
    const metricId = metric.id ?? localIdFrom(metric.name, metricIds, 'metric');
    metricIds.add(metricId);
    const limit = metric.limit.trim();
    return {
      id: metricId,
      name: textOf(metric.name, metric.source?.name),
      min: METRIC_SCALE.min,
      max: METRIC_SCALE.max,
      ...(limit === '' ? {} : { threshold: Number(limit) }),
    };
  });

  return {
    id,
    name: textOf(draft.name, draft.nameSource),
    blockType: base?.blockType ?? draft.blockType,
    items,
    days: WEEKDAYS.filter((day) => draft.days.includes(day)),
    metrics,
    weeklyMetrics: base?.weeklyMetrics ?? [],
    active: draft.active,
    custom: base?.custom ?? true,
    ...(draft.startDate === '' ? {} : { startDate: draft.startDate }),
    ...(draft.reviewDate === '' ? {} : { reviewDate: draft.reviewDate }),
  };
}

/** `list` with the item at `index` moved by `delta` places; unchanged if it would leave the list. */
export function moveInList<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const item = list[index];
  if (item === undefined || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

/** How the days of a block read: every day, none, or the list of weekdays. */
export function daysOf(
  days: readonly Weekday[],
): { kind: 'all' } | { kind: 'none' } | { kind: 'some'; days: Weekday[] } {
  const sorted = WEEKDAYS.filter((day) => days.includes(day));
  if (sorted.length === 0) return { kind: 'none' };
  if (sorted.length === WEEKDAYS.length) return { kind: 'all' };
  return { kind: 'some', days: sorted };
}
