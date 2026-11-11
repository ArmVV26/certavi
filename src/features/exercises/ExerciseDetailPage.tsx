import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import {
  INCREMENT_RANGE,
  countSchemeSets,
  isValidIncrement,
  parseIsoDate,
  type ExerciseSetupItem,
  type HistoryEntry,
  type SetupDraftRow,
} from '../../domain';
import { useDatabase } from '../../data/DatabaseContext';
import { readExerciseDetail, type ExerciseDetailView } from '../../data/exerciseCatalog';
import {
  ExerciseInRoutineError,
  setExerciseArchived,
  setExerciseIncrement,
  setExerciseSetup,
} from '../../data/exercises';
import { formatDate, formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Button } from '../../ui/Button';
import { buttonClasses } from '../../ui/buttonClasses';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Dialog } from '../../ui/Dialog';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { NumberField } from '../../ui/NumberField';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/ToastContext';
import { EvolutionCard } from './EvolutionCard';
import styles from './ExerciseDetailPage.module.css';
import { SetupEditor } from './SetupEditor';

/** One exercise: its data, records, history and weight step; the ones the user made can be edited. */
export function ExerciseDetailPage() {
  const { t } = useTranslation();
  const db = useDatabase();
  const { exerciseId = '' } = useParams();
  const view = useLiveQuery(
    async () => ({ value: await readExerciseDetail(db, exerciseId) }),
    [db, exerciseId],
  );

  if (!view) return null;
  if (!view.value) {
    return (
      <EmptyState
        icon="info"
        title={t('exercises.detail.notFound')}
        action={
          <Link to="/exercises" className={buttonClasses({ variant: 'secondary' })}>
            {t('exercises.detail.back')}
          </Link>
        }
      />
    );
  }
  // Keyed by exercise: each one has its own typed step.
  return <DetailScreen key={exerciseId} detail={view.value} />;
}

type DialogState = 'archive' | 'blocked' | null;

