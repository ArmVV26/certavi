import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { metricSeries } from '../../domain';
import { getLocalStorage, readDeviceSetting, writeDeviceSetting } from '../../data/deviceStorage';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { buttonClasses } from '../../ui/buttonClasses';
import { Card } from '../../ui/Card';
import { ChartFrame } from '../../ui/ChartFrame';
import { LineChart } from '../../ui/LineChart';
import { SelectField } from '../../ui/SelectField';
import { dayIndex, oneDecimal, shortDate } from './chartText';
import styles from './ProgressPage.module.css';
import type { ProgressModel } from './progressModel';

const STORAGE_KEY = 'certavi.progress.exercise';

/** The exercise the user looked at last, kept on this device. */
function rememberedExercise(ids: readonly string[]): string | null {
  const stored = readDeviceSetting(
    getLocalStorage(window),
    STORAGE_KEY,
    (value): value is string => typeof value === 'string' && ids.includes(value),
    '',
  );
  return stored === '' ? null : stored;
}

/** The exercise with the most recent session, the first time. */
function mostRecentExercise(model: ProgressModel): string | undefined {
  let best: { id: string; date: string } | undefined;
  for (const exercise of model.withData) {
    const date = model.histories.get(exercise.id)?.at(-1)?.session.date ?? '';
    if (!best || date > best.date) best = { id: exercise.id, date };
  }
  return best?.id;
}

/** Best 1RM of every session of one exercise (total reps for bodyweight ones). */
export function ExerciseCard({ model }: { model: ProgressModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const ids = model.withData.map((e) => e.id);
  const [chosen, setChosen] = useState(() => rememberedExercise(ids));
  const selectedId = chosen && ids.includes(chosen) ? chosen : mostRecentExercise(model);
  const exercise = selectedId ? model.exercises.get(selectedId) : undefined;

  const options = model.withData
    .map((e) => ({ value: e.id, label: resolveText(t, e.name) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  if (!exercise || !selectedId) {
    return (
      <Card element="section">
        <h2 className={styles.heading}>{t('progress.exercise.title')}</h2>
        <p className={styles.muted}>{t('progress.exercise.none')}</p>
      </Card>
    );
  }

  const history = model.histories.get(selectedId) ?? [];
  const bodyweight = exercise.equipment === 'bodyweight';
  const name = resolveText(t, exercise.name);
  const values = metricSeries(history, bodyweight ? 'reps' : 'e1rm');
  const hasDeload = history.some((entry) => entry.deload);
  const format = (value: number) =>
    bodyweight
      ? `${oneDecimal(value, locale)} reps`
      : t('progress.records.value', { value: oneDecimal(value, locale) });
  const points = values.map((point, index) => ({
    x: dayIndex(point.date),
    y: Math.round(point.value * 10) / 10,
    name: `${shortDate(point.date, locale)}: ${format(Math.round(point.value * 10) / 10)}`,
    ...(index === 0 || index === values.length - 1
      ? { xLabel: shortDate(point.date, locale) }
      : {}),
  }));
  const ys = points.map((p) => p.y);

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('progress.exercise.title')}</h2>
      <div className={styles.pick}>
        <SelectField
          label={t('progress.exercise.select')}
          value={selectedId}
          options={options}
          onChange={(value) => {
            setChosen(value);
            writeDeviceSetting(getLocalStorage(window), STORAGE_KEY, value);
          }}
        />
        <Link
          to={`/exercises/${selectedId}`}
          className={buttonClasses({ variant: 'secondary' })}
          aria-label={`${t('progress.exercise.open')}: ${name}`}
        >
          {t('progress.exercise.open')}
        </Link>
      </div>
      <p className={styles.sub}>
        {bodyweight ? t('progress.exercise.subtitleReps') : t('progress.exercise.subtitle')}
        {hasDeload && ` ${t('progress.exercise.deloadNote')}`}
      </p>
      {points.length === 0 ? (
        <p className={styles.muted}>{t('progress.exercise.empty')}</p>
      ) : (
        <ChartFrame
          table={{
            caption: name,
            head: [
              t('progress.chart.date'),
              bodyweight ? t('progress.exercise.repsHead') : t('progress.exercise.e1rmHead'),
            ],
            rows: values.map((point) => [
              shortDate(point.date, locale),
              format(Math.round(point.value * 10) / 10),
            ]),
          }}
        >
          <LineChart
            points={points}
            description={t('progress.chart.line', {
              title: name,
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
