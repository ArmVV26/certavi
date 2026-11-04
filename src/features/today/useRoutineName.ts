import { useTranslation } from 'react-i18next';
import type { Routine } from '../../domain';
import { resolveText } from '../../i18n/text';

/** Display name of a session's routine: its name, or "Sesión libre" for null / unknown ids. */
export function useRoutineName(routines: ReadonlyMap<string, Pick<Routine, 'name'>>) {
  const { t } = useTranslation();
  return (routineId: string | null): string => {
    const routine = routineId === null ? undefined : routines.get(routineId);
    return routine ? resolveText(t, routine.name) : t('routines.free');
  };
}
