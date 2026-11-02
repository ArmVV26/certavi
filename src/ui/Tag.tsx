import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Tag.module.css';

export type TagTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'warmup';

interface TagProps {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
}

/** Static label: equipment, "New", "Does not count", the warm-up symbol… Not interactive. */
export function Tag({ tone = 'neutral', children, className }: TagProps) {
  return <span className={cx(styles.tag, styles[tone], className)}>{children}</span>;
}
