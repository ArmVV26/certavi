import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SETUP_LIMITS,
  normalizeSetup,
  setupDraftOf,
  type ExerciseSetupItem,
  type SetupDraftRow,
  type SetupError,
} from '../../domain';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { TextField } from '../../ui/TextField';
import styles from './SetupEditor.module.css';

interface SetupEditorProps {
  /** The settings the exercise has now. */
  setup: readonly ExerciseSetupItem[] | undefined;
  /** Saves the rows; rejects when it could not be saved (the caller says so). */
  onSave: (rows: SetupDraftRow[]) => Promise<void>;
  onCancel: () => void;
}

let lastRowKey = 0;
const newRow = (row: SetupDraftRow = { label: '', value: '' }): EditorRow => ({
  ...row,
  key: ++lastRowKey,
});

interface EditorRow extends SetupDraftRow {
  /** Stable key, so removing a row does not move the typed text of the others. */
  key: number;
}

/** Rows of name + value for the machine settings of one exercise, up to four. */
export function SetupEditor({ setup, onSave, onCancel }: SetupEditorProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const [rows, setRows] = useState<EditorRow[]>(() => {
    const current = setupDraftOf(setup);
    return (current.length > 0 ? current : [{ label: '', value: '' }]).map((row) => newRow(row));
  });
  const [errors, setErrors] = useState<SetupError[]>([]);
  const [saving, setSaving] = useState(false);
  // A new object on every failed save, so the focus moves again even to the same field.
  const [focus, setFocus] = useState<{ id: string } | null>(null);

  const fieldId = (key: number, field: 'label' | 'value') => `${baseId}-${String(key)}-${field}`;

  // After a failed save the first wrong field takes the focus.
  useEffect(() => {
    if (focus) document.getElementById(focus.id)?.focus();
  }, [focus]);

  const edit = (key: number, field: 'label' | 'value', text: string) => {
    setErrors([]);
    setFocus(null);
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: text } : row)));
  };

  const save = async () => {
    const result = normalizeSetup(rows);
    if (!result.ok) {
      setErrors(result.errors);
      const first = result.errors[0];
      const target = first ? rows[first.row] : undefined;
      setFocus(target && first ? { id: fieldId(target.key, first.field) } : null);
      return;
    }
    setSaving(true);
    try {
      await onSave(rows);
    } catch {
      // The caller shows the failure; the typed rows stay.
    } finally {
      setSaving(false);
    }
  };

  const messageOf = (index: number, field: 'label' | 'value') => {
    const error = errors.find((e) => e.row === index && e.field === field);
    if (!error) return undefined;
    return t(`exercises.setup.errors.${error.code}`, {
      max: field === 'label' ? SETUP_LIMITS.maxLabel : SETUP_LIMITS.maxValue,
    });
  };

  return (
    <div className={styles.editor}>
      <ul className={styles.rows}>
        {rows.map((row, index) => {
          const n = String(index + 1);
          const labelError = messageOf(index, 'label');
          const valueError = messageOf(index, 'value');
          return (
            <li key={row.key} className={styles.row}>
              <TextField
                id={fieldId(row.key, 'label')}
                label={t('exercises.setup.labelField', { n })}
                value={row.label}
                maxLength={SETUP_LIMITS.maxLabel}
                autoComplete="off"
                onChange={(event) => {
                  edit(row.key, 'label', event.target.value);
                }}
                {...(labelError ? { error: labelError } : {})}
              />
              <TextField
                id={fieldId(row.key, 'value')}
                label={t('exercises.setup.valueField', { n })}
                value={row.value}
                maxLength={SETUP_LIMITS.maxValue}
                autoComplete="off"
                onChange={(event) => {
                  edit(row.key, 'value', event.target.value);
                }}
                {...(valueError ? { error: valueError } : {})}
              />
              <IconButton
                icon="trash"
                label={t('exercises.setup.remove', { n })}
                onClick={() => {
                  setErrors([]);
                  setRows((current) => current.filter((r) => r.key !== row.key));
                }}
              />
            </li>
          );
        })}
      </ul>
      <div className={styles.buttons}>
        <Button
          variant="secondary"
          disabled={rows.length >= SETUP_LIMITS.maxItems}
          onClick={() => {
            setRows((current) => [...current, newRow()]);
          }}
        >
          {t('exercises.setup.addRow')}
        </Button>
      </div>
      <div className={styles.buttons}>
        <Button disabled={saving} onClick={() => void save()}>
          {t('exercises.setup.save')}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={onCancel}>
          {t('exercises.setup.cancel')}
        </Button>
      </div>
    </div>
  );
}
