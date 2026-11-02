import type { ReactNode } from 'react';
import styles from './Card.module.css';
import { cx } from './cx';

interface CardProps {
  children: ReactNode;
  /** Use 'section' or 'article' when the card has its own heading. */
  element?: 'div' | 'section' | 'article';
  className?: string;
}

export function Card({ children, element: Element = 'div', className }: CardProps) {
  return <Element className={cx(styles.card, className)}>{children}</Element>;
}
