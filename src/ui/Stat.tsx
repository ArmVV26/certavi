import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Stat.module.css';

/** Two columns of `Stat` tiles. It is a description list: each tile is a label with its value. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className={styles.grid}>{children}</dl>;
}

interface StatProps {
  label: string;
  value: ReactNode;
  /** A line of explanation under the value. */
  note?: ReactNode;
  /** Takes the whole row of the grid. */
  wide?: boolean;
  /** A tinted tile without border, for tiles inside a card. */
  filled?: boolean;
}

/** A label with its figure: the same look and alignment on every screen. Goes inside a `StatGrid`. */
export function Stat({ label, value, note, wide, filled }: StatProps) {
  return (
    <div className={cx(styles.stat, wide && styles.wide, filled && styles.filled)}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
      {note !== undefined && <dd className={styles.note}>{note}</dd>}
    </div>
  );
}
