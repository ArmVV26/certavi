import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { REST_AUTO_CLOSE, adjustRest, type RowRef } from '../../domain';

/**
 * The rest in progress. It only changes when the rest starts, is adjusted or closes, so the session
 * screen does not re-draw while it counts down: the clock that shows the seconds lives in the bar.
 */
export interface RestTimer {
  /** When the time is up (ms epoch): the time is counted from here, so it survives a locked phone. */
  endsAt: number;
  /** The length the progress bar is relative to, in seconds. */
  total: number;
  /** The row just saved: "Siguiente" is the open row after it. */
  from: RowRef | null;
  /** When the rest was started or last adjusted (ms epoch): no clock reads earlier than this. */
  at: number;
}

export interface RestTimerApi {
  timer: RestTimer | null;
  /** Starts (or restarts) the rest. */
  start: (seconds: number, from: RowRef | null) => void;
  /** Adds or removes seconds (±15), never leaving less than 15 s. */
  adjust: (delta: number) => void;
  close: () => void;
}

/**
 * The rest timer of the session screen. It keeps the moment the rest ends and wakes up only twice
 * (no ticking): when the time is up, to run `onFinish` once, and 30 s later, to close itself. It
 * also checks the clock when the app comes back to the foreground.
 */
export function useRestTimer(onFinish: () => void): RestTimerApi {
  const [timer, setTimer] = useState<RestTimer | null>(null);
  const finish = useEffectEvent(onFinish);
  const alertedFor = useRef<number | null>(null);

  const endsAt = timer?.endsAt ?? null;
  useEffect(() => {
    if (endsAt === null) return;
    const closeAt = endsAt + REST_AUTO_CLOSE * 1000;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      clearTimeout(timeout);
      const now = Date.now();
      if (now >= closeAt) {
        setTimer(null);
        return;
      }
      // The end alert goes off once per end time (+15 s after the end gives a new end time).
      if (now >= endsAt && alertedFor.current !== endsAt) {
        alertedFor.current = endsAt;
        finish();
      }
      timeout = setTimeout(check, (now < endsAt ? endsAt : closeAt) - now);
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', check);
    };
  }, [endsAt]);

  const start = useCallback((seconds: number, from: RowRef | null) => {
    const at = Date.now();
    setTimer({ endsAt: at + seconds * 1000, total: seconds, from, at });
  }, []);

  const adjust = useCallback((delta: number) => {
    const at = Date.now();
    setTimer((current) => {
      if (!current) return current;
      const left = Math.max(0, Math.ceil((current.endsAt - at) / 1000));
      const next = adjustRest(left, delta);
      return {
        ...current,
        endsAt: at + next * 1000,
        total: left === 0 ? next : Math.max(next, current.total + delta),
        at,
      };
    });
  }, []);

  const close = useCallback(() => {
    setTimer(null);
  }, []);

  return { timer, start, adjust, close };
}
