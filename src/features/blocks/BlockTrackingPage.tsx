import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import {
  TRACK_PERIODS,
  WEEKLY_VALUE_RANGE,
  isAboveThreshold,
  mondayOf,
  metricPoints,
  weeklyPoints,
  type BlockLog,
  type BlockMetric,
  type OptionalBlock,
  type TrackPeriod,
  type WeeklyMetric,
  type WeeklyMetricDef,
} from '../../domain';
import { readBlockTracking, saveWeeklyValues } from '../../data/blocks';
import { useDatabase } from '../../data/DatabaseContext';
import { formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Button } from '../../ui/Button';
import { buttonClasses } from '../../ui/buttonClasses';
import { Card } from '../../ui/Card';
import { ChartFrame } from '../../ui/ChartFrame';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { LineChart } from '../../ui/LineChart';
import { NumberField } from '../../ui/NumberField';
import { Segmented } from '../../ui/Segmented';
import { dayIndex, oneDecimal, shortDate } from '../progress/chartText';
import { useSave } from '../today/useSave';
import { useToday } from '../today/useToday';
import { weekRange } from '../today/weekRange';
import styles from './Blocks.module.css';

/** `/settings/blocks/:blockId`: the block's daily values and weekly values over time. */
export function BlockTrackingPage() {
  const { t } = useTranslation();
  const db = useDatabase();
  const today = useToday();
  const { blockId = '' } = useParams();
  const data = useLiveQuery(() => readBlockTracking(db, blockId), [db, blockId]);
  const [period, setPeriod] = useState<TrackPeriod>('30');
  if (!data) return null;
  const { block, logs, weekly } = data;

  if (!block) {
    return (
      <EmptyState
        icon="info"
        title={t('blocksPage.notFound')}
        action={
          <Link to="/settings/blocks" className={buttonClasses({ variant: 'secondary' })}>
            {t('blocksPage.back')}
          </Link>
        }
      />
    );
  }

  const hasMetrics = block.metrics.length > 0 || block.weeklyMetrics.length > 0;
  return (
    <div className={styles.page}>
      <Link to="/settings/blocks" className={styles.back}>
        <Icon name="back" size={20} />
        <span>{t('blocksPage.back')}</span>
      </Link>
      <div className={styles.titleRow}>
        <h2 className={styles.heading}>{resolveText(t, block.name)}</h2>
        <Link
          to={`/settings/blocks/${block.id}/edit`}
          className={buttonClasses({ variant: 'secondary' })}
        >
          {t('blocksPage.track.edit')}
        </Link>
      </div>

      {!hasMetrics && <p className={styles.muted}>{t('blocksPage.track.noMetrics')}</p>}

      {block.metrics.length > 0 && (
        <Segmented
          legend={t('blocksPage.track.period')}
          value={period}
          onChange={setPeriod}
          options={TRACK_PERIODS.map((value) => ({
            value,
            label: t(`blocksPage.track.periods.${value}`),
          }))}
        />
      )}
      {block.metrics.map((metric) => (
        <MetricCard
          key={metric.id}
          block={block}
          metric={metric}
          logs={logs}
          today={today}
          period={period}
        />
      ))}
      {block.weeklyMetrics.map((def) => (
        <WeeklyCard key={def.id} block={block} def={def} records={weekly} today={today} />
      ))}
    </div>
  );
}

interface MetricCardProps {
  block: OptionalBlock;
  metric: BlockMetric;
  logs: readonly BlockLog[];
  today: string;
  period: TrackPeriod;
}

/** A daily value over the chosen period, with its limit as a dashed line. */
function MetricCard({ block, metric, logs, today, period }: MetricCardProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const name = resolveText(t, metric.name);
  const { threshold } = metric;
  const values = metricPoints(logs, block.id, metric.id, today, period);
  const points = values.map((point, index) => ({
    x: dayIndex(point.date),
    y: point.value,
    name: t(
      isAboveThreshold(metric, point.value)
        ? 'blocksPage.track.pointAbove'
        : 'blocksPage.track.point',
      {
        date: shortDate(point.date, locale),
        value: formatNumber(point.value, locale),
      },
    ),
    ...(index === 0 || index === values.length - 1
      ? { xLabel: shortDate(point.date, locale) }
      : {}),
  }));
  const ys = values.map((point) => point.value);
  const title =
    threshold === undefined ? name : t('blocksPage.track.chartTitle', { name, value: threshold });

  return (
    <Card element="section">
      <h3 className={styles.subheading}>{name}</h3>
      {points.length === 0 ? (
        <p className={styles.muted}>{t('blocksPage.track.empty')}</p>
      ) : (
        <ChartFrame
          {...(threshold === undefined
            ? {}
            : {
                legend: [
                  {
                    label: t('blocksPage.track.limit', { value: threshold }),
                    kind: 'limit' as const,
                  },
                ],
              })}
          table={{
            caption: t('blocksPage.track.caption', { name }),
            head: [t('progress.chart.date'), t('blocksPage.track.valueHead')],
            rows: values.map((point) => [
              shortDate(point.date, locale),
              isAboveThreshold(metric, point.value)
                ? t('blocksPage.track.valueAbove', { value: formatNumber(point.value, locale) })
                : formatNumber(point.value, locale),
            ]),
          }}
        >
          <LineChart
            points={points}
            description={t('progress.chart.line', {
              title,
              count: points.length,
              min: formatNumber(Math.min(...ys), locale),
              max: formatNumber(Math.max(...ys), locale),
            })}
            formatY={(value) => formatNumber(value, locale)}
            yRange={{ min: metric.min, max: metric.max, step: 2 }}
            height={170}
            {...(threshold === undefined ? {} : { reference: { value: threshold } })}
          />
        </ChartFrame>
      )}
    </Card>
  );
}