function DetailScreen({ detail }: { detail: ExerciseDetailView }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const db = useDatabase();
  const toast = useToast();
  const { exercise, routines, history, stats } = detail;
  const [dialog, setDialog] = useState<DialogState>(null);
  const name = resolveText(t, exercise.name);
  const routineNames = routines.map((routine) => resolveText(t, routine.name)).join(', ');

  const failed = () => {
    toast.show({ message: t('exercises.detail.failed'), tone: 'danger' });
  };

  const archive = async () => {
    setDialog(null);
    try {
      await setExerciseArchived(db, exercise.id, true);
      toast.show({ message: t('exercises.detail.archived'), tone: 'success' });
    } catch (error) {
      if (error instanceof ExerciseInRoutineError) setDialog('blocked');
      else failed();
    }
  };

  const unarchive = async () => {
    try {
      await setExerciseArchived(db, exercise.id, false);
      toast.show({ message: t('exercises.detail.restored'), tone: 'success' });
    } catch {
      failed();
    }
  };

  const yesNo = (value: boolean) => t(value ? 'exercises.detail.yes' : 'exercises.detail.no');
  const date = (iso: string) => formatDate(parseIsoDate(iso), locale, { dateStyle: 'medium' });
  const kg = (value: number) => t('exercises.detail.kg', { value: formatNumber(value, locale) });
  const setsCount = countSchemeSets(exercise.defaultScheme);
  const scheme = t('exercises.detail.schemeSets', { count: setsCount });

  return (
    <div className={styles.page}>
      <Link to="/exercises" className={styles.back}>
        <Icon name="back" size={20} />
        {t('exercises.detail.back')}
      </Link>

      <div className={styles.header}>
        <h2 className={styles.name}>{name}</h2>
        {(exercise.custom || exercise.archived) && (
          <div className={styles.tags}>
            {exercise.custom && <Tag>{t('exercises.list.mine')}</Tag>}
            {exercise.archived && <Tag tone="warning">{t('exercises.list.archived')}</Tag>}
          </div>
        )}
        {exercise.custom && (
          <div className={styles.actions}>
            <Link
              to={`/exercises/${exercise.id}/edit`}
              className={buttonClasses({ variant: 'secondary' })}
            >
              {t('exercises.detail.edit')}
            </Link>
            {exercise.archived ? (
              <Button variant="secondary" onClick={() => void unarchive()}>
                {t('exercises.detail.unarchive')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setDialog(routines.length > 0 ? 'blocked' : 'archive');
                }}
              >
                {t('exercises.detail.archive')}
              </Button>
            )}
          </div>
        )}
      </div>

      <Card element="section">
        <h3 className={styles.heading}>{t('exercises.detail.details')}</h3>
        <dl className={styles.facts}>
          <Fact label={t('exercises.detail.primary')}>
            {t(`exercises.groups.${exercise.primaryGroup}`)}
          </Fact>
          <Fact label={t('exercises.detail.secondary')}>
            {exercise.secondaryMuscles.length === 0
              ? t('exercises.detail.none')
              : exercise.secondaryMuscles.map((group) => t(`exercises.groups.${group}`)).join(', ')}
          </Fact>
          <Fact label={t('exercises.detail.equipment')}>
            {t(`exercises.equipment.${exercise.equipment}`)}
          </Fact>
          <Fact label={t('exercises.detail.kind')}>{t(`exercises.kind.${exercise.kind}`)}</Fact>
          <Fact label={t('exercises.detail.unilateral')}>{yesNo(exercise.unilateral)}</Fact>
          <Fact label={t('exercises.detail.straps')}>{yesNo(exercise.supportsStraps)}</Fact>
          <Fact label={t('exercises.detail.band')}>{yesNo(exercise.supportsBand)}</Fact>
          <Fact label={t('exercises.detail.scheme')}>
            {exercise.defaultScheme.rir === ''
              ? scheme
              : t('exercises.detail.schemeRir', { sets: scheme, rir: exercise.defaultScheme.rir })}
          </Fact>
        </dl>
      </Card>

      <Card element="section">
        <h3 className={styles.heading}>{t('exercises.detail.routines')}</h3>
        <p>{routines.length === 0 ? t('exercises.detail.noRoutines') : routineNames}</p>
      </Card>

      <StepCard key={exercise.increment} exerciseId={exercise.id} increment={exercise.increment} />

      <SetupCard exerciseId={exercise.id} setup={exercise.setup} />

      {history.length === 0 ? (
        <p className={styles.muted}>{t('exercises.detail.neverLogged')}</p>
      ) : (
        <>
          <Card element="section">
            <h3 className={styles.heading}>{t('exercises.detail.records')}</h3>
            <dl className={styles.facts}>
              {stats.bestE1rm && (
                <Fact label={t('exercises.detail.e1rm')}>
                  {t('exercises.detail.recordLine', {
                    value: kg(Math.round(stats.bestE1rm.value * 10) / 10),
                    date: date(stats.bestE1rm.date),
                  })}
                </Fact>
              )}
              {stats.maxWeight && (
                <Fact label={t('exercises.detail.maxWeight')}>
                  {t('exercises.detail.recordLine', {
                    value: t('exercises.detail.weightReps', {
                      weight: formatNumber(stats.maxWeight.weight, locale),
                      reps: stats.maxWeight.set.reps,
                    }),
                    date: date(stats.maxWeight.date),
                  })}
                </Fact>
              )}
              {stats.bestVolume && (
                <Fact label={t('exercises.detail.bestVolume')}>
                  {t('exercises.detail.recordLine', {
                    value: kg(Math.round(stats.bestVolume.volume)),
                    date: date(stats.bestVolume.date),
                  })}
                </Fact>
              )}
            </dl>
            {stats.repRecords.length > 0 && (
              <>
                <h4 className={styles.subheading}>{t('exercises.detail.repRecords')}</h4>
                <ul className={styles.plain}>
                  {stats.repRecords.map((record) => (
                    <li key={record.reps}>
                      {t('exercises.detail.repRecord', {
                        reps: record.reps,
                        weight: formatNumber(record.weight, locale),
                      })}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <EvolutionCard exercise={exercise} history={history} />

          <Card element="section">
            <h3 className={styles.heading}>{t('exercises.detail.history')}</h3>
            <ol className={styles.history}>
              {history.map((entry) => (
                <HistoryItem key={entry.session.id} entry={entry} date={date} />
              ))}
            </ol>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={dialog === 'archive'}
        title={t('exercises.detail.archiveTitle')}
        message={t('exercises.detail.archiveText')}
        confirmLabel={t('exercises.detail.archiveConfirm')}
        cancelLabel={t('exercises.detail.cancel')}
        onConfirm={() => void archive()}
        onCancel={() => {
          setDialog(null);
        }}
      />
      <Dialog
        open={dialog === 'blocked'}
        title={t('exercises.detail.blockedTitle')}
        description={t('exercises.detail.blockedText', { routines: routineNames })}
        role="alertdialog"
        onClose={() => {
          setDialog(null);
        }}
        actions={
          <Button
            onClick={() => {
              setDialog(null);
            }}
          >
            {t('exercises.detail.gotIt')}
          </Button>
        }
      />
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The weight step of the exercise, which the user can change whatever the exercise is. */
function StepCard({ exerciseId, increment }: { exerciseId: string; increment: number }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const db = useDatabase();
  const toast = useToast();
  const [step, setStep] = useState<number | null>(increment);
  const [error, setError] = useState<string | undefined>();

  const save = async () => {
    if (!isValidIncrement(step)) {
      setError(
        t('exercises.errors.increment-range', {
          min: formatNumber(INCREMENT_RANGE.min, locale),
          max: formatNumber(INCREMENT_RANGE.max, locale),
        }),
      );
      return;
    }
    setError(undefined);
    try {
      await setExerciseIncrement(db, exerciseId, step);
      toast.show({ message: t('exercises.detail.stepSaved'), tone: 'success' });
    } catch {
      toast.show({ message: t('exercises.detail.failed'), tone: 'danger' });
    }
  };

  return (
    <Card element="section">
      <h3 className={styles.heading}>{t('exercises.detail.step')}</h3>
      <div className={styles.step}>
        <NumberField
          label={t('exercises.detail.stepField')}
          value={step}
          onChange={(value) => {
            setStep(value);
            setError(undefined);
          }}
          {...(error ? { error } : {})}
        />
        <Button variant="secondary" onClick={() => void save()}>
          {t('exercises.detail.stepSave')}
        </Button>
      </div>
    </Card>
  );
}

/** The machine settings of the exercise (backrest, seat…), shown and edited in place. */
function SetupCard({
  exerciseId,
  setup,
}: {
  exerciseId: string;
  setup: readonly ExerciseSetupItem[] | undefined;
}) {
  const { t } = useTranslation();
  const db = useDatabase();
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  const save = async (rows: SetupDraftRow[]) => {
    try {
      await setExerciseSetup(db, exerciseId, rows);
    } catch (error) {
      toast.show({ message: t('exercises.setup.failed'), tone: 'danger' });
      throw error;
    }
    setEditing(false);
    toast.show({ message: t('exercises.setup.saved'), tone: 'success' });
  };

  return (
    <Card element="section">
      <h3 className={styles.heading}>{t('exercises.setup.title')}</h3>
      {editing ? (
        <SetupEditor
          setup={setup}
          onSave={save}
          onCancel={() => {
            setEditing(false);
          }}
        />
      ) : (
        <div className={styles.setup}>
          {setup && setup.length > 0 ? (
            <ul className={styles.plain}>
              {setup.map((item, index) => (
                <li key={index}>{t('exercises.setup.item', item)}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>{t('exercises.setup.empty')}</p>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(true);
            }}
          >
            {t(setup && setup.length > 0 ? 'exercises.setup.edit' : 'exercises.setup.add')}
          </Button>
        </div>
      )}
    </Card>
  );
}

function HistoryItem({ entry, date }: { entry: HistoryEntry; date: (iso: string) => string }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const sets = entry.sets
    .map((set) =>
      t('exercises.detail.setLine', {
        weight: formatNumber(set.weight, locale),
        reps: set.reps,
      }),
    )
    .join(' · ');
  return (
    <li>
      <Link to={`/session/${entry.session.id}`} className={styles.historyLink}>
        <span className={styles.historyDate}>{date(entry.session.date)}</span>
        <span>{sets}</span>
        {(entry.deload || entry.excluded) && (
          <span className={styles.tags}>
            {entry.deload && <Tag tone="warning">{t('exercises.detail.deload')}</Tag>}
            {entry.excluded && <Tag>{t('exercises.detail.excluded')}</Tag>}
          </span>
        )}
      </Link>
    </li>
  );
}
