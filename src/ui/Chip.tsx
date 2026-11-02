import type { ComponentPropsWithRef } from 'react';
import styles from './Chip.module.css';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface ChipProps extends ComponentPropsWithRef<'button'> {
  /** Toggle chips (filters) pass true/false; it is announced as pressed / not pressed. */
  selected?: boolean;
  icon?: IconName;
}

/** Small pill button: filters, quick actions ("+ Serie"). */
export function Chip({ selected, icon, className, type = 'button', children, ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(styles.chip, selected && styles.selected, className)}
      {...rest}
    >
      {selected ? (
        <Icon name="check" size={16} strokeWidth={2.5} />
      ) : (
        icon && <Icon name={icon} size={16} />
      )}
      {children}
    </button>
  );
}
