import { useId } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import styles from './Segmented.module.css';
import hidden from './VisuallyHidden.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

interface SegmentedProps<T extends string> {
  /** Name of the group, read by screen readers. */
  legend: string;
  hideLegend?: boolean;
  disabled?: boolean;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/**
 * One choice out of a few (theme, language, period). Native radio buttons underneath, so arrow
 * keys, focus and screen readers work as in any radio group.
 */
export function Segmented<T extends string>({
  legend,
  hideLegend = false,
  disabled = false,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset className={styles.fieldset}>
      <legend className={hideLegend ? hidden.hidden : styles.legend}>{legend}</legend>
      <div className={styles.track}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cx(styles.option, checked && styles.checked, disabled && styles.disabled)}
            >
              <input
                className={styles.input}
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  onChange(option.value);
                }}
              />
              {option.icon && <Icon name={option.icon} size={18} />}
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