interface WeeklyCardProps {
  block: OptionalBlock;
  def: WeeklyMetricDef;
  records: readonly WeeklyMetric[];
  today: string;
}

/** A weekly value (the wall test): this week's form and a chart per part. */
function WeeklyCard({ block, def, records, today }: WeeklyCardProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const db = useDatabase();
  const save = useSave();
  const week = mondayOf(today);
  const range = weekRange(week, locale);
  const name = resolveText(t, def.name);
  const saved = records.find((r) => r.metricId === def.id && r.week === week);
  const [draft, setDraft] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(def.parts.map((part) => [part.id, saved?.values[part.id] ?? null])),
  );
  const [error, setError] = useState(false);

  const submit = async () => {
    if (Object.values(draft).every((value) => value === null)) {
      setError(true);
      return;
    }
    setError(false);
    await save(
      () => saveWeeklyValues(db, { blockId: block.id, metricId: def.id, week, values: draft }),
      t('blocksPage.track.saved', { name, range }),
    );
  };

  return (
    <Card element="section">
      <h3 className={styles.subheading}>{name}</h3>
      <form
        className={styles.fields}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className={styles.muted}>{t('blocksPage.track.week', { range })}</p>
        <div className={styles.partFields}>
          {def.parts.map((part) => (
            <NumberField
              key={part.id}
              label={resolveText(t, part.name)}
              unit={def.unit}
              value={draft[part.id] ?? null}
              min={WEEKLY_VALUE_RANGE.min}
              max={WEEKLY_VALUE_RANGE.max}
              maxFractionDigits={1}
              step={0.5}
              onChange={(value) => {
                setDraft((current) => ({ ...current, [part.id]: value }));
              }}
            />
          ))}
        </div>
        {error && (
          <p role="alert" className={styles.muted}>
            {t('blocksPage.track.needValue')}
          </p>
        )}
        <Button type="submit" variant="primary">
          {t('blocksPage.track.save')}
        </Button>
      </form>
      {def.parts.map((part) => (
        <PartChart key={part.id} block={block} def={def} partId={part.id} records={records} />
      ))}
    </Card>
  );
}

interface PartChartProps {
  block: OptionalBlock;
  def: WeeklyMetricDef;
  partId: string;
  records: readonly WeeklyMetric[];
}

/** The last weeks of one part of a weekly value. */
function PartChart({ block, def, partId, records }: PartChartProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const part = def.parts.find((p) => p.id === partId);
  if (!part) return null;
  const title = t('blocksPage.track.weeklyCaption', {
    name: resolveText(t, def.name),
    part: resolveText(t, part.name),
  });
  const values = weeklyPoints(records, block.id, def.id, partId);
  const points = values.map((point, index) => ({
    x: dayIndex(point.week),
    y: point.value,
    name: t('blocksPage.track.weeklyPoint', {
      range: weekRange(point.week, locale),
      value: oneDecimal(point.value, locale),
      unit: def.unit,
    }),
    ...(index === 0 || index === values.length - 1
      ? { xLabel: shortDate(point.week, locale) }
      : {}),
  }));
  const ys = values.map((point) => point.value);
  const unit = (value: number) => `${oneDecimal(value, locale)} ${def.unit}`;

  return (
    <div className={styles.fields}>
      <h4 className={styles.subheading}>{resolveText(t, part.name)}</h4>
      {points.length === 0 ? (
        <p className={styles.muted}>{t('blocksPage.track.weeklyEmpty')}</p>
      ) : (
        <ChartFrame
          table={{
            caption: title,
            head: [t('progress.chart.week'), t('blocksPage.track.weeklyValue', { unit: def.unit })],
            rows: values.map((point) => [
              weekRange(point.week, locale),
              oneDecimal(point.value, locale),
            ]),
          }}
        >
          <LineChart
            points={points}
            description={t('progress.chart.line', {
              title,
              count: points.length,
              min: unit(Math.min(...ys)),
              max: unit(Math.max(...ys)),
            })}
            formatY={(value) => oneDecimal(value, locale)}
            height={150}
          />
        </ChartFrame>
      )}
    </div>
  );
}
