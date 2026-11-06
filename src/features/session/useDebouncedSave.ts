import { useCallback, useEffect, useRef } from 'react';

const PAUSE_MS = 600;

/**
 * Calls `save` with the latest value a short pause after the last change. `flush` saves at once
 * (when the field loses focus); anything pending is also saved when the component goes away, so
 * a note typed just before leaving the screen is not lost.
 */
export function useDebouncedSave<T>(save: (value: T) => void) {
  const saveRef = useRef(save);
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    saveRef.current = save;
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (next) saveRef.current(next.value);
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, PAUSE_MS);
    },
    [flush],
  );

  useEffect(() => flush, [flush]);

  return { schedule, flush };
}
