import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, isValidBodyWeight, previousBodyWeight, type BodyWeight } from '../../domain';
import { formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { NumberField } from '../../ui/NumberField';
import styles from './TodayPage.module.css';
import { weekRange } from './weekRange';

interface BodyWeightCardProps {
  monday: string;
  records: readonly BodyWeight[];
  /** Saves the weight of the week; resolves to false if it could not be saved. */
  onSave: (monday: string, kg: number, range: string) => Promise<boolean>;
}

/** "Peso medio de la semana": this week's or last week's average body weight. */
export function BodyWeightCard({ monday, records, onSave }: BodyWeightCardProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [offset, setOffset] = useState<0 | -1>(0);
  const week = addDays(monday, 7 * offset);
  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('today.weight.title')}</h2>
      <div className={styles.chips} role="group" aria-label={t('today.weight.week')}>
        <Chip
          selected={offset === 0}
          onClick={() => {
            setOffset(0);
          }}
        >
          {t('today.weight.thisWeek', { range: weekRange(monday, locale) })}
        </Chip>
        <Chip
          selected={offset === -1}
          onClick={() => {
            setOffset(-1);
          }}
        >
          {t('today.weight.lastWeek', { range: weekRange(addDays(monday, -7), locale) })}
        </Chip>
      </div>
      {/* One form per week: switching weeks starts from that week's saved value. */}
      <WeekWeightForm key={week} week={week} records={records} onSave={onSave} />
    </Card>
  );
}

interface WeekWeightFormProps {
  week: string;
  records: readonly BodyWeight[];
  onSave: BodyWeightCardProps['onSave'];
}

function WeekWeightForm({ week, records, onSave }: WeekWeightFormProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const saved = records.find((r) => r.week === week);
  const previous = previousBodyWeight(records, week);
  // undefined = untouched: the field shows the saved value, also when it arrives by sync.
  const [draft, setDraft] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const savedKg = saved?.kg ?? null;
  // Once the saved value (from this save or from sync) matches what was typed, follow it again.
  if (draft !== undefined && draft === savedKg) setDraft(undefined);
  const value = draft === undefined ? savedKg : draft;

  async function save() {
    if (!isValidBodyWeight(value)) {
      setError(t('today.weight.invalid'));
      return;
    }
    setSaving(true);
    await onSave(week, value, weekRange(week, locale));
    setSaving(false);
  }

  return (
    <>
      <div className={styles.row}>
        <div className={styles.grow}>
          <NumberField
            label={t('today.weight.field')}
            unit="kg"
            value={value}
            step={0.1}
            min={0}
            maxFractionDigits={1}
            error={error}
            {...(previous ? { placeholder: previous.kg } : {})}
            onChange={(next) => {
              setDraft(next);
              setError(undefined);
            }}
          />
        </div>
        <Button
          variant="secondary"
          className={styles.alignEnd}
          disabled={saving}
          onClick={() => {
            void save();
          }}
        >
          {t('today.weight.save')}
        </Button>
      </div>
      {previous && (
        <p className={styles.muted}>
          {t('today.weight.previous', {
            range: weekRange(previous.week, locale),
            kg: formatNumber(previous.kg, locale),
          })}
        </p>
      )}
    </>
  );
}
