// Performance timers for Settings → Diagnostics (docs/spec/diagnostics.md). Device-only, like the
// theme: the on/off switch and the last measurements live in localStorage, are never synced and
// never leave the device. With the switch off a timer only reads that switch.
import { z } from 'zod';
import {
  getLocalStorage,
  readDeviceSetting,
  removeDeviceSetting,
  writeDeviceSetting,
  type ReadableStorage,
} from './deviceStorage';

/** What is timed, in the order Settings lists it. */
export const DIAGNOSTIC_METRICS = ['dbOpen', 'todayLoad', 'setVisible', 'progressLoad'] as const;
export type DiagnosticMetric = (typeof DIAGNOSTIC_METRICS)[number];

/** How many measurements of each kind are kept; the oldest goes first. */
export const MAX_MEASUREMENTS = 20;

export const DIAGNOSTICS_STORAGE_KEY = 'certavi.diagnostics';
export const DIAGNOSTICS_LOG_STORAGE_KEY = 'certavi.diagnosticsLog';

/** Below this a measurement is fine; above `PROBLEM_MS` it is a problem (Phase 10 reference). */
export const GOOD_MS = 300;
export const PROBLEM_MS = 1000;

export interface Measurement {
  /** Duration in milliseconds, one decimal. */
  ms: number;
  /** When it was taken: ms since the epoch. */
  at: number;
}

/** The kept measurements of each kind, oldest first. */
export type MeasurementLog = Record<DiagnosticMetric, Measurement[]>;

export type Rating = 'good' | 'fair' | 'problem';

/** Storage used here: readable, writable and removable (localStorage, or a fake in tests). */
export type DiagnosticsStorage = ReadableStorage & Pick<Storage, 'setItem' | 'removeItem'>;

const measurementSchema = z.object({
  ms: z.number().nonnegative(),
  at: z.number(),
});
// A corrupt list of one kind starts empty without losing the others.
const listSchema = z.array(measurementSchema).catch([]);
const logSchema = z.object({
  dbOpen: listSchema,
  todayLoad: listSchema,
  setVisible: listSchema,
  progressLoad: listSchema,
});

const isFlag = (value: unknown): value is 'on' | 'off' => value === 'on' || value === 'off';

function emptyLog(): MeasurementLog {
  return { dbOpen: [], todayLoad: [], setVisible: [], progressLoad: [] };
}

/** Reads the switch. Missing, invalid or blocked storage → off. */
export function readDiagnosticsEnabled(storage: ReadableStorage | null): boolean {
  return readDeviceSetting(storage, DIAGNOSTICS_STORAGE_KEY, isFlag, 'off') === 'on';
}

/** Saves the switch. Returns false if storage is unavailable. */
export function writeDiagnosticsEnabled(
  storage: Pick<Storage, 'setItem'> | null,
  enabled: boolean,
): boolean {
  return writeDeviceSetting(storage, DIAGNOSTICS_STORAGE_KEY, enabled ? 'on' : 'off');
}

/** The kept measurements. Missing, corrupt or blocked storage → nothing measured. */
export function readMeasurements(storage: ReadableStorage | null): MeasurementLog {
  try {
    const text = storage?.getItem(DIAGNOSTICS_LOG_STORAGE_KEY);
    if (!text) return emptyLog();
    const parsed = logSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return emptyLog();
    const { data } = parsed;
    return {
      dbOpen: data.dbOpen.slice(-MAX_MEASUREMENTS),
      todayLoad: data.todayLoad.slice(-MAX_MEASUREMENTS),
      setVisible: data.setVisible.slice(-MAX_MEASUREMENTS),
      progressLoad: data.progressLoad.slice(-MAX_MEASUREMENTS),
    };
  } catch {
    return emptyLog();
  }
}

/** Adds a measurement, keeping the last 20 of its kind. Returns false if it could not be saved. */
export function recordMeasurement(
  storage: DiagnosticsStorage | null,
  metric: DiagnosticMetric,
  ms: number,
  at: number = Date.now(),
): boolean {
  const log = readMeasurements(storage);
  log[metric] = [...log[metric], { ms: Math.round(ms * 10) / 10, at }].slice(-MAX_MEASUREMENTS);
  return writeDeviceSetting(storage, DIAGNOSTICS_LOG_STORAGE_KEY, JSON.stringify(log));
}

/** Removes every measurement (the switch keeps its state). */
export function clearMeasurements(storage: Pick<Storage, 'removeItem'> | null): boolean {
  return removeDeviceSetting(storage, DIAGNOSTICS_LOG_STORAGE_KEY);
}

export function hasMeasurements(log: MeasurementLog): boolean {
  return DIAGNOSTIC_METRICS.some((metric) => log[metric].length > 0);
}

export interface MeasurementSummary {
  last: number;
  median: number;
  max: number;
  count: number;
}

/** Last, median and worst of the measurements of one kind; null when there are none. */
export function summarize(list: readonly Measurement[]): MeasurementSummary | null {
  const last = list[list.length - 1];
  if (!last) return null;
  const sorted = list.map((entry) => entry.ms).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return {
    last: last.ms,
    median: Math.round(median * 10) / 10,
    max: sorted[sorted.length - 1] ?? 0,
    count: sorted.length,
  };
}

/** Under 300 ms is good, over 1 s is a problem, anything between is fair. */
export function rateDuration(ms: number): Rating {
  if (ms < GOOD_MS) return 'good';
  return ms > PROBLEM_MS ? 'problem' : 'fair';
}

export interface CopyInfo {
  version: string;
  /** When the text is made: ms since the epoch. */
  now: number;
  userAgent: string;
}

/** The text "Copy measurements" puts on the clipboard (docs/spec/diagnostics.md §2.4). */
export function formatMeasurements(log: MeasurementLog, info: CopyInfo): string {
  const measurements = Object.fromEntries(
    DIAGNOSTIC_METRICS.map((metric) => [
      metric,
      log[metric].map(({ ms, at }) => ({ ms, at: new Date(at).toISOString() })),
    ]),
  );
  return JSON.stringify(
    {
      app: 'Certavi',
      version: info.version,
      copiedAt: new Date(info.now).toISOString(),
      userAgent: info.userAgent,
      measurements,
    },
    null,
    2,
  );
}

/** What a timer needs from its surroundings; the browser by default, replaceable in tests. */
export interface MeasureEnv {
  storage: DiagnosticsStorage | null;
  /** High-resolution clock in ms (`performance.now()`). */
  now: () => number;
  /** Wall clock in ms since the epoch (`Date.now()`). */
  date: () => number;
}

function browserEnv(): MeasureEnv {
  return {
    storage: typeof window === 'undefined' ? null : getLocalStorage(window),
    now: () => performance.now(),
    date: () => Date.now(),
  };
}

const NOT_MEASURING = (): void => undefined;

/**
 * Starts a timer. Call the returned function when the thing being timed is done; it saves the
 * measurement, and only the first call counts. With the switch off nothing is timed or saved.
 */
export function startMeasure(metric: DiagnosticMetric, env: MeasureEnv = browserEnv()): () => void {
  if (!readDiagnosticsEnabled(env.storage)) return NOT_MEASURING;
  const started = env.now();
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    recordMeasurement(env.storage, metric, env.now() - started, env.date());
  };
}

/** Runs `callback` once what was just rendered has been painted (next frame, then a task). */
export function afterPaint(callback: () => void): void {
  if (typeof requestAnimationFrame !== 'function') {
    setTimeout(callback, 0);
    return;
  }
  requestAnimationFrame(() => {
    setTimeout(callback, 0);
  });
}
