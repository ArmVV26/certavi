import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { parseIsoDate } from '../../domain';
import { formatDate, formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Card } from '../../ui/Card';
import { ChartFrame } from '../../ui/ChartFrame';
import { LineChart } from '../../ui/LineChart';
import { weekRange } from '../today/weekRange';
import { dayIndex, oneDecimal, shortDate } from './chartText';
import styles from './ProgressPage.module.css';
import type { ProgressModel } from './progressModel';

/** Weekly average of "how do you arrive" (1–5). */
export function ReadinessCard({ model }: { model: ProgressModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const weeks = model.readiness;
  const points = weeks.map((week, index) => ({
    x: dayIndex(week.monday),
    y: Math.round(week.avg * 10) / 10,
    name: t('progress.readiness.point', {
      range: weekRange(week.monday, locale),
      avg: oneDecimal(week.avg, locale),
      count: week.n,
    }),
    ...(index === 0 || index === weeks.length - 1
      ? { xLabel: shortDate(week.monday, locale) }
      : {}),
  }));

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('progress.readiness.title')}</h2>
      {points.length === 0 ? (
        <p className={styles.muted}>{t('progress.readiness.empty')}</p>
      ) : (
        <>
          <ChartFrame
            table={{
              caption: t('progress.readiness.caption'),
              head: [
                t('progress.chart.week'),
                t('progress.readiness.avgHead'),
                t('progress.readiness.sessionsHead'),
              ],
              rows: weeks.map((week) => [
                weekRange(week.monday, locale),
                oneDecimal(week.avg, locale),
                String(week.n),
              ]),
            }}
          >
            <LineChart
              points={points}
              description={t('progress.chart.line', {
                title: t('progress.readiness.title'),
                count: points.length,
                min: 1,
                max: 5,
              })}
              formatY={(value) => oneDecimal(value, locale)}
              yRange={{ min: 1, max: 5, step: 1 }}
              height={170}
            />
          </ChartFrame>
          <p className={styles.muted}>{t('progress.readiness.note')}</p>
        </>
      )}
    </Card>
  );
}

