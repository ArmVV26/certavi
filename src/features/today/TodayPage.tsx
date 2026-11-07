import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { needsDeloadReminder, parseIsoDate, weeklyStreak, type ActivityKind } from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { readStreakLog } from '../../data/progress';
import { useSyncState } from '../../data/sync/SyncContext';
import {
  readToday,
  saveActivity,
  saveBodyWeight,
  updateBlockLog,
  updateWeek,
  type WeekPatch,
} from '../../data/today';
import { formatDate } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { Notice } from '../../ui/Notice';
import { DayBlockCard } from '../blocks/DayBlockCard';
import { ActivityCard } from './ActivityCard';
import { BodyWeightCard } from './BodyWeightCard';
import { OtherSessionCard } from './OtherSessionCard';
import { TodayHero } from './TodayHero';
import styles from './TodayPage.module.css';
import { buildTodayModel, type TodayModel } from './todayModel';
import { useSave } from './useSave';
import { useStartSession } from './useStartSession';
import { useToday } from './useToday';
import { WeekCard } from './WeekCard';

export function TodayPage() {
  const { locale } = useLocale();
  const db = useDatabase();
  const today = useToday();
  const data = useLiveQuery(() => readToday(db, today), [db, today]);
  const model = useMemo(() => (data ? buildTodayModel(data, today) : undefined), [data, today]);
  const dateLine = formatDate(parseIsoDate(today), locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className={styles.page}>
      <p className={styles.date}>{dateLine}</p>
      {/* Keyed by date: a new day starts with fresh forms. */}
      {model && <TodayContent key={today} model={model} />}
    </div>
  );
}

function TodayContent({ model }: { model: TodayModel }) {
  const { t } = useTranslation();
  const db = useDatabase();
  const sync = useSyncState();
  const save = useSave();
  const minutesId = useId();
  const firstQuick = model.plan.kind === 'rest' ? model.plan.activities[0] : undefined;
  const [activityKind, setActivityKind] = useState<ActivityKind>(firstQuick ?? 'football');
  const { starting, start } = useStartSession(model.today, model.routinesById);
  const streakLog = useLiveQuery(() => readStreakLog(db), [db]);
  const streak = useMemo(
    () => (streakLog ? weeklyStreak(streakLog, model.today) : undefined),
    [streakLog, model.today],
  );

  function changeWeek(patch: WeekPatch) {
    let message: string | undefined;
    if (patch.deload !== undefined) {
      message = t(patch.deload ? 'today.week.deloadToastOn' : 'today.week.deloadToastOff');
    }
    void save(() => updateWeek(db, model.monday, patch), message);
  }

  function quickActivity(kind: ActivityKind) {
    setActivityKind(kind);
    document.getElementById(minutesId)?.focus();
  }

  return (
    <>
      {!sync.hasKey && (
        <Notice>
          <span>{t('today.notices.noKey')}</span>
          <Link to="/settings">{t('today.notices.setKey')}</Link>
        </Notice>
      )}
      {needsDeloadReminder(model.weeksSinceDeload, model.week.deload) && (
        <Notice tone="warning">
          <span>{t('today.notices.deload', { count: model.weeksSinceDeload })}</span>
        </Notice>
      )}

      <TodayHero
        model={model}
        starting={starting}
        onStart={(routineId) => {
          void start(routineId, model.today);
        }}
        onQuickActivity={quickActivity}
      />

      {model.blocks.map((block) => (
        <DayBlockCard
          key={block.id}
          block={block}
          today={model.today}
          log={model.blockLogs.find((l) => l.blockId === block.id)}
          onChange={(patch) =>
            save(
              () => updateBlockLog(db, block.id, model.today, patch),
              'note' in patch ? t('blocksDay.noteSaved') : undefined,
            )
          }
        />
      ))}

      <WeekCard model={model} streak={streak} onChange={changeWeek} />

      <OtherSessionCard
        model={model}
        starting={starting}
        onStart={(routineId, date) => {
          void start(routineId, date);
        }}
      />

      <ActivityCard
        kind={activityKind}
        onKindChange={setActivityKind}
        minutesId={minutesId}
        todayActivities={model.todayActivities}
        onSave={(input) =>
          save(
            () => saveActivity(db, { ...input, date: model.today }),
            t('today.activity.saved', { activity: t(`activities.kinds.${input.kind}`) }),
          )
        }
      />

      <BodyWeightCard
        monday={model.monday}
        records={model.bodyWeights}
        onSave={(monday, kg, range) =>
          save(() => saveBodyWeight(db, monday, kg), t('today.weight.saved', { range }))
        }
      />
    </>
  );
}
