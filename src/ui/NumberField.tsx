import { useId, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber, isPartialDecimal, parseDecimal, roundTo } from '../i18n/format';
import { toLocale } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { cx } from './cx';
import { IconButton } from './IconButton';
import styles from './NumberField.module.css';
import { VisuallyHidden } from './VisuallyHidden';

interface NumberFieldProps {
  label: string;
  /** null = empty. 0 is a real value (bodyweight exercises, empty machine). */
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  maxFractionDigits?: number;
  /** Shown after the number ("kg") and read with the label. */
  unit?: string;
  /** Suggested value shown in grey (e.g. last time). Also the starting point for −/+. */
  placeholder?: number;
  /** Show −/+ buttons. */
  stepper?: boolean;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  id?: string;
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

/**
 * Number input for weights, reps, RIR and minutes. Accepts a decimal comma or point, shows the
 * value in the active language's format, and opens the numeric keyboard on phones.
 */
export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  maxFractionDigits = 2,
  unit,
  placeholder,
  stepper = false,
  hint,
  error,
  hideLabel = false,
  disabled = false,
  id,
}: NumberFieldProps) {
  const { t, i18n } = useTranslation();
  const locale = toLocale(i18n.language);
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const format = (number: number | null, inLocale: Locale) =>
    number === null
      ? ''
      : formatNumber(number, inLocale, {
          maximumFractionDigits: maxFractionDigits,
          useGrouping: false,
        });

  // The text being typed. It may be incomplete ("27,") while `value` already holds 27.
  const [draft, setDraft] = useState(() => format(value, locale));
  const [synced, setSynced] = useState({ value, locale });
  if (synced.value !== value || synced.locale !== locale) {
    // The value changed from outside (or the language did): show it, unless it is what is typed.
    setSynced({ value, locale });
    if (synced.locale !== locale || value !== parseDecimal(draft)) {
      setDraft(format(value, locale));
    }
  }

  const allowNegative = min === undefined || min < 0;

  const commit = (next: number | null) => {
    if (next !== value) onChange(next);
    setDraft(format(next, locale));
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    if (!isPartialDecimal(text, allowNegative)) return;
    setDraft(text);
    const parsed = parseDecimal(text);
    if (parsed !== value) onChange(parsed);
  };

  const handleBlur = () => {
    const parsed = parseDecimal(draft);
    commit(parsed === null ? null : clamp(roundTo(parsed, maxFractionDigits), min, max));
  };

  const nudge = (direction: 1 | -1) => {
    const base = value ?? placeholder ?? 0;
    commit(clamp(roundTo(base + direction * step, maxFractionDigits), min, max));
  };

  const current = value ?? placeholder ?? 0;
  const describedBy = cx(hint && hintId, error && errorId) || undefined;

  const labelContent = (
    <>
      {label}
      {unit && (
        <>
          {' '}
          <VisuallyHidden>({unit})</VisuallyHidden>
        </>
      )}
    </>
  );

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={hideLabel ? undefined : styles.label}>
        {hideLabel ? <VisuallyHidden>{labelContent}</VisuallyHidden> : labelContent}
      </label>
      <div className={styles.control}>
        {stepper && (
          <IconButton
            icon="minus"
            variant="filled"
            label={t('ui.decrease', { label })}
            disabled={disabled || (min !== undefined && current <= min)}
            onClick={() => {
              nudge(-1);
            }}
          />
        )}
        <div className={cx(styles.inputWrap, error && styles.invalid)}>
          <input
            id={inputId}
            className={styles.input}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            value={draft}
            placeholder={placeholder === undefined ? undefined : format(placeholder, locale)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          {unit && (
            <span className={styles.unit} aria-hidden="true">
              {unit}
            </span>
          )}
        </div>
        {stepper && (
          <IconButton
            icon="plus"
            variant="filled"
            label={t('ui.increase', { label })}
            disabled={disabled || (max !== undefined && current >= max)}
            onClick={() => {
              nudge(1);
            }}
          />
        )}
      </div>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
