import { useId } from 'react';
import { cx } from './cx';
import styles from './SelectField.module.css';
import { VisuallyHidden } from './VisuallyHidden';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Keeps the label for assistive technology only (dense rows). */
  hideLabel?: boolean;
  /** Smaller text and padding, for dense rows. */
  compact?: boolean;
  disabled?: boolean;
  id?: string;
}

/** A native select with its label. The browser's own picker is the best one on a phone. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  hideLabel = false,
  compact = false,
  disabled = false,
  id,
}: SelectFieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={cx(styles.field, compact && styles.compact)}>
      <label htmlFor={selectId} className={hideLabel ? undefined : styles.label}>
        {hideLabel ? <VisuallyHidden>{label}</VisuallyHidden> : label}
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
