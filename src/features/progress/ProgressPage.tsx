import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../../data/DatabaseContext';
import { readProgress } from '../../data/progress';
import { useMeasureLoad } from '../../data/useMeasureLoad';
import { useLocale } from '../../i18n/LocaleContext';
import { EmptyState } from '../../ui/EmptyState';
import { Stat, StatGrid } from '../../ui/Stat';
import { useToday } from '../today/useToday';
import { weekRange } from '../today/weekRange';
import { ExerciseCard } from './ExerciseCard';
import styles from './ProgressPage.module.css';
import { buildProgressModel, type ProgressModel } from './progressModel';
import { GroupSetsCard, WeeklySetsCard } from './SetsCards';
import { StatsCard } from './StatsCard';
import { BodyWeightChartCard, ReadinessCard, RecordsCard, ReviewCard } from './TrendCards';

/** Progress: sets against the plan, weekly sets, exercise evolution, records and body weight. */
export function ProgressPage() {
  const db = useDatabase();
  const today = useToday();
  const data = useLiveQuery(() => readProgress(db), [db]);
  const model = useMemo(() => (data ? buildProgressModel(data, today) : undefined), [data, today]);
  useMeasureLoad('progressLoad', model !== undefined);
  if (!model) return null;

  if (model.sessionsTotal === 0) {
    return (
      <div className={styles.page}>
        <Empty />
        {model.bodyWeights.length > 0 && <BodyWeightChartCard model={model} />}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Summary model={model} />
      <StatsCard model={model} />
      <GroupSetsCard model={model} />
      <WeeklySetsCard model={model} />
      <ExerciseCard model={model} />
      <ReadinessCard model={model} />
      <ReviewCard model={model} />
      <RecordsCard model={model} />
      <BodyWeightChartCard model={model} />
    </div>
  );
}

function Empty() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="progress"
      title={t('progress.empty.title')}
      description={t('progress.empty.text')}
    />
  );
}

function Summary({ model }: { model: ProgressModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { done, planned } = model.setsThisWeek;
  return (
    <StatGrid>
      {model.weekNumber !== null && (
        <Stat
          label={t('progress.summary.week')}
          value={String(model.weekNumber)}
          note={weekRange(model.monday, locale)}
        />
      )}
      <Stat
        label={t('progress.summary.sets')}
        value={`${String(done)} / ${String(planned)}`}
        note={t('progress.summary.setsNote')}
      />
      <Stat
        label={t('progress.summary.sessions')}
        value={String(model.sessionsTotal)}
        note={t('progress.summary.sessionsNote')}
      />
      <Stat
        label={t('progress.summary.records')}
        value={String(model.recordsThisMonth)}
        note={t('progress.summary.recordsNote')}
      />
    </StatGrid>
  );
}
