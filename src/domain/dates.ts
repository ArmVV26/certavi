// Calendar dates as 'YYYY-MM-DD' strings in local time. Weeks start on Monday.
// String dates sort chronologically, survive JSON and have no time-zone surprises.
import type { Weekday } from './model/enums';

export type IsoDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day of `date`. */
export function toIsoDate(date: Date): IsoDate {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of an ISO date. Throws on malformed input. */
export function parseIsoDate(value: IsoDate): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Invalid ISO date: ${value}`);
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    throw new RangeError(`Invalid ISO date: ${value}`);
  }
  return date;
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(value: IsoDate): Weekday {
  return (((parseIsoDate(value).getDay() + 6) % 7) + 1) as Weekday;
}

/** The Monday of the week that contains `value`. */
export function mondayOf(value: IsoDate): IsoDate {
  return addDays(value, 1 - isoWeekday(value));
}

export function isMonday(value: IsoDate): boolean {
  return isoWeekday(value) === 1;
}

/** Whole days from `from` to `to` (negative if `to` is earlier). DST-safe. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/** True if `value` falls in the week that starts on `monday`. */
export function isInWeek(value: IsoDate, monday: IsoDate): boolean {
  return value >= monday && value < addDays(monday, 7);
}
