import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { REST_AUTO_CLOSE, adjustRest, type RowRef } from '../../domain';

interface TimerState {
  /** When the time is up (ms epoch): the time is counted from here, so it survives a locked phone. */
  endsAt: number;
  /** The length the progress bar is relative to, in seconds. */
  total: number;
  /** The row just saved: "Siguiente" is the open row after it. */
  from: RowRef | null;
}

export interface RestTimer {
  /** Whole seconds left (0 once the time is up). */
  remaining: number;
  total: number;
  finished: boolean;
  from: RowRef | null;
}

export interface RestTimerApi {
  timer: RestTimer | null;
  /** Starts (or restarts) the rest. */
  start: (seconds: number, from: RowRef | null) => void;
  /** Adds or removes seconds (±15), never leaving less than 15 s. */
  adjust: (delta: number) => void;
  close: () => void;
}

const TICK_MS = 250;

/**
 * The rest timer of the session screen. It keeps the moment it ends, ticks four times a second
 * and re-reads the clock when the app comes back to the foreground. `onFinish` runs once when the
 * time is up; the timer closes itself 30 s later.
 */
export function useRestTimer(onFinish: () => void): RestTimerApi {
  const [state, setState] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const finish = useEffectEvent(onFinish);

  // The bar closes by itself 30 s after the time is up (derived from the clock, no extra state).
  const expired = state !== null && now >= state.endsAt + REST_AUTO_CLOSE * 1000;
  const running = state !== null && !expired;
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setNow(Date.now());
    };
    const interval = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [running]);

  // The end alert goes off once per end time (+15 s after the end gives a new end time).
  const isUp = state !== null && !expired && now >= state.endsAt;
  const endsAt = state?.endsAt ?? null;
  const alertedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!isUp || endsAt === null || alertedFor.current === endsAt) return;
    alertedFor.current = endsAt;
    finish();
  }, [isUp, endsAt]);

  const start = useCallback((seconds: number, from: RowRef | null) => {
    const at = Date.now();
    setNow(at);
    setState({ endsAt: at + seconds * 1000, total: seconds, from });
  }, []);

  const adjust = useCallback((delta: number) => {
    const at = Date.now();
    setNow(at);
    setState((current) => {
      if (!current) return current;
      const left = Math.max(0, Math.ceil((current.endsAt - at) / 1000));
      const next = adjustRest(left, delta);
      return {
        ...current,
        endsAt: at + next * 1000,
        total: left === 0 ? next : Math.max(next, current.total + delta),
      };
    });
  }, []);

  const close = useCallback(() => {
    setState(null);
  }, []);

  let timer: RestTimer | null = null;
  if (state && !expired) {
    timer = {
      remaining: Math.max(0, Math.ceil((state.endsAt - now) / 1000)),
      total: state.total,
      finished: isUp,
      from: state.from,
    };
  }
  return { timer, start, adjust, close };
}
