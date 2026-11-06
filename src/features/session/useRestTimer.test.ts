import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRestTimer } from './useRestTimer';

const START = new Date(2026, 10, 5, 18, 0, 0).getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const onFinish = vi.fn();
  const hook = renderHook(() => useRestTimer(onFinish));
  const pass = (seconds: number) => {
    act(() => {
      vi.advanceTimersByTime(seconds * 1000);
    });
  };
  return { ...hook, onFinish, pass };
}

describe('useRestTimer', () => {
  it('has no timer until it is started', () => {
    const { result } = setup();
    expect(result.current.timer).toBeNull();
  });

  it('counts down from the start and remembers the row it came from', () => {
    const { result, pass } = setup();
    const from = { exerciseId: 'remo-t', slot: 0 };
    act(() => {
      result.current.start(60, from);
    });
    expect(result.current.timer).toMatchObject({ remaining: 60, total: 60, finished: false, from });
    pass(10);
    expect(result.current.timer?.remaining).toBe(50);
  });

  it('runs the alert once when the time is up and keeps showing it', () => {
    const { result, onFinish, pass } = setup();
    act(() => {
      result.current.start(30, null);
    });
    pass(29);
    expect(onFinish).not.toHaveBeenCalled();
    pass(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(result.current.timer).toMatchObject({ remaining: 0, finished: true });
    pass(20);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(result.current.timer?.finished).toBe(true);
  });

  it('closes by itself 30 s after the time is up', () => {
    const { result, pass } = setup();
    act(() => {
      result.current.start(30, null);
    });
    pass(30 + 29);
    expect(result.current.timer).not.toBeNull();
    pass(1);
    expect(result.current.timer).toBeNull();
  });

  it('adds and removes 15 s, never leaving less than 15 s', () => {
    const { result, pass } = setup();
    act(() => {
      result.current.start(60, null);
    });
    act(() => {
      result.current.adjust(15);
    });
    expect(result.current.timer).toMatchObject({ remaining: 75, total: 75 });
    pass(30);
    act(() => {
      result.current.adjust(-15);
    });
    expect(result.current.timer?.remaining).toBe(30);
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        result.current.adjust(-15);
      });
    }
    expect(result.current.timer?.remaining).toBe(15);
  });

  it('starts a new rest of 15 s, and a new alert, when +15 s is pressed after the end', () => {
    const { result, onFinish, pass } = setup();
    act(() => {
      result.current.start(30, null);
    });
    pass(40);
    expect(onFinish).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.adjust(15);
    });
    expect(result.current.timer).toMatchObject({ remaining: 15, total: 15, finished: false });
    pass(15);
    expect(onFinish).toHaveBeenCalledTimes(2);
  });

  it('ignores an adjustment when nothing is resting', () => {
    const { result } = setup();
    act(() => {
      result.current.adjust(15);
    });
    expect(result.current.timer).toBeNull();
  });

  it('close() removes the timer', () => {
    const { result } = setup();
    act(() => {
      result.current.start(60, null);
    });
    act(() => {
      result.current.close();
    });
    expect(result.current.timer).toBeNull();
  });

  it('restarts from zero when started again', () => {
    const { result, pass } = setup();
    act(() => {
      result.current.start(60, null);
    });
    pass(20);
    act(() => {
      result.current.start(120, null);
    });
    expect(result.current.timer).toMatchObject({ remaining: 120, total: 120 });
  });

  it('re-reads the clock when the app comes back to the foreground', () => {
    const { result } = setup();
    act(() => {
      result.current.start(60, null);
    });
    // The phone was locked: no timer ran, but the clock moved on.
    vi.setSystemTime(START + 45_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.timer?.remaining).toBe(15);
  });

  it('stops listening once it has closed', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const { result, unmount } = setup();
    act(() => {
      result.current.start(60, null);
    });
    unmount();
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
