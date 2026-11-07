import { useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  backoffWeight,
  displayRows,
  exerciseProgress,
  isExerciseComplete,
  knownBands,
  parseIsoDate,
  progressionAdvice,
  isPlannedKind,
  strapsBandDefaults,
  EXCLUSION_REASONS,
  type DisplayRow,
  type Exercise,
  type ExerciseNote,
  type ExclusionReason,
  type HistoryEntry,
  type PlanItem,
  type ProgressionAdvice,
  type RehabContext,
  type SetEntry,
} from '../../domain';
import type { RowDraft } from '../../data/sessionDrafts';
import { formatDate, formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Card } from '../../ui/Card';
import { Checkbox } from '../../ui/Checkbox';
import { SelectField } from '../../ui/SelectField';
import { Switch } from '../../ui/Switch';
import { Tag } from '../../ui/Tag';
import { TextArea, TextField } from '../../ui/TextField';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import styles from './ExerciseCard.module.css';
import { SetRow } from './SetRow';
import type { SessionActions } from './useSessionActions';
import { useDebouncedSave } from './useDebouncedSave';

interface ExerciseCardProps {
  item: PlanItem;
  exercise: Exercise | undefined;
  /** Live sets of this exercise in this session. */
  sets: SetEntry[];
  note: ExerciseNote | undefined;
  reference: HistoryEntry | undefined;
  deload: boolean;
  /** The pain context of the rehab calf rule, when a rehab block is active. */
  rehab?: RehabContext | undefined;
  drafts: Record<string, RowDraft> | undefined;
  /** Where the card is in the session, to enable "up" and "down". */
  isFirst: boolean;
  isLast: boolean;
  /** The exercise was just added: take the focus (once no sheet is open). */
  focusHeading: boolean;
  actions: SessionActions;
}

