import { useTranslation } from 'react-i18next';
import { WEEK_SIZES, type WeekPlan, type WeekSize } from '../../domain';
import type { WeekPatch } from '../../data/today';
import { Segmented } from '../../ui/Segmented';
import { Switch } from '../../ui/Switch';
import styles from './TodayPage.module.css';

const SIZE_VALUES = WEEK_SIZES.map((size) => String(size) as `${WeekSize}`);

interface WeekOptionsProps {
  week: Pick<WeekPlan, 'size' | 'hiking' | 'deload'>;
  /** Text under the deload switch. */
  deloadHint: string;
  /** Everything read-only (future week). */
  disabled?: boolean;
  /** Only the number of sessions is read-only (closed week). */
  sizeLocked?: boolean;
  onChange: (patch: WeekPatch) => void;
}

/** The three switches of a week: sessions (5/4/3), hiking and deload. */
export function WeekOptions({
  week,
  deloadHint,
  disabled = false,
  sizeLocked = false,
  onChange,
}: WeekOptionsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.stack}>
        <Segmented
          disabled={disabled || sizeLocked}
          legend={t('today.week.size')}
          value={String(week.size) as `${WeekSize}`}
          options={SIZE_VALUES.map((value) => ({ value, label: value }))}
          onChange={(value) => {
            onChange({ size: Number(value) as WeekSize });
          }}
        />
        <p className={styles.hint}>{t('today.week.sizeHint')}</p>
      </div>
      <Switch
        disabled={disabled}
        label={t('today.week.hiking')}
        description={t('today.week.hikingHint')}
        checked={week.hiking}
        onChange={(hiking) => {
          onChange({ hiking });
        }}
      />
      <Switch
        disabled={disabled}
        label={t('today.week.deload')}
        description={deloadHint}
        checked={week.deload}
        onChange={(deload) => {
          onChange({ deload });
        }}
      />
    </>
  );
}
