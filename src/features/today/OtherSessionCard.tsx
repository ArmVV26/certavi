import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseIsoDate } from '../../domain';
import { formatDate } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { TextField } from '../../ui/TextField';
import styles from './TodayPage.module.css';
import type { TodayModel } from './todayModel';

interface OtherSessionCardProps {
  model: TodayModel;
  starting: boolean;
  /** Starts (or opens) the session of `routineId` (null = free) on `date`. */
  onStart: (routineId: string | null, date: string) => void;
}

/** "Otra sesión u otro día": any routine or a free session, today or on an earlier date. */
export function OtherSessionCard({ model, starting, onStart }: OtherSessionCardProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | undefined>();
  const chosen = date === '' ? model.today : date;

  const hint =
    chosen === model.today
      ? t('today.other.hintToday')
      : t('today.other.hintOther', {
          date: formatDate(parseIsoDate(chosen), locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
        });

  function start(routineId: string | null) {
    if (chosen > model.today) {
      setError(t('today.other.future'));
      return;
    }
    setError(undefined);
    onStart(routineId, chosen);
  }

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('today.other.title')}</h2>
      <TextField
        label={t('today.other.date')}
        type="date"
        value={chosen}
        max={model.today}
        hint={hint}
        error={error}
        onChange={(event) => {
          setDate(event.target.value);
          setError(undefined);
        }}
      />
      <div className={styles.chips} role="group" aria-label={t('today.other.routines')}>
        {model.routines.map((routine) => (
          <Chip
            key={routine.id}
            disabled={starting}
            onClick={() => {
              start(routine.id);
            }}
          >
            {resolveText(t, routine.name)}
          </Chip>
        ))}
        <Chip
          disabled={starting}
          onClick={() => {
            start(null);
          }}
        >
          {t('routines.free')}
        </Chip>
      </div>
    </Card>
  );
}
