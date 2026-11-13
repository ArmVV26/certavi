import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DIAGNOSTICS_LOG_STORAGE_KEY,
  DIAGNOSTICS_STORAGE_KEY,
  MAX_MEASUREMENTS,
  afterPaint,
  clearMeasurements,
  formatMeasurements,
  hasMeasurements,
  rateDuration,
  readDiagnosticsEnabled,
  readMeasurements,
  recordMeasurement,
  startMeasure,
  summarize,
  writeDiagnosticsEnabled,
  type DiagnosticsStorage,
  type MeasureEnv,
} from './diagnostics';

function memoryStorage(initial: Record<string, string> = {}): DiagnosticsStorage {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

const blocked: DiagnosticsStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the switch', () => {
  it('is off by default and when the saved value is invalid', () => {
    expect(readDiagnosticsEnabled(memoryStorage())).toBe(false);
    expect(readDiagnosticsEnabled(memoryStorage({ [DIAGNOSTICS_STORAGE_KEY]: 'maybe' }))).toBe(
      false,
    );
    expect(readDiagnosticsEnabled(null)).toBe(false);
    expect(readDiagnosticsEnabled(blocked)).toBe(false);
  });

  it('is saved and read back', () => {
    const storage = memoryStorage();
    expect(writeDiagnosticsEnabled(storage, true)).toBe(true);
    expect(storage.getItem(DIAGNOSTICS_STORAGE_KEY)).toBe('on');
    expect(readDiagnosticsEnabled(storage)).toBe(true);
    writeDiagnosticsEnabled(storage, false);
    expect(readDiagnosticsEnabled(storage)).toBe(false);
  });

  it('reports when it cannot be saved', () => {
    expect(writeDiagnosticsEnabled(null, true)).toBe(false);
    expect(writeDiagnosticsEnabled(blocked, true)).toBe(false);
  });
});

describe('measurements', () => {
  it('start empty', () => {
    const log = readMeasurements(memoryStorage());
    expect(log).toEqual({ dbOpen: [], todayLoad: [], setVisible: [], progressLoad: [] });
    expect(hasMeasurements(log)).toBe(false);
  });

  it('are recorded with one decimal, oldest first', () => {
    const storage = memoryStorage();
    expect(recordMeasurement(storage, 'todayLoad', 120.46, 1000)).toBe(true);
    recordMeasurement(storage, 'todayLoad', 90, 2000);
    recordMeasurement(storage, 'dbOpen', 30, 3000);
    const log = readMeasurements(storage);
    expect(log.todayLoad).toEqual([
      { ms: 120.5, at: 1000 },
      { ms: 90, at: 2000 },
    ]);
    expect(log.dbOpen).toEqual([{ ms: 30, at: 3000 }]);
    expect(hasMeasurements(log)).toBe(true);
  });

  it('keep the last 20 of each kind', () => {
    const storage = memoryStorage();
    for (let i = 1; i <= MAX_MEASUREMENTS + 5; i += 1)
      recordMeasurement(storage, 'setVisible', i, i);
    recordMeasurement(storage, 'dbOpen', 7, 1);
    const list = readMeasurements(storage).setVisible;
    expect(list).toHaveLength(MAX_MEASUREMENTS);
    expect(list[0]?.ms).toBe(6);
    expect(list[list.length - 1]?.ms).toBe(25);
    expect(readMeasurements(storage).dbOpen).toHaveLength(1);
  });

  it('trim a saved list longer than 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ms: i, at: i }));
    const storage = memoryStorage({
      [DIAGNOSTICS_LOG_STORAGE_KEY]: JSON.stringify({ progressLoad: many }),
    });
    const list = readMeasurements(storage).progressLoad;
    expect(list).toHaveLength(MAX_MEASUREMENTS);
    expect(list[0]?.ms).toBe(10);
  });

  it('ignore a corrupt saved value, or only the corrupt list', () => {
    const empty = { dbOpen: [], todayLoad: [], setVisible: [], progressLoad: [] };
    const read = (text: string) =>
      readMeasurements(memoryStorage({ [DIAGNOSTICS_LOG_STORAGE_KEY]: text }));
    expect(read('not json')).toEqual(empty);
    expect(read('[1,2]')).toEqual(empty);
    expect(read(JSON.stringify({ dbOpen: [{ ms: -1, at: 1 }] }))).toEqual(empty);
    const mixed = read(
      JSON.stringify({ dbOpen: 'x', todayLoad: [{ ms: 5, at: 1 }], setVisible: [{ ms: 'x' }] }),
    );
    expect(mixed).toEqual({ ...empty, todayLoad: [{ ms: 5, at: 1 }] });
    expect(readMeasurements(null)).toEqual(empty);
    expect(readMeasurements(blocked)).toEqual(empty);
  });

  it('are cleared without touching the switch', () => {
    const storage = memoryStorage();
    writeDiagnosticsEnabled(storage, true);
    recordMeasurement(storage, 'dbOpen', 10);
    expect(clearMeasurements(storage)).toBe(true);
    expect(hasMeasurements(readMeasurements(storage))).toBe(false);
    expect(readDiagnosticsEnabled(storage)).toBe(true);
    expect(clearMeasurements(null)).toBe(false);
  });

  it('report when they cannot be saved', () => {
    expect(recordMeasurement(null, 'dbOpen', 10)).toBe(false);
    expect(recordMeasurement(blocked, 'dbOpen', 10)).toBe(false);
  });
});

