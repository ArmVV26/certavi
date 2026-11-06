import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import styles from './Notice.module.css';

interface NoticeProps {
  tone?: 'info' | 'warning';
  children: ReactNode;
}

/** A message at the top of a screen ("no sync key yet", "time for a deload"). Not a toast. */
export function Notice({ tone = 'info', children }: NoticeProps) {
  return (
    <div className={cx(styles.notice, styles[tone])}>
      <Icon name={tone === 'warning' ? 'warning' : 'info'} size={20} />
      <div className={styles.text}>{children}</div>
    </div>
  );
}
