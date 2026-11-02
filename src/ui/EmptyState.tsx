import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: IconName;
  /** A button or link to the next useful step. */
  action?: ReactNode;
  headingLevel?: 2 | 3;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  headingLevel = 2,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={styles.empty}>
      {icon && (
        <span className={styles.icon}>
          <Icon name={icon} size={32} />
        </span>
      )}
      <Heading className={styles.title}>{title}</Heading>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
