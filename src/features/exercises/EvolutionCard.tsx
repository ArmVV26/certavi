import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { metricSeries, type Exercise, type ExerciseMetric, type HistoryEntry } from '../../domain';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Card } from '../../ui/Card';
import { ChartFrame } from '../../ui/ChartFrame';
import { LineChart } from '../../ui/LineChart';
import { Segmented } from '../../ui/Segmented';
import { dayIndex, oneDecimal, shortDate } from '../progress/chartText';
import styles from './ExerciseDetailPage.module.css';

interface EvolutionCardProps {
  exercise: Pick<Exercise, 'name' | 'equipment'>;
  /** Sessions of the exercise, newest first (as the detail screen has them). */
  history: readonly HistoryEntry[];
}

/** One metric per session of the exercise: 1RM, max weight and volume (reps for bodyweight ones). */
export function EvolutionCard({ exercise, history }: EvolutionCardProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const bodyweight = exercise.equipment === 'bodyweight';
  const metrics: ExerciseMetric[] = bodyweight
    ? ['reps', 'volume']
    : ['e1rm', 'maxWeight', 'volume'];
  const [chosen, setChosen] = useState<ExerciseMetric>(metrics[0] ?? 'e1rm');
  const metric = metrics.includes(chosen) ? chosen : (metrics[0] ?? 'e1rm');

  const name = resolveText(t, exercise.name);
  const label = t(`exercises.detail.evolution.${metric}`);
  const values = metricSeries([...history].reverse(), metric).map((point) => ({
    ...point,
    value: metric === 'volume' ? Math.round(point.value) : Math.round(point.value * 10) / 10,
  }));
  const format = (value: number) =>
    metric === 'reps'
      ? t('exercises.detail.evolution.repsValue', { value: oneDecimal(value, locale) })
      : t('exercises.detail.kg', { value: oneDecimal(value, locale) });
  const points = values.map((point, index) => ({
    x: dayIndex(point.date),
    y: point.value,
    name: `${shortDate(point.date, locale)}: ${format(point.value)}`,
    ...(index === 0 || index === values.length - 1
      ? { xLabel: shortDate(point.date, locale) }
      : {}),
  }));
  const ys = values.map((point) => point.value);

  return (
    <Card element="section">
      <h3 className={styles.heading}>{t('exercises.detail.evolution.title')}</h3>
      <Segmented
        legend={t('exercises.detail.evolution.metric')}
        hideLegend
        value={metric}
        onChange={setChosen}
        options={metrics.map((value) => ({
          value,
          label: t(`exercises.detail.evolution.${value}`),
        }))}
      />
      {history.some((entry) => entry.deload) && (
        <p className={styles.muted}>{t('exercises.detail.evolution.note')}</p>
      )}
      {points.length === 0 ? (
        <p className={styles.muted}>{t('exercises.detail.evolution.empty')}</p>
      ) : (
        <ChartFrame
          table={{
            caption: t('exercises.detail.evolution.caption', { name, metric: label }),
            head: [t('progress.chart.date'), label],
            rows: values.map((point) => [shortDate(point.date, locale), format(point.value)]),
          }}
        >
          <LineChart
            points={points}
            description={t('progress.chart.line', {
              title: `${name} · ${label}`,
              count: points.length,
              min: format(Math.min(...ys)),
              max: format(Math.max(...ys)),
            })}
            formatY={(value) => oneDecimal(value, locale)}
          />
        </ChartFrame>
      )}
    </Card>
  );
}
