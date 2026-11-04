import { useEffect, useState } from 'react';
import { toIsoDate } from '../../domain';

/**
 * Today's date on this device ('YYYY-MM-DD'). It moves on at midnight and when the app comes
 * back to the foreground on another day.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => toIsoDate(new Date()));

  useEffect(() => {
    const refresh = () => {
      setToday(toIsoDate(new Date()));
    };
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    // A second after midnight, so the new date is certain.
    const timer = setTimeout(refresh, nextMidnight.getTime() - now.getTime() + 1000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [today]);

  return today;
}