export function ExerciseCard({
  item,
  exercise,
  sets,
  note,
  reference,
  deload,
  rehab,
  drafts,
  isFirst,
  isLast,
  focusHeading,
  actions,
}: ExerciseCardProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { exerciseId } = item;
  const name = exercise ? resolveText(t, exercise.name) : exerciseId;
  const bodyweight = exercise?.equipment === 'bodyweight';
  const kg = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 2 });

  const rows = useMemo(
    () => displayRows({ scheme: item.scheme, sets, reference: reference?.sets ?? null }),
    [item.scheme, sets, reference],
  );
  const progress = exerciseProgress(rows);
  const complete = isExerciseComplete(progress);

  // An exercise just added takes the focus and scrolls into view.
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { clearExerciseFocus } = actions;
  useEffect(() => {
    if (!focusHeading) return;
    toggleRef.current?.focus();
    toggleRef.current?.scrollIntoView({ block: 'center' });
    clearExerciseFocus();
  }, [focusHeading, clearExerciseFocus]);

  // Completed exercises fold; one that stops being complete (a set removed) unfolds again.
  const [open, setOpen] = useState(!complete);
  const [wasComplete, setWasComplete] = useState(complete);
  if (wasComplete !== complete) {
    setWasComplete(complete);
    setOpen(!complete);
  }

  // Straps and band: what the next sets get. Changing them offers to correct the saved sets.
  const defaults = strapsBandDefaults(exercise?.defaultBand, sets, reference?.sets ?? null);
  const [straps, setStraps] = useState(defaults.straps);
  const [band, setBand] = useState(defaults.band);
  const committedBand = useRef(band);
  const bands = knownBands([...sets, ...(reference?.sets ?? [])]);

  const changeStraps = (next: boolean) => {
    setStraps(next);
    if (sets.length > 0) actions.requestStrapsBand(exerciseId, { straps: next }, sets.length);
  };
  const commitBand = () => {
    if (band === committedBand.current) return;
    committedBand.current = band;
    if (sets.length > 0) actions.requestStrapsBand(exerciseId, { band }, sets.length);
  };

  // Rows: the symbol and name each one shows, and the line under it.
  const labels = rows.map((row, index) => {
    const before = rows.slice(0, index + 1);
    if (row.kind === 'warmup') {
      const symbol = t('sets.warmupSymbol');
      const ordinal = before.filter((r) => r.kind === 'warmup').length;
      return { symbol, name: `${symbol}${String(ordinal)}`, caption: t('session.row.noCount') };
    }
    if (row.kind === 'dropset') {
      const symbol = t('sets.dropsetSymbol');
      const ordinal = before.filter((r) => r.kind === 'dropset').length;
      return {
        symbol,
        name: `${symbol}${String(ordinal)}`,
        caption: t('session.row.role.dropset'),
      };
    }
    const symbol = String(row.number);
    const caption = [t(`session.row.role.${row.kind}`), row.reps].filter(Boolean).join(' · ');
    return { symbol, name: symbol, caption };
  });

  const loggedText = (row: DisplayRow) =>
    row.set
      ? t('session.exercise.lastSet', { weight: kg(row.set.weight), reps: row.set.reps })
      : '';

  const topRow = rows.find((row) => row.kind === 'top');
  const topWeight = topRow ? (drafts?.[topRow.slot]?.weight ?? topRow.set?.weight ?? null) : null;
  const backoff = exercise && topWeight ? backoffWeight(topWeight, exercise.increment) : null;

  const advice = exercise
    ? progressionAdvice({
        scheme: item.scheme,
        exercise,
        exerciseId,
        referenceSets: reference?.sets ?? null,
        deload,
        rehab,
      })
    : null;
  const hint = advice ? hintText(advice, kg, t) : null;

  const lastTime = reference
    ? t('session.exercise.lastTime', {
        date: formatDate(parseIsoDate(reference.session.date), locale, {
          day: 'numeric',
          month: 'short',
        }),
        sets: reference.sets
          .map((s) => t('session.exercise.lastSet', { weight: kg(s.weight), reps: s.reps }))
          .join(' · '),
      })
    : t('session.exercise.noLast');

  const workingRows = rows.filter((row) => isPlannedKind(row.kind));
  const ranges = [
    ...new Set(
      item.scheme.blocks.flatMap((b) => (isPlannedKind(b.kind) && b.reps ? [b.reps] : [])),
    ),
  ];
  const planLine = [
    t('plan.sets', { count: workingRows.length }),
    ranges.length > 0 ? t('session.exercise.reps', { range: ranges.join('/') }) : null,
    item.scheme.rir ? t('session.exercise.rir', { rir: item.scheme.rir }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const summary = rows
    .filter((row) => row.set && row.kind !== 'warmup')
    .map((row) =>
      t('session.exercise.summary', {
        weight: kg(row.set?.weight ?? 0),
        reps: row.set?.reps ?? 0,
      }),
    )
    .join(' · ');

  return (
    <Card element="article" className={styles.card}>
      <div className={styles.top}>
        <h3 className={styles.heading}>
          <button
            ref={toggleRef}
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            onClick={() => {
              setOpen(!open);
            }}
          >
            {name}
          </button>
        </h3>
        <div className={styles.tools}>
          <IconButton
            icon="chevronUp"
            label={t('session.exercise.moveUp', { name })}
            disabled={isFirst}
            onClick={() => {
              void actions.moveExercise(exerciseId, -1);
            }}
          />
          <IconButton
            icon="chevronDown"
            label={t('session.exercise.moveDown', { name })}
            disabled={isLast}
            onClick={() => {
              void actions.moveExercise(exerciseId, 1);
            }}
          />
        </div>
      </div>
      <div className={styles.tags}>
        {exercise && (
          <Tag>
            {t(
              exercise.kind === 'compound'
                ? 'session.exercise.basic'
                : 'session.exercise.isolation',
            )}
          </Tag>
        )}
        {item.optional && <Tag>{t('session.exercise.optional')}</Tag>}
        {item.added && <Tag tone="warning">{t('session.exercise.outside')}</Tag>}
        {complete && <Tag tone="success">{t('session.exercise.done')}</Tag>}
      </div>

      {!open ? (
        summary && <p className={styles.summary}>{summary}</p>
      ) : (
        <>
          <p className={styles.muted}>{planLine}</p>
          {hint && <p className={styles.hint}>{hint}</p>}
          <p className={styles.muted}>{lastTime}</p>

          {(exercise?.supportsStraps || exercise?.supportsBand) && (
            <div className={styles.extras}>
              {exercise.supportsStraps && (
                <Switch
                  label={t('session.exercise.straps')}
                  checked={straps}
                  onChange={changeStraps}
                />
              )}
              {exercise.supportsBand && (
                <>
                  <TextField
                    label={t('session.exercise.band')}
                    value={band}
                    list={`bands-${exerciseId}`}
                    autoComplete="off"
                    onChange={(event) => {
                      setBand(event.target.value);
                    }}
                    onBlur={commitBand}
                  />
                  <datalist id={`bands-${exerciseId}`}>
                    {bands.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </>
              )}
            </div>
          )}

          <div className={styles.header} aria-hidden="true">
            <span>{t('session.row.set')}</span>
            <span>{t('session.row.previous')}</span>
            <span>{bodyweight ? t('session.row.added') : t('session.row.weight')}</span>
            <span>{t('session.row.reps')}</span>
            <span>{t('session.row.rir')}</span>
            <span />
          </div>
          <ol className={styles.rows}>
            {rows.map((row, index) => {
              const label = labels[index];
              const target = { exerciseId, row, bodyweight };
              const wrong = actions.invalid;
              const focus = actions.focusRequest;
              return (
                <SetRow
                  key={row.slot}
                  exerciseId={exerciseId}
                  row={row}
                  symbol={label?.symbol ?? ''}
                  name={label?.name ?? ''}
                  caption={label?.caption ?? ''}
                  bodyweight={bodyweight}
                  draft={drafts?.[row.slot] ?? null}
                  canRemove={rows.length > 1}
                  invalidField={
                    wrong?.exerciseId === exerciseId && wrong.slot === row.slot ? wrong.field : null
                  }
                  focusWeight={focus?.exerciseId === exerciseId && focus.slot === row.slot}
                  onFocused={actions.clearFocusRequest}
                  onEdit={(draft, commit) => {
                    void actions.editRow(target, draft, commit);
                  }}
                  onDone={() => {
                    if (row.set) actions.requestUnsave(exerciseId, row.slot);
                    else {
                      void actions.markDone(
                        target,
                        drafts?.[row.slot] ?? null,
                        exercise?.supportsStraps ? straps : undefined,
                        exercise?.supportsBand ? band : undefined,
                      );
                    }
                  }}
                  onType={(type) => {
                    void actions.changeType(exerciseId, row.slot, type);
                  }}
                  onRemove={() => {
                    actions.requestRemove(exerciseId, row, label?.name ?? '', loggedText(row));
                  }}
                />
              );
            })}
          </ol>

          {backoff !== null && (
            <p className={styles.muted}>{t('session.exercise.backoff', { weight: kg(backoff) })}</p>
          )}

          <div className={styles.buttons}>
            <Button
              variant="secondary"
              onClick={() => {
                void actions.addNewRow(exerciseId, 'warmup');
              }}
            >
              {t('session.exercise.addWarmup')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void actions.addNewRow(exerciseId, 'extra');
              }}
            >
              {t('session.exercise.addExtra')}
            </Button>
            <NoteButton exerciseId={exerciseId} note={note} actions={actions} />
            <Button
              variant="danger"
              onClick={() => {
                actions.requestRemoveExercise(exerciseId, name, sets.length, note !== undefined);
              }}
            >
              {t('session.exercise.removeExercise')}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function hintText(
  advice: ProgressionAdvice,
  kg: (value: number) => string,
  t: TFunction,
): string | null {
  switch (advice.action) {
    case 'increase':
      return t('session.hint.increase', { weight: kg(advice.to) });
    case 'hold':
      if (advice.reason === 'rehab-gate') {
        return t('session.hint.rehabGate', { weight: kg(advice.weight) });
      }
      return t('session.hint.hold', { weight: kg(advice.weight), reps: advice.targetReps });
    case 'deload':
      return t('session.hint.deload');
    case 'thinner-band':
      return t('session.hint.thinnerBand');
    case 'same-band':
      return t('session.hint.sameBand', { reps: advice.targetReps });
    case 'no-reference':
      return null;
  }
}

interface NoteButtonProps {
  exerciseId: string;
  note: ExerciseNote | undefined;
  actions: SessionActions;
}

/** The "Nota" button and, once opened, the note of the exercise with its "does not count" mark. */
function NoteButton({ exerciseId, note, actions }: NoteButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note?.text ?? '');
  const [synced, setSynced] = useState(note?.text ?? '');
  const exclude = note?.excludeFromProgression === true;
  const reason: ExclusionReason = note?.reason ?? 'machine-busy';

  // Take the saved text when it changes from outside, unless something is being typed.
  if ((note?.text ?? '') !== synced) {
    setSynced(note?.text ?? '');
    if (text === synced) setText(note?.text ?? '');
  }

  const saver = useDebouncedSave(
    (change: { text: string; excludeFromProgression: boolean; reason?: ExclusionReason }) => {
      void actions.saveNote({ exerciseId, ...change });
    },
  );
  const commit = (change: {
    text: string;
    excludeFromProgression: boolean;
    reason?: ExclusionReason;
  }) => {
    saver.schedule(change);
    saver.flush();
  };

  return (
    <>
      <Button
        variant="secondary"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {t(note ? 'session.exercise.noteFilled' : 'session.exercise.note')}
      </Button>
      {open && (
        <div className={styles.note}>
          <TextArea
            label={t('session.notes.exercise')}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              saver.schedule({
                text: event.target.value,
                excludeFromProgression: exclude,
                ...(exclude ? { reason } : {}),
              });
            }}
            onBlur={saver.flush}
          />
          <Checkbox
            label={t('session.notes.exclude')}
            checked={exclude}
            onChange={(checked) => {
              commit({
                text,
                excludeFromProgression: checked,
                ...(checked ? { reason } : {}),
              });
            }}
          />
          {exclude && (
            <SelectField
              label={t('session.notes.reason')}
              value={reason}
              options={EXCLUSION_REASONS.map((value) => ({
                value,
                label: t(`session.notes.reasons.${value}`),
              }))}
              onChange={(value) => {
                commit({
                  text,
                  excludeFromProgression: true,
                  reason: value as ExclusionReason,
                });
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
