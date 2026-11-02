import { useId } from 'react';
import styles from './Switch.module.css';

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
}

/** On/off setting. A native checkbox with role="switch": Space toggles it, readers say on/off. */
export function Switch({ label, checked, onChange, description, disabled = false }: SwitchProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <label className={styles.row}>
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
      <span className={styles.control}>
        <input
          className={styles.input}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-describedby={description ? descriptionId : undefined}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
      </span>
    </label>
  );
}
