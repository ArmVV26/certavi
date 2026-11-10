import { useTranslation } from 'react-i18next';
import { exportWeek } from '../../data/backup';
import { useDatabase } from '../../data/DatabaseContext';
import { saveBodyWeight, updateWeek, type WeekPatch } from '../../data/today';
import { formatDate, formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { downloadFile } from '../../ui/download';
import { Stat, StatGrid } from '../../ui/Stat';
import { WeekWeightForm } from '../today/BodyWeightCard';
import { useSave } from '../today/useSave';
import { WeekOptions } from '../today/WeekOptions';
import { weekRange } from '../today/weekRange';
import styles from './CalendarPage.module.css';
import { weekDetail, type CalendarModel } from './calendarModel';

interface WeekPanelProps {
  model: CalendarModel;
  monday: string;
  onClose: () => void;
}

/** A week: sets and sessions against the plan, its options, its weight and its JSON. */
export function WeekPanel({ model, monday, onClose }: WeekPanelProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const db = useDatabase();
  const save = useSave();
  const detail = weekDetail(model, monday);
  const range = weekRange(monday, locale);
  const number = (value: number) => formatNumber(value, locale);
  const future = detail.timing === 'future';
  const readOnly = future || detail.closed;
  const deloadHint = detail.options.deload ? t('today.week.deloadOn') : t('today.week.deloadOff');

  function change(patch: WeekPatch) {
    const message =
      patch.deload === undefined
        ? undefined
        : t(patch.deload ? 'today.week.deloadToastOn' : 'today.week.deloadToastOff');
    void save(() => updateWeek(db, monday, patch), message);
  }

  return (
    <Card element="section">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          {t('calendar.week.title', { range })}
          {detail.weekNumber !== null && (
            <span className={styles.muted}>
              {' · '}
              {t('today.week.number', { number: detail.weekNumber })}
            </span>
          )}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          {t('calendar.close')}
        </Button>
      </div>

      <StatGrid>
        <Stat
          filled
          label={t('today.week.effectiveSets')}
          value={`${number(detail.doneSets)} / ${number(detail.plannedSets)}`}
        />
        <Stat
          filled
          label={t('today.week.sessions')}
          value={t('today.week.sessionsOf', {
            done: number(detail.sessions),
            size: number(detail.plannedSessions),
          })}
        />
      </StatGrid>

      <WeekOptions
        week={detail.options}
        deloadHint={deloadHint}
        disabled={readOnly}
        onChange={change}
      />
      {detail.closed && (
        <p className={styles.muted}>
          {t('calendar.week.closedNote', {
            date:
              detail.closedAt === undefined
                ? ''
                : formatDate(new Date(detail.closedAt), locale, { dateStyle: 'long' }),
          })}
        </p>
      )}
      {future && <p className={styles.muted}>{t('calendar.week.future')}</p>}

      <h3 className={styles.subheading}>{t('today.weight.title')}</h3>
      {future ? (
        <p className={styles.muted}>{t('calendar.week.future')}</p>
      ) : (
        <WeekWeightForm
          key={monday}
          week={monday}
          records={model.data.bodyWeights}
          onSave={(week, kg, weekLabel) =>
            save(() => saveBodyWeight(db, week, kg), t('today.weight.saved', { range: weekLabel }))
          }
        />
      )}

      <Button
        variant="secondary"
        icon="download"
        onClick={() => {
          void save(async () => {
            downloadFile(await exportWeek(db, monday));
          });
        }}
      >
        {t('calendar.week.download')}
      </Button>
    </Card>
  );
}
