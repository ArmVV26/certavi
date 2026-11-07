// Tracking an optional block over time: the daily values and the weekly ones, as chart points.
import { addDays, type IsoDate } from '../dates';
import type { BlockLog, WeeklyMetric } from '../model/block';

/** The periods the daily charts can show, counted back from today. */
export const TRACK_PERIODS = ['30', '90', 'all'] as const;
export type TrackPeriod = (typeof TRACK_PERIODS)[number];

/** Weeks the weekly charts show. */
export const WEEKLY_CHART_WEEKS = 12;

/** First day of the period (today included); null for all of it. */
export function periodStart(today: IsoDate, period: TrackPeriod): IsoDate | null {
  return period === 'all' ? null : addDays(today, 1 - Number(period));
}

export interface BlockMetricPoint {
  date: IsoDate;
  value: number;
}

/** The days of `period` with a value of `metricId`, oldest first. */
export function metricPoints(
  logs: readonly Pick<BlockLog, 'blockId' | 'date' | 'metrics'>[],
  blockId: string,
  metricId: string,
  today: IsoDate,
  period: TrackPeriod,
): BlockMetricPoint[] {
  const from = periodStart(today, period);
  return logs
    .flatMap((log) => {
      const value = log.metrics[metricId];
      const inBlock = log.blockId === blockId;
      const inPeriod = (from === null || log.date >= from) && log.date <= today;
      return inBlock && inPeriod && value !== undefined ? [{ date: log.date, value }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface WeeklyPoint {
  /** Monday of the week. */
  week: IsoDate;
  value: number;
}

/** The latest weeks with a value of one part of a weekly metric, oldest first. */
export function weeklyPoints(
  records: readonly Pick<WeeklyMetric, 'blockId' | 'metricId' | 'week' | 'values'>[],
  blockId: string,
  metricId: string,
  partId: string,
  weeks: number = WEEKLY_CHART_WEEKS,
): WeeklyPoint[] {
  return records
    .flatMap((record) => {
      const value = record.values[partId];
      const match = record.blockId === blockId && record.metricId === metricId;
      return match && value !== undefined ? [{ week: record.week, value }] : [];
    })
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-weeks);
}

/** A weekly record with the part set to `value` (or cleared with null); other parts stay. */
export function withWeeklyValues(
  values: Readonly<Record<string, number>>,
  entered: Readonly<Record<string, number | null>>,
): Record<string, number> {
  const kept = Object.entries(values).filter(([part]) => !(part in entered));
  const set = Object.entries(entered).flatMap(([part, value]) =>
    value === null ? [] : [[part, value] as const],
  );
  return Object.fromEntries([...kept, ...set]);
}

/** The weekly value limits, in the unit of the metric (cm). */
export const WEEKLY_VALUE_RANGE = { min: 0, max: 99 } as const;
