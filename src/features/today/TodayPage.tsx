import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { needsDeloadReminder, parseIsoDate, type ActivityKind } from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { startSession } from '../../data/sessions';
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
import { useToast } from '../../ui/ToastContext';
import { DayBlockCard } from '../blocks/DayBlockCard';
import { ActivityCard } from './ActivityCard';
import { BodyWeightCard } from './BodyWeightCard';
import { OtherSessionCard } from './OtherSessionCard';
import { TodayHero } from './TodayHero';
import styles from './TodayPage.module.css';
import { buildTodayModel, type TodayModel } from './todayModel';
import { useRoutineName } from './useRoutineName';
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

/** Runs a write; on failure shows a toast and resolves to false. */
function useSave() {
  const { t } = useTranslation();
  const toast = useToast();
  return async (write: () => Promise<unknown>, success?: string): Promise<boolean> => {
    try {
      await write();
      if (success) toast.show({ message: success, tone: 'success' });
      return true;
    } catch (error: unknown) {
      console.error('Could not save', error);
      toast.show({ message: t('today.saveError'), tone: 'danger' });
      return false;
    }
  };
}

function TodayContent({ model }: { model: TodayModel }) {
  const { t } = useTranslation();
  const db = useDatabase();
  const sync = useSyncState();
  const navigate = useNavigate();
  const toast = useToast();
  const save = useSave();
  const routineName = useRoutineName(model.routinesById);
  const minutesId = useId();
  const firstQuick = model.plan.kind === 'rest' ? model.plan.activities[0] : undefined;
  const [activityKind, setActivityKind] = useState<ActivityKind>(firstQuick ?? 'football');
  const [starting, setStarting] = useState(false);

  async function start(routineId: string | null, date: string) {
    setStarting(true);
    let opened: string | undefined;
    await save(async () => {
      const { session, existed } = await startSession(db, { routineId, date, today: model.today });
      if (existed) {
        toast.show({ message: t('today.other.existing', { routine: routineName(routineId) }) });
      }
      opened = session.id;
    });
    setStarting(false);
    if (opened) void navigate(`/session/${opened}`);
  }

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

      <WeekCard model={model} onChange={changeWeek} />

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
