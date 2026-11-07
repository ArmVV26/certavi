import { useEffect } from 'react';
import { closeFinishedWeeks } from './calendar';
import { useDatabase } from './DatabaseContext';

/**
 * Closes the weeks that ended (freezing their planned sets) when the app starts and whenever
 * `today` changes. Failures are logged: closing is retried the next time.
 */
export function useCloseFinishedWeeks(today: string): void {
  const db = useDatabase();
  useEffect(() => {
    closeFinishedWeeks(db, today).catch((error: unknown) => {
      console.error('Could not close finished weeks', error);
    });
  }, [db, today]);
}
