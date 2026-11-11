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
  let renders = 0;
  const hook = renderHook(() => {
    renders += 1;
    return useRestTimer(onFinish);
  });
  const pass = (seconds: number) => {
    act(() => {
      vi.advanceTimersByTime(seconds * 1000);
    });
  };
  return { ...hook, onFinish, pass, renders: () => renders };
}

describe('useRestTimer', () => {
  it('has no timer until it is started', () => {
    const { result } = setup();
    expect(result.current.timer).toBeNull();
  });

  it('keeps when the rest ends and the row it came from', () => {
    const { result } = setup();
    const from = { exerciseId: 'remo-t', slot: 0 };
    act(() => {
      result.current.start(60, from);
    });
    expect(result.current.timer).toEqual({ endsAt: START + 60_000, total: 60, from, at: START });
  });

  it('does not re-draw while the seconds go by', () => {
    const { result, pass, renders } = setup();
    act(() => {
      result.current.start(60, null);
    });
    const before = renders();
    pass(30);
    expect(renders()).toBe(before);
  });

  it('runs the alert once when the time is up and keeps the timer', () => {
    const { result, onFinish, pass } = setup();
    act(() => {
      result.current.start(30, null);
    });
    pass(29);
    expect(onFinish).not.toHaveBeenCalled();
    pass(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(result.current.timer).not.toBeNull();
    pass(20);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(result.current.timer).not.toBeNull();
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
    expect(result.current.timer).toMatchObject({ endsAt: START + 75_000, total: 75 });
    pass(30);
    act(() => {
      result.current.adjust(-15);
    });
    expect(result.current.timer?.endsAt).toBe(START + 30_000 + 30_000);
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        result.current.adjust(-15);
      });
    }
    expect(result.current.timer?.endsAt).toBe(START + 30_000 + 15_000);
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
    expect(result.current.timer).toMatchObject({ endsAt: START + 40_000 + 15_000, total: 15 });
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
    expect(result.current.timer).toMatchObject({ endsAt: START + 20_000 + 120_000, total: 120 });
  });

  it('checks the clock when the app comes back to the foreground', () => {
    const { result, onFinish } = setup();
    act(() => {
      result.current.start(60, null);
    });
    // The phone was locked: no timer ran, but the clock moved on past the end.
    vi.setSystemTime(START + 75_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(result.current.timer).not.toBeNull();
    // ... and past the automatic close.
    vi.setSystemTime(START + 95_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.timer).toBeNull();
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
