import { useTranslation } from 'react-i18next';
import { parseIsoDate } from '../../domain';
import { formatDate } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { cx } from '../../ui/cx';
import { Icon } from '../../ui/Icon';
import { weekRange } from '../today/weekRange';
import styles from './CalendarPage.module.css';
import type { CalendarDay, CalendarModel, CalendarWeek, Selection } from './calendarModel';

interface MonthGridProps {
  model: CalendarModel;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
}

/** The month as rows of weeks: a button per week (with its markers) and one per day. */
export function MonthGrid({ model, selection, onSelect }: MonthGridProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const first = model.weeks[0];
  const initials = first
    ? first.days.map((day) => formatDate(parseIsoDate(day.date), locale, { weekday: 'narrow' }))
    : [];

  return (
    <div className={styles.grid} role="group" aria-label={t('calendar.grid')}>
      <div className={styles.row} aria-hidden="true">
        <span className={styles.weekCol} />
        {initials.map((initial, i) => (
          <span key={first?.days[i]?.date} className={styles.initial}>
            {initial}
          </span>
        ))}
      </div>
      {model.weeks.map((week) => (
        <div key={week.monday} className={styles.row}>
          <WeekButton
            week={week}
            selected={selection?.kind === 'week' && selection.monday === week.monday}
            onSelect={() => {
              const same = selection?.kind === 'week' && selection.monday === week.monday;
              onSelect(same ? null : { kind: 'week', monday: week.monday });
            }}
          />
          {week.days.map((day) => (
            <DayButton
              key={day.date}
              day={day}
              selected={selection?.kind === 'day' && selection.date === day.date}
              onSelect={() => {
                const same = selection?.kind === 'day' && selection.date === day.date;
                onSelect(same ? null : { kind: 'day', date: day.date });
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function WeekButton({
  week,
  selected,
  onSelect,
}: {
  week: CalendarWeek;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { deload, hiking, short } = week.specials;
  const tags: string[] = [];
  if (deload) tags.push(t('calendar.week.tags.deload'));
  if (hiking) tags.push(t('calendar.week.tags.hiking'));
  if (short !== null) tags.push(t('calendar.week.tags.short', { count: short }));
  if (week.closed) tags.push(t('calendar.week.tags.closed'));
  const name = [t('calendar.week.name', { range: weekRange(week.monday, locale) }), ...tags].join(
    ' · ',
  );

  return (
    <button
      type="button"
      className={cx(styles.weekCol, styles.weekButton, selected && styles.selected)}
      aria-label={name}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={styles.markers} aria-hidden="true">
        {deload && <span className={styles.marker}>{t('calendar.week.markers.deload')}</span>}
        {hiking && <span className={styles.marker}>{t('calendar.week.markers.hiking')}</span>}
        {short !== null && <span className={styles.marker}>{short}</span>}
        {week.closed && <Icon name="check" size={12} strokeWidth={3} />}
      </span>
    </button>
  );
}

function DayButton({
  day,
  selected,
  onSelect,
}: {
  day: CalendarDay;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const date = parseIsoDate(day.date);
  const content: string[] = [];
  if (day.sessions > 0) content.push(t('calendar.cell.sessions', { count: day.sessions }));
  if (day.activities > 0) content.push(t('calendar.cell.activities', { count: day.activities }));
  const name = t('calendar.cell.name', {
    date: formatDate(date, locale, { weekday: 'long', day: 'numeric', month: 'long' }),
    content: content.length > 0 ? content.join(', ') : t('calendar.cell.none'),
  });

  return (
    <button
      type="button"
      className={cx(
        styles.day,
        !day.inMonth && styles.outside,
        day.isToday && styles.today,
        selected && styles.selected,
      )}
      aria-label={name}
      aria-pressed={selected}
      aria-current={day.isToday ? 'date' : undefined}
      onClick={onSelect}
    >
      <span className={styles.dayNumber} aria-hidden="true">
        {date.getDate()}
      </span>
      <span className={styles.dayMarks} aria-hidden="true">
        {day.sessions > 0 && <span className={styles.sessionMark} />}
        {day.sessions > 1 && <span className={styles.sessionMark} />}
        {day.activities > 0 && <span className={styles.activityMark} />}
      </span>
    </button>
  );
}
