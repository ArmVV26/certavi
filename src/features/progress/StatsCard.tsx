import { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { parseIsoDate, type StatsPeriod } from '../../domain';
import { formatDate, formatNumber } from '../../i18n/format';
import type { Locale } from '../../i18n/locale';
import { useLocale } from '../../i18n/LocaleContext';
import { Card } from '../../ui/Card';
import { cx } from '../../ui/cx';
import { ChartFrame } from '../../ui/ChartFrame';
import { ColumnChart } from '../../ui/ColumnChart';
import { Segmented } from '../../ui/Segmented';
import { weekRange } from '../today/weekRange';
import { dayMonth } from './chartText';
import styles from './ProgressPage.module.css';
import type { ProgressModel } from './progressModel';

/** Kilograms with thousands separators in every language: "2.400" / "2,400". */
function kilos(value: number, locale: Locale): string {
  return formatNumber(value, locale, { maximumFractionDigits: 0, useGrouping: 'always' });
}

/** What is written under a column and in its name: a week range or a month. */
function periodText(period: StatsPeriod, start: string, locale: Locale) {
  if (period === 'week') return { label: dayMonth(start), range: weekRange(start, locale) };
  const date = parseIsoDate(start);
  return {
    label: formatDate(date, locale, { month: 'short' }),
    range: formatDate(date, locale, { month: 'short', year: 'numeric' }),
  };
}

/** "Semana 2–8 nov" or "noviembre de 2026": the period the figures belong to. */
function subtitle(period: StatsPeriod, start: string, locale: Locale, t: TFunction): string {
  return period === 'week'
    ? t('progress.stats.weekSubtitle', { range: weekRange(start, locale) })
    : formatDate(parseIsoDate(start), locale, { month: 'long', year: 'numeric' });
}

/** The weekly streak and the weight lifted, exercises and sets per week or per month. */
export function StatsCard({ model }: { model: ProgressModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const periods = useMemo(() => model.stats(period), [model, period]);
  const current = periods.at(-1);
  const { streak } = model;

  const columns = periods.map((stats) => {
    const text = periodText(period, stats.start, locale);
    return {
      label: text.label,
      value: stats.volume,
      name: `${text.range}: ${t('progress.stats.kg', { value: kilos(stats.volume, locale) })}, ${t(
        'progress.stats.exercisesCount',
        { count: stats.exercises },
      )}, ${t('progress.stats.setsCount', { count: stats.sets })}`,
      stats,
      range: text.range,
    };
  });
  const max = Math.max(0, ...periods.map((p) => p.volume));

  const note = streak.activeThisWeek
    ? t('progress.stats.streakBest', { count: streak.best })
    : t(streak.current > 0 ? 'progress.stats.streakKeep' : 'progress.stats.streakStart');

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('progress.stats.title')}</h2>

      <dl className={styles.stats}>
        <div className={cx(styles.stat, styles.statWide)}>
          <dt className={styles.statLabel}>{t('progress.stats.streak')}</dt>
          <dd className={styles.statValue}>
            {t('progress.stats.streakValue', { count: streak.current })}
          </dd>
          <dd className={styles.statNote}>{note}</dd>
        </div>
      </dl>

      <Segmented
        legend={t('progress.stats.summaryBy')}
        hideLegend
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'week', label: t('progress.stats.week') },
          { value: 'month', label: t('progress.stats.month') },
        ]}
      />
      {current && (
        <>
          <p className={styles.sub}>{subtitle(period, current.start, locale, t)}</p>
          <dl className={styles.stats}>
            <Figure
              wide
              label={t('progress.stats.volume')}
              value={t('progress.stats.kg', { value: kilos(current.volume, locale) })}
            />
            <Figure
              label={t('progress.stats.exercises')}
              value={formatNumber(current.exercises, locale)}
            />
            <Figure label={t('progress.stats.sets')} value={formatNumber(current.sets, locale)} />
          </dl>
        </>
      )}

      <ChartFrame
        legend={[{ label: t('progress.stats.volume'), kind: 'bar' }]}
        table={{
          caption: t(
            period === 'week' ? 'progress.stats.captionWeek' : 'progress.stats.captionMonth',
          ),
          head: [
            t('progress.stats.periodHead'),
            t('progress.stats.volumeHead'),
            t('progress.stats.exercisesHead'),
            t('progress.stats.setsHead'),
            t('progress.stats.sessionsHead'),
          ],
          rows: columns.map(({ stats, range }) => [
            range,
            kilos(stats.volume, locale),
            String(stats.exercises),
            String(stats.sets),
            String(stats.sessions),
          ]),
        }}
      >
        <ColumnChart
          columns={columns}
          description={t(
            period === 'week' ? 'progress.stats.chartWeeks' : 'progress.stats.chartMonths',
            {
              title: t('progress.stats.volume'),
              count: columns.length,
              max: kilos(max, locale),
            },
          )}
          formatY={(value) =>
            formatNumber(value, locale, {
              maximumFractionDigits: 1,
              notation: value >= 10000 ? 'compact' : 'standard',
            })
          }
        />
      </ChartFrame>
    </Card>
  );
}

function Figure({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cx(styles.stat, wide && styles.statWide)}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={styles.statValue}>{value}</dd>
    </div>
  );
}
