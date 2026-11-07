// Optional blocks: reading them for the list and the tracking page, creating and editing them, and
// saving the weekly values (the wall test). Each write is one transaction that validates, writes
// and queues the record for sync (ADR-0002).
import {
  blockFromDraft,
  validateBlockDraft,
  weeklyMetricId,
  withWeeklyValues,
  type BlockDraft,
  type BlockDraftError,
  type BlockLog,
  type OptionalBlock,
  type WeeklyMetric,
} from '../domain';
import { isLive, type CertaviDb } from './db';
import { ID_PREFIX, newId } from './ids';
import { createRepository, type RepositoryOptions } from './repository';

export class InvalidBlockError extends Error {
  readonly errors: readonly BlockDraftError[];

  constructor(errors: readonly BlockDraftError[]) {
    super(`Invalid block: ${errors.map((e) => `${e.field}:${e.code}`).join(', ')}`);
    this.name = 'InvalidBlockError';
    this.errors = errors;
  }
}

export class BlockNotFoundError extends Error {
  readonly blockId: string;

  constructor(blockId: string) {
    super(`Block not found: ${blockId}`);
    this.name = 'BlockNotFoundError';
    this.blockId = blockId;
  }
}

/** Every live block, active ones first. */
export function readBlocks(db: CertaviDb): Promise<OptionalBlock[]> {
  return db.blocks
    .toArray()
    .then((rows) => rows.filter((row) => isLive(row)))
    .then((rows) => [...rows].sort((a, b) => Number(b.active) - Number(a.active)));
}

export interface BlockTracking {
  /** Undefined when there is no such block. */
  block: OptionalBlock | undefined;
  logs: BlockLog[];
  weekly: WeeklyMetric[];
}

/** One block with its daily logs and weekly values. */
export function readBlockTracking(db: CertaviDb, blockId: string): Promise<BlockTracking> {
  return db.transaction('r', [db.blocks, db.blockLogs, db.weeklyMetrics], async () => {
    const row = await db.blocks.get(blockId);
    const block = row && isLive(row) ? row : undefined;
    const logs = (await db.blockLogs.where('blockId').equals(blockId).toArray()).filter((log) =>
      isLive(log),
    );
    const weekly = (await db.weeklyMetrics.toArray())
      .filter((record) => isLive(record))
      .filter((record) => record.blockId === blockId);
    return { block, logs, weekly };
  });
}

/** Creates a block the user makes. Throws `InvalidBlockError` (and writes nothing). */
export function createBlock(
  db: CertaviDb,
  draft: BlockDraft,
  options: RepositoryOptions = {},
): Promise<OptionalBlock> {
  const { now = Date.now } = options;
  const blocks = createRepository(db, 'block', options);
  return db.transaction('rw', [db.blocks, db.pending, db.meta], () => {
    const errors = validateBlockDraft(draft);
    if (errors.length > 0) throw new InvalidBlockError(errors);
    return blocks.put(blockFromDraft(draft, newId(ID_PREFIX.block, now())));
  });
}

/**
 * Saves the form over a block (the app's own or the user's). Throws `InvalidBlockError` or
 * `BlockNotFoundError`.
 */
export function updateBlock(
  db: CertaviDb,
  id: string,
  draft: BlockDraft,
  options: RepositoryOptions = {},
): Promise<OptionalBlock> {
  const blocks = createRepository(db, 'block', options);
  return db.transaction('rw', [db.blocks, db.pending, db.meta], async () => {
    const base = await blocks.get(id);
    if (!base) throw new BlockNotFoundError(id);
    const errors = validateBlockDraft(draft);
    if (errors.length > 0) throw new InvalidBlockError(errors);
    return blocks.put(blockFromDraft(draft, id, base));
  });
}

export interface WeeklyValuesInput {
  blockId: string;
  metricId: string;
  /** Monday of the week. */
  week: string;
  /** Value per part; null clears that part. */
  values: Record<string, number | null>;
}

/**
 * Sets the parts of a weekly value (one record per block, metric and week). A part not in `values`
 * keeps what it had; a record left without any part is removed.
 */
export function saveWeeklyValues(
  db: CertaviDb,
  input: WeeklyValuesInput,
  options: RepositoryOptions = {},
): Promise<WeeklyMetric | undefined> {
  const weekly = createRepository(db, 'weeklyMetric', options);
  const id = weeklyMetricId(input.blockId, input.metricId, input.week);
  return db.transaction('rw', [db.weeklyMetrics, db.pending, db.meta], async () => {
    const current = await weekly.get(id);
    const values = withWeeklyValues(current?.values ?? {}, input.values);
    if (Object.keys(values).length === 0) {
      await weekly.remove(id);
      return undefined;
    }
    return weekly.put({
      id,
      week: input.week,
      blockId: input.blockId,
      metricId: input.metricId,
      values,
    });
  });
}
