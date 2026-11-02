import styles from './Button.module.css';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonLook {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  fullWidth?: boolean;
}

/** Button look for other elements, e.g. a router <Link> that should look like a button. */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}: ButtonLook = {}) {
  return cx(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth);
}