describe('summarize', () => {
  const list = (...values: number[]) => values.map((ms, at) => ({ ms, at }));

  it('is null with no measurements', () => {
    expect(summarize([])).toBeNull();
  });

  it('gives last, median, max and count', () => {
    expect(summarize(list(100, 300, 200))).toEqual({ last: 200, median: 200, max: 300, count: 3 });
  });

  it('takes the mean of the two middle values when the count is even', () => {
    expect(summarize(list(100, 200, 400, 301))).toEqual({
      last: 301,
      median: 250.5,
      max: 400,
      count: 4,
    });
  });

  it('works with one measurement', () => {
    expect(summarize(list(42))).toEqual({ last: 42, median: 42, max: 42, count: 1 });
  });
});

describe('rateDuration', () => {
  it('is good under 300 ms, a problem over 1 s and fair in between (limits are fair)', () => {
    expect(rateDuration(0)).toBe('good');
    expect(rateDuration(250)).toBe('good');
    expect(rateDuration(299.9)).toBe('good');
    expect(rateDuration(300)).toBe('fair');
    expect(rateDuration(1000)).toBe('fair');
    expect(rateDuration(1001)).toBe('problem');
  });
});

describe('formatMeasurements', () => {
  it('writes the version, the dates and every kind, empty ones included', () => {
    const storage = memoryStorage();
    recordMeasurement(storage, 'dbOpen', 41.2, Date.UTC(2026, 10, 13, 10, 0, 1));
    const text = formatMeasurements(readMeasurements(storage), {
      version: '0.10.1',
      now: Date.UTC(2026, 10, 13, 10, 15),
      userAgent: 'TestAgent/1.0',
    });
    expect(JSON.parse(text)).toEqual({
      app: 'Certavi',
      version: '0.10.1',
      copiedAt: '2026-11-13T10:15:00.000Z',
      userAgent: 'TestAgent/1.0',
      measurements: {
        dbOpen: [{ ms: 41.2, at: '2026-11-13T10:00:01.000Z' }],
        todayLoad: [],
        setVisible: [],
        progressLoad: [],
      },
    });
  });
});

describe('startMeasure', () => {
  function env(storage: DiagnosticsStorage | null) {
    let clock = 1000;
    const advance = (ms: number) => {
      clock += ms;
    };
    const measure: MeasureEnv = { storage, now: () => clock, date: () => 5000 };
    return { measure, advance };
  }

  it('does nothing while the switch is off', () => {
    const storage = memoryStorage();
    const { measure, advance } = env(storage);
    const stop = startMeasure('todayLoad', measure);
    advance(50);
    stop();
    expect(hasMeasurements(readMeasurements(storage))).toBe(false);
  });

  it('records the time between start and stop when it is on', () => {
    const storage = memoryStorage();
    writeDiagnosticsEnabled(storage, true);
    const { measure, advance } = env(storage);
    const stop = startMeasure('todayLoad', measure);
    advance(120);
    stop();
    expect(readMeasurements(storage).todayLoad).toEqual([{ ms: 120, at: 5000 }]);
  });

  it('counts only the first stop', () => {
    const storage = memoryStorage();
    writeDiagnosticsEnabled(storage, true);
    const { measure, advance } = env(storage);
    const stop = startMeasure('setVisible', measure);
    advance(10);
    stop();
    advance(500);
    stop();
    expect(readMeasurements(storage).setVisible).toEqual([{ ms: 10, at: 5000 }]);
  });

  it('records nothing if it is never stopped', () => {
    const storage = memoryStorage();
    writeDiagnosticsEnabled(storage, true);
    startMeasure('setVisible', env(storage).measure);
    expect(hasMeasurements(readMeasurements(storage))).toBe(false);
  });

  it('does not fail when storage is blocked', () => {
    const { measure } = env(blocked);
    expect(() => {
      startMeasure('dbOpen', measure)();
    }).not.toThrow();
  });

  it('uses the browser by default', () => {
    localStorage.clear();
    localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, 'on');
    startMeasure('dbOpen')();
    expect(readMeasurements(localStorage).dbOpen).toHaveLength(1);
    localStorage.clear();
  });
});

describe('afterPaint', () => {
  it('waits for the next frame and then a task', () => {
    vi.useFakeTimers();
    const frames: (() => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback));
    const callback = vi.fn();
    afterPaint(callback);
    expect(callback).not.toHaveBeenCalled();
    frames[0]?.();
    expect(callback).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('falls back to a task where there are no animation frames', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', undefined);
    const callback = vi.fn();
    afterPaint(callback);
    vi.runAllTimers();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
