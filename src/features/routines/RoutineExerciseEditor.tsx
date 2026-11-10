import { useTranslation } from 'react-i18next';
import {
  MAX_ROUTINE_SETS,
  ROUTINE_SET_KINDS,
  addRoutineRow,
  removeRoutineRow,
  routineRows,
  setRoutineRowKind,
  setRoutineRowReps,
  setSchemeRir,
  withScheme,
  type PlanItem,
  type PlannedKind,
  type RoutineIssue,
} from '../../domain';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Checkbox } from '../../ui/Checkbox';
import { IconButton } from '../../ui/IconButton';
import { SelectField } from '../../ui/SelectField';
import { TextArea, TextField } from '../../ui/TextField';
import { exerciseTitleId, repsFieldId, rirFieldId } from './fieldIds';
import styles from './RoutineExerciseEditor.module.css';

interface RoutineExerciseEditorProps {
  item: PlanItem;
  name: string;
  isFirst: boolean;
  isLast: boolean;
  /** The issues of this exercise (only after a failed save). */
  issues: readonly RoutineIssue[];
  /** The note as shown (a note that comes with the app is already translated). */
  noteText: string;
  onChange: (item: PlanItem) => void;
  onNoteChange: (text: string) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

/** One exercise of the routine being edited: its sets, RIR, note and optional flag. */
export function RoutineExerciseEditor({
  item,
  name,
  isFirst,
  isLast,
  issues,
  noteText,
  onChange,
  onNoteChange,
  onMove,
  onRemove,
}: RoutineExerciseEditorProps) {
  const { t } = useTranslation();
  const titleId = exerciseTitleId(item.exerciseId);
  const rows = routineRows(item.scheme);
  const change = (scheme: ReturnType<typeof addRoutineRow>) => {
    if (scheme) onChange(withScheme(item, scheme));
  };

  const repsError = (row: number): string | undefined => {
    const issue = issues.find(
      (i) => i.row === row && (i.code === 'reps-required' || i.code === 'reps-invalid'),
    );
    if (!issue) return undefined;
    return issue.code === 'reps-required'
      ? t('routines.edit.errors.repsRequired')
      : t('routines.edit.errors.repsInvalid');
  };
  const rirInvalid = issues.some((i) => i.code === 'rir-invalid');

  return (
    <Card>
      <div role="group" aria-labelledby={titleId} className={styles.exercise}>
        <div className={styles.header}>
          <h3 id={titleId} tabIndex={-1} className={styles.name}>
            {name}
          </h3>
          <div className={styles.buttons}>
            <IconButton
              icon="chevronUp"
              label={t('routines.edit.moveUp', { name })}
              disabled={isFirst}
              onClick={() => {
                onMove(-1);
              }}
            />
            <IconButton
              icon="chevronDown"
              label={t('routines.edit.moveDown', { name })}
              disabled={isLast}
              onClick={() => {
                onMove(1);
              }}
            />
            <IconButton
              icon="trash"
              variant="danger"
              label={t('routines.edit.remove', { name })}
              onClick={onRemove}
            />
          </div>
        </div>

        <Checkbox
          label={t('routines.edit.optional')}
          checked={item.optional}
          onChange={(optional) => {
            onChange({ ...item, optional });
          }}
        />

        <ul className={styles.sets} aria-label={t('routines.edit.sets')}>
          {rows.map((row, index) => {
            const n = index + 1;
            return (
              // Sets have no id of their own; their position is their identity.
              <li key={index} className={styles.set}>
                <SelectField
                  compact
                  label={t('routines.edit.setKind', { n })}
                  value={row.kind}
                  options={ROUTINE_SET_KINDS.map((kind) => ({
                    value: kind,
                    label: t(`sets.kinds.${kind}`),
                  }))}
                  onChange={(kind) => {
                    change(setRoutineRowKind(item.scheme, index, kind as PlannedKind));
                  }}
                />
                <TextField
                  id={repsFieldId(item.exerciseId, index)}
                  label={t('routines.edit.setReps', { n })}
                  value={row.reps}
                  autoComplete="off"
                  placeholder="6-8"
                  error={repsError(index)}
                  onChange={(event) => {
                    change(setRoutineRowReps(item.scheme, index, event.target.value));
                  }}
                />
                <IconButton
                  icon="minus"
                  label={t('routines.edit.removeSet', { n })}
                  disabled={rows.length <= 1}
                  onClick={() => {
                    change(removeRoutineRow(item.scheme, index));
                  }}
                />
              </li>
            );
          })}
        </ul>

        <Button
          variant="secondary"
          icon="plus"
          disabled={rows.length >= MAX_ROUTINE_SETS}
          onClick={() => {
            change(addRoutineRow(item.scheme));
          }}
        >
          {t('routines.edit.addSet')}
        </Button>

        <TextField
          id={rirFieldId(item.exerciseId)}
          label={t('routines.edit.rir')}
          hint={t('routines.edit.rirHint')}
          value={item.scheme.rir}
          autoComplete="off"
          error={rirInvalid ? t('routines.edit.errors.rirInvalid') : undefined}
          onChange={(event) => {
            onChange(withScheme(item, setSchemeRir(item.scheme, event.target.value)));
          }}
        />

        <TextArea
          label={t('routines.edit.note')}
          value={noteText}
          rows={2}
          onChange={(event) => {
            onNoteChange(event.target.value);
          }}
        />
      </div>
    </Card>
  );
}
