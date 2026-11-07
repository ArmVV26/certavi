import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addMonths, monthStart, parseIsoDate } from '../../domain';
import { readCalendar } from '../../data/calendar';
import { useDatabase } from '../../data/DatabaseContext';
import { formatDate } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { useToday } from '../today/useToday';
import styles from './CalendarPage.module.css';
import { buildCalendarModel, isVisible, type CalendarModel, type Selection } from './calendarModel';
import { DayPanel } from './DayPanel';
import { MonthGrid } from './MonthGrid';
import { WeekPanel } from './WeekPanel';

export function CalendarPage() {
  const db = useDatabase();
  const today = useToday();
  const [month, setMonth] = useState(() => monthStart(today));
  const [selection, setSelection] = useState<Selection | null>(null);
  const data = useLiveQuery(() => readCalendar(db, month), [db, month]);
  const model = useMemo(
    () => (data ? buildCalendarModel(data, month, today) : undefined),
    [data, month, today],
  );
  // The panel closes when its day or week is not in the visible month any more.
  const shown = model && selection && isVisible(model, selection) ? selection : null;

  return (
    <div className={styles.page}>
      <MonthBar
        month={month}
        current={monthStart(today)}
        onMonth={setMonth}
        onToday={() => {
          setMonth(monthStart(today));
          setSelection({ kind: 'day', date: today });
        }}
      />
      {model && (
        <>
          <MonthGrid model={model} selection={shown} onSelect={setSelection} />
          <Summary model={model} />
          {shown && (
            <Panel
              model={model}
              selection={shown}
              onClose={() => {
                setSelection(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

interface MonthBarProps {
  month: string;
  current: string;
  onMonth: (month: string) => void;
  onToday: () => void;
}

function MonthBar({ month, current, onMonth, onToday }: MonthBarProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  return (
    <div className={styles.monthBar}>
      <IconButton
        icon="back"
        label={t('calendar.month.previous')}
        onClick={() => {
          onMonth(addMonths(month, -1));
        }}
      />
      <h2 className={styles.monthTitle}>
        {formatDate(parseIsoDate(month), locale, { month: 'long', year: 'numeric' })}
      </h2>
      <IconButton
        icon="chevronRight"
        label={t('calendar.month.next')}
        onClick={() => {
          onMonth(addMonths(month, 1));
        }}
      />
      {month !== current && (
        <Button variant="secondary" className={styles.todayButton} onClick={onToday}>
          {t('calendar.month.today')}
        </Button>
      )}
    </div>
  );
}

function Summary({ model }: { model: CalendarModel }) {
  const { t } = useTranslation();
  const { sessions, activities } = model.summary;
  const text =
    sessions === 0 && activities === 0
      ? t('calendar.summary.none')
      : `${t('calendar.summary.sessions', { count: sessions })} · ${t('calendar.summary.activities', { count: activities })}`;
  return <p className={styles.summary}>{text}</p>;
}

function Panel({
  model,
  selection,
  onClose,
}: {
  model: CalendarModel;
  selection: Selection;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = selection.kind === 'day' ? selection.date : selection.monday;
  useEffect(() => {
    // jsdom (tests) has no scrollIntoView.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [key]);
  return (
    <div ref={ref}>
      {selection.kind === 'day' ? (
        <DayPanel key={key} model={model} date={selection.date} onClose={onClose} />
      ) : (
        <WeekPanel key={key} model={model} monday={selection.monday} onClose={onClose} />
      )}
    </div>
  );
}
