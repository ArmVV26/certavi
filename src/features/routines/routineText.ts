import type { TFunction } from 'i18next';
import type { Routine, SchemeBlock, SetScheme } from '../../domain';
import { formatDate } from '../../i18n/format';
import { INTL_LOCALE, type Locale } from '../../i18n/locale';

function blockText(t: TFunction, block: SchemeBlock): string {
  const { count, reps } = block;
  const withReps = (text: string) => (reps ? `${text} ${reps}` : text);
  switch (block.kind) {
    case 'approach':
      return withReps(t('routines.scheme.approach', { count }));
    case 'top':
      return withReps(t('routines.scheme.top', { count }));
    case 'backoff':
      return withReps(t('routines.scheme.backoff', { count }));
    case 'bilbo':
      return withReps(t('routines.scheme.bilbo', { count }));
    case 'straight':
      return reps
        ? t('routines.scheme.straight', { count, reps })
        : t('routines.scheme.plain', { count });
    default:
      // Warm-up, dropset and extra rows only exist in sessions; a routine never has them.
      return withReps(t('routines.scheme.plain', { count }));
  }
}

/** "1 aprox. + 1 top 6-8 + 2 back-off 8-10 · RIR 1-2" */
export function schemeText(t: TFunction, scheme: SetScheme): string {
  const blocks = scheme.blocks.map((block) => blockText(t, block)).join(' + ');
  return scheme.rir ? `${blocks} · ${t('routines.scheme.rir', { rir: scheme.rir })}` : blocks;
}

/** "Lunes" / "Monday", or "Sin día fijo" for a routine without a day. */
export function weekdayText(t: TFunction, locale: Locale, weekday: Routine['weekday']): string {
  if (weekday === null) return t('routines.anyDay');
  // Monday 2 November 2026 is the ISO weekday 1, so the 1 + weekday of that month has the day.
  const name = formatDate(new Date(2026, 10, 1 + weekday), locale, { weekday: 'long' });
  return name.charAt(0).toLocaleUpperCase(INTL_LOCALE[locale]) + name.slice(1);
}

/** "7 ejercicios · 19 series" */
export function summaryText(t: TFunction, summary: { exercises: number; sets: number }): string {
  return `${t('routines.summary.exercises', { count: summary.exercises })} · ${t('routines.summary.sets', { count: summary.sets })}`;
}
