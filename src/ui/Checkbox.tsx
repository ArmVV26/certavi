import { useId } from 'react';
import styles from './Checkbox.module.css';
import { Icon } from './Icon';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Second line, e.g. the dose of a mobility exercise. */
  description?: string;
  disabled?: boolean;
}

/** Checklist item: a native checkbox (Space toggles it) with a large tap area. */
export function Checkbox({
  label,
  checked,
  onChange,
  description,
  disabled = false,
}: CheckboxProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <label className={styles.row}>
      <span className={styles.control}>
        <input
          className={styles.input}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-describedby={description ? descriptionId : undefined}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        <span className={styles.box} aria-hidden="true">
          {checked && <Icon name="check" size={18} strokeWidth={3} />}
        </span>
      </span>
      <span className={styles.text}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {description && (
          <span id={descriptionId} className={styles.description}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
