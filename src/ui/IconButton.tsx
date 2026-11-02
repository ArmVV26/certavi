import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import styles from './IconButton.module.css';

interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: IconName;
  /** Accessible name (also shown as a tooltip). Required: the icon alone says nothing. */
  label: string;
  variant?: 'ghost' | 'filled' | 'danger';
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(styles.iconButton, styles[variant], className)}
      {...rest}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}
