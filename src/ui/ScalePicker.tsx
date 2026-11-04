import { useId } from 'react';
import { cx } from './cx';
import styles from './ScalePicker.module.css';

interface ScalePickerProps {
  /** Name of the group, e.g. "Dolor al bajar escaleras". */
  label: string;
  /** null = no value yet. */
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  /** Values above it are drawn as a warning (pain > 3/10). */
  warnAbove?: number;
}

/**
 * A value on a short scale (0–10 pain, 1–5 readiness): one toggle button per value. Tapping the
 * chosen value again clears it.
 */
export function ScalePicker({ label, value, onChange, min, max, warnAbove }: ScalePickerProps) {
  const labelId = useId();
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className={styles.field}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className={styles.scale}>
        {values.map((n) => {
          const pressed = n === value;
          const warn = warnAbove !== undefined && n > warnAbove;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={pressed}
              className={cx(styles.value, warn && styles.warn, pressed && styles.pressed)}
              onClick={() => {
                onChange(pressed ? null : n);
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
