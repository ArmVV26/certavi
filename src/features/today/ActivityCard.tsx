import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_KINDS, type Activity, type ActivityKind } from '../../domain';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { NumberField } from '../../ui/NumberField';
import { TextField } from '../../ui/TextField';
import styles from './TodayPage.module.css';

interface ActivityCardProps {
  kind: ActivityKind;
  onKindChange: (kind: ActivityKind) => void;
  /** Id of the minutes field, so a quick activity can focus it. */
  minutesId: string;
  todayActivities: readonly Activity[];
  /** Saves the activity; resolves to false if it could not be saved. */
  onSave: (input: { kind: ActivityKind; minutes: number; note: string }) => Promise<boolean>;
}

/** "Actividad": logs football, swimming, hiking… for today. */
export function ActivityCard({
  kind,
  onKindChange,
  minutesId,
  todayActivities,
  onSave,
}: ActivityCardProps) {
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await onSave({ kind, minutes: minutes ?? 0, note });
    setSaving(false);
    if (ok) {
      setMinutes(null);
      setNote('');
    }
  }

  const summary = todayActivities
    .map((a) => {
      const activity = t(`activities.kinds.${a.kind}`);
      return a.minutes > 0
        ? t('today.activity.withMinutes', { activity, minutes: a.minutes })
        : activity;
    })
    .join(' · ');

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('today.activity.title')}</h2>
      <div className={styles.chips} role="group" aria-label={t('today.activity.kind')}>
        {ACTIVITY_KINDS.map((value) => (
          <Chip
            key={value}
            selected={value === kind}
            onClick={() => {
              onKindChange(value);
            }}
          >
            {t(`activities.kinds.${value}`)}
          </Chip>
        ))}
      </div>
      <div className={styles.row}>
        <div className={styles.narrow}>
          <NumberField
            id={minutesId}
            label={t('today.activity.minutes')}
            value={minutes}
            onChange={setMinutes}
            min={0}
            max={1440}
            maxFractionDigits={0}
            placeholder={60}
          />
        </div>
        <div className={styles.grow}>
          <TextField
            label={t('today.activity.note')}
            placeholder={t('today.activity.notePlaceholder')}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </div>
      </div>
      <Button
        variant="secondary"
        disabled={saving}
        onClick={() => {
          void save();
        }}
      >
        {t('today.activity.save')}
      </Button>
      {summary !== '' && (
        <p className={styles.muted}>{t('today.activity.today', { list: summary })}</p>
      )}
    </Card>
  );
}
