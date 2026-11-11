import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MUSCLE_GROUPS, parseIsoDate, type GroupPeriod } from '../../domain';
import { formatDateRange } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { BarRows } from '../../ui/BarRows';
import { Card } from '../../ui/Card';
import { ChartFrame } from '../../ui/ChartFrame';
import { ColumnChart } from '../../ui/ColumnChart';
import { Segmented } from '../../ui/Segmented';
import { weekRange } from '../today/weekRange';
import { dayMonth, oneDecimal } from './chartText';
import styles from './ProgressPage.module.css';
import type { ProgressModel } from './progressModel';

/** Sets done per muscle group against the plan: this week, last week or the 4-week average. */
export function GroupSetsCard({ model }: { model: ProgressModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [period, setPeriod] = useState<GroupPeriod>('week');
  const data = useMemo(() => model.groups(period), [model, period]);

  const subtitle =
    period === 'average'
      ? t('progress.groups.averageSubtitle', {
          range: formatDateRange(parseIsoDate(data.from), parseIsoDate(data.to), locale),
        })
      : t('progress.groups.weekSubtitle', { range: weekRange(data.from, locale) });
  const tags = [
    data.hiking && t('progress.groups.withHiking'),
    data.deload && t('progress.groups.withDeload'),
  ].filter(Boolean);

  const rows = MUSCLE_GROUPS.map((group) => {
    const done = data.done[group];
    const planned = data.planned[group];
    const label = t(`exercises.groups.${group}`);
    const met = planned > 0 && done >= planned;
    const name = t('progress.groups.row', {
      group: label,
      done: oneDecimal(done, locale),
      count: planned,
    });
    const missing = planned - done;
    return {
      key: group,
      label,
      value: done,
      target: planned,
      valueText: t('progress.groups.value', {
        done: oneDecimal(done, locale),
        planned: oneDecimal(planned, locale),
      }),
      // Shown on phones after the numbers: what is missing, or a tick when the plan is met.
      ...(planned > 0 && {
        remainingText: met
          ? t('progress.groups.remainingMet')
          : t('progress.groups.remaining', {
              count: missing,
              missing: oneDecimal(missing, locale),
            }),
      }),
      name: met ? `${name}, ${t('progress.groups.met')}` : name,
    };
  });

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('progress.groups.title')}</h2>
      <Segmented
        legend={t('progress.groups.period')}
        hideLegend
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'week', label: t('progress.groups.week') },
          { value: 'previous', label: t('progress.groups.previous') },
          { value: 'average', label: t('progress.groups.average') },
        ]}
      />
      <p className={styles.sub}>{[subtitle, ...tags].join(' · ')}</p>
      <ChartFrame
        legend={[
          { label: t('progress.groups.legendDone'), kind: 'bar' },
          { label: t('progress.groups.legendMet'), kind: 'met' },
          { label: t('progress.groups.legendPlan'), kind: 'mark' },
        ]}
      >
        <BarRows rows={rows} />
      </ChartFrame>
    </Card>
  );
}

/** Effective sets of the last weeks, with the plan of each one. */
export function WeeklySetsCard({ model }: { model: ProgressModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  const columns = model.weeks.map((week) => {
    const range = weekRange(week.monday, locale);
    const parts = [
      week.planned === null
        ? t('progress.weeks.sets', { count: week.sets })
        : t('progress.weeks.setsOfPlan', { done: week.sets, planned: week.planned }),
      t('progress.weeks.sessions', { count: week.sessions }),
    ];
    if (week.activityMinutes > 0) {
      parts.push(t('progress.weeks.activity', { minutes: week.activityMinutes }));
    }
    return {
      label: dayMonth(week.monday),
      value: week.sets,
      target: week.planned,
      name: `${range}: ${parts.join(', ')}`,
      week,
      range,
    };
  });
  const max = Math.max(0, ...columns.flatMap((c) => [c.value, c.target ?? 0]));

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('progress.weeks.title')}</h2>
      <ChartFrame
        legend={[
          { label: t('progress.weeks.legendDone'), kind: 'bar' },
          { label: t('progress.weeks.legendPlan'), kind: 'mark' },
        ]}
        table={{
          caption: t('progress.weeks.caption'),
          head: [
            t('progress.chart.week'),
            t('progress.weeks.setsHead'),
            t('progress.weeks.planHead'),
            t('progress.weeks.sessionsHead'),
            t('progress.weeks.activityHead'),
          ],
          rows: columns.map(({ week, range }) => [
            range,
            String(week.sets),
            week.planned === null ? '—' : String(week.planned),
            String(week.sessions),
            String(week.activityMinutes),
          ]),
        }}
      >
        <ColumnChart
          columns={columns}
          description={t('progress.chart.columns', {
            title: t('progress.weeks.title'),
            count: columns.length,
            max,
          })}
          formatY={(value) => oneDecimal(value, locale)}
        />
      </ChartFrame>
    </Card>
  );
}