/** Best 1RM of the first two weeks against the last week, in each basic lift. */
export function ReviewCard({ model }: { model: ProgressModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const review = model.review;
  if (!review) return null;
  const { rows } = review;
  const readiness = review.readiness;
  const trend = readiness ? t(`progress.review.${readiness.trend}`) : '';

  return (
    <Card element="section">
      <h2 className={styles.heading}>
        {t('progress.review.title')}{' '}
        <span className={styles.headingNote}>
          {t('progress.review.date', {
            date: shortDate(review.reviewDate, locale),
          })}
        </span>
      </h2>
      {!review.available ? (
        <p className={styles.muted}>{t('progress.review.empty')}</p>
      ) : (
        <>
          <p className={styles.sub}>
            {review.daysToReview > 0
              ? t('progress.review.soon', { count: review.daysToReview })
              : t('progress.review.done')}
          </p>
          {rows.length === 0 ? (
            <p className={styles.muted}>{t('progress.review.noLifts')}</p>
          ) : (
            <>
              {/* Scrolls on a narrow screen: keyboard users must be able to reach it (axe). */}
              <div
                className={styles.tableWrap}
                role="region"
                aria-label={t('progress.review.caption')}
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
              >
                <table className={styles.table}>
                  <caption className={styles.caption}>{t('progress.review.caption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('progress.review.lift')}</th>
                      <th scope="col">{t('progress.review.start')}</th>
                      <th scope="col">{t('progress.review.now')}</th>
                      <th scope="col">{t('progress.review.change')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const exercise = model.exercises.get(row.exerciseId);
                      const sign = row.pct > 0 ? '+' : '';
                      return (
                        <tr key={row.exerciseId}>
                          <th scope="row">
                            <Link to={`/exercises/${row.exerciseId}`}>
                              {exercise ? resolveText(t, exercise.name) : row.exerciseId}
                            </Link>
                          </th>
                          <td>{oneDecimal(Math.round(row.from * 10) / 10, locale)}</td>
                          <td>{oneDecimal(Math.round(row.to * 10) / 10, locale)}</td>
                          <td
                            className={
                              row.pct > 1 ? styles.up : row.pct < -1 ? styles.down : undefined
                            }
                          >
                            {sign}
                            {formatNumber(row.pct, locale, {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}{' '}
                            %
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p>
                {t('progress.review.up', { count: review.up })} ·{' '}
                {t('progress.review.flat', { count: review.flat })}
              </p>
            </>
          )}
          {readiness && (
            <p>
              {t('progress.review.readiness', {
                early: oneDecimal(readiness.early, locale),
                late: oneDecimal(readiness.late, locale),
              })}
              {trend}.
            </p>
          )}
        </>
      )}
      <p className={styles.muted}>{t('progress.review.rule')}</p>
    </Card>
  );
}

/** The latest record events of every exercise. */
export function RecordsCard({ model }: { model: ProgressModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('progress.records.title')}</h2>
      {model.records.length === 0 ? (
        <p className={styles.muted}>{t('progress.records.empty')}</p>
      ) : (
        <ul className={styles.records}>
          {model.records.map((record) => {
            const exercise = model.exercises.get(record.exerciseId);
            const kind =
              record.kind === 'weight' || !record.set
                ? t('progress.records.weight')
                : t('progress.records.e1rm', {
                    weight: oneDecimal(record.set.weight, locale),
                    reps: record.set.reps,
                  });
            return (
              <li key={`${record.sessionId}-${record.exerciseId}-${record.kind}`}>
                <Link to={`/exercises/${record.exerciseId}`} className={styles.record}>
                  <span className={styles.recordText}>
                    <strong>{exercise ? resolveText(t, exercise.name) : record.exerciseId}</strong>
                    <span className={styles.muted}>
                      {t('progress.records.item', {
                        date: formatDate(parseIsoDate(record.date), locale, {
                          dateStyle: 'medium',
                        }),
                        kind,
                      })}
                    </span>
                  </span>
                  <span className={styles.recordValue}>
                    <strong>
                      {t('progress.records.value', {
                        value: oneDecimal(Math.round(record.value * 10) / 10, locale),
                      })}
                    </strong>
                    <span className={styles.muted}>
                      {t('progress.records.before', {
                        value: oneDecimal(Math.round(record.previous * 10) / 10, locale),
                      })}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** The weekly body weight. */
export function BodyWeightChartCard({ model }: { model: ProgressModel }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const weights = model.bodyWeights;
  const points = weights.map((entry, index) => ({
    x: dayIndex(entry.week),
    y: entry.kg,
    name: t('progress.bodyWeight.point', {
      range: weekRange(entry.week, locale),
      kg: oneDecimal(entry.kg, locale),
    }),
    ...(index === 0 || index === weights.length - 1
      ? { xLabel: shortDate(entry.week, locale) }
      : {}),
  }));
  const ys = weights.map((entry) => entry.kg);

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('progress.bodyWeight.title')}</h2>
      {points.length === 0 ? (
        <p className={styles.muted}>{t('progress.bodyWeight.empty')}</p>
      ) : (
        <ChartFrame
          table={{
            caption: t('progress.bodyWeight.caption'),
            head: [t('progress.chart.week'), t('progress.bodyWeight.weightHead')],
            rows: weights.map((entry) => [
              weekRange(entry.week, locale),
              oneDecimal(entry.kg, locale),
            ]),
          }}
        >
          <LineChart
            points={points}
            description={t('progress.chart.line', {
              title: t('progress.bodyWeight.title'),
              count: points.length,
              min: `${oneDecimal(Math.min(...ys), locale)} kg`,
              max: `${oneDecimal(Math.max(...ys), locale)} kg`,
            })}
            formatY={(value) => oneDecimal(value, locale)}
          />
        </ChartFrame>
      )}
    </Card>
  );
}
