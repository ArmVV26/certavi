import type { ComponentPropsWithRef } from 'react';
import { buttonClasses } from './buttonClasses';
import type { ButtonLook } from './buttonClasses';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface ButtonProps extends ComponentPropsWithRef<'button'>, ButtonLook {
  /** Optional leading icon (decorative). */
  icon?: IconName;
}

export function Button({
  variant,
  size,
  fullWidth,
  icon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClasses({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={20} />}
      <span>{children}</span>
    </button>
  );
}
