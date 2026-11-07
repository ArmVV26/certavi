import styles from './Chart.module.css';
import { cx } from './cx';
import { VisuallyHidden } from './VisuallyHidden';

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Planned value: drawn as a mark; the bar turns "met" when the value reaches it. */
  target: number;
  /** The numbers as shown next to the bar, e.g. "12 / 16". */
  valueText: string;
  /** Text equivalent of the row, read by screen readers instead of the visible texts. */
  name: string;
}

interface BarRowsProps {
  rows: readonly BarRow[];
}

/** One horizontal bar per row, all on the same scale, with a mark at each row's plan. */
export function BarRows({ rows }: BarRowsProps) {
  const scale = Math.max(1, ...rows.flatMap((row) => [row.value, row.target]));
  const percent = (value: number) => `${String((value / scale) * 100)}%`;
  return (
    <ul className={styles.rows}>
      {rows.map((row) => {
        const met = row.target > 0 && row.value >= row.target;
        return (
          <li key={row.key} className={styles.row}>
            <span aria-hidden="true" className={styles.rowLabel}>
              {row.label}
            </span>
            <span aria-hidden="true" className={styles.track}>
              <span
                className={cx(styles.fill, met && styles.fillMet)}
                style={{ width: percent(row.value) }}
              />
              {row.target > 0 && (
                <span className={styles.targetMark} style={{ left: percent(row.target) }} />
              )}
            </span>
            <span aria-hidden="true" className={styles.rowValue}>
              {row.valueText}
            </span>
            <VisuallyHidden>{row.name}</VisuallyHidden>
          </li>
        );
      })}
    </ul>
  );
}
