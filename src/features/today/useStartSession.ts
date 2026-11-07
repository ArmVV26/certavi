import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { Routine } from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { startSession } from '../../data/sessions';
import { useToast } from '../../ui/ToastContext';
import { useRoutineName } from './useRoutineName';
import { useSave } from './useSave';

/**
 * Starts (or opens) the session of a routine (null = free) on a date and navigates to it. Shared
 * by Today ("Otra sesión u otro día") and the calendar ("Registrar en este día").
 */
export function useStartSession(
  today: string,
  routines: ReadonlyMap<string, Pick<Routine, 'name'>>,
) {
  const { t } = useTranslation();
  const db = useDatabase();
  const navigate = useNavigate();
  const toast = useToast();
  const save = useSave();
  const routineName = useRoutineName(routines);
  const [starting, setStarting] = useState(false);

  async function start(routineId: string | null, date: string) {
    setStarting(true);
    let opened: string | undefined;
    await save(async () => {
      const { session, existed } = await startSession(db, { routineId, date, today });
      if (existed) {
        toast.show({ message: t('today.other.existing', { routine: routineName(routineId) }) });
      }
      opened = session.id;
    });
    setStarting(false);
    if (opened) void navigate(`/session/${opened}`);
  }

  return { starting, start };
}
