import type { CSSProperties } from 'react';
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
  /** What is missing, shown after the numbers on narrow screens only, e.g. "faltan 4" or "✓". */
  remainingText?: string;
  /** Text equivalent of the row, read by screen readers instead of the visible texts. */
  name: string;
}

interface BarRowsProps {
  rows: readonly BarRow[];
}

/**
 * Up to this many units on the scale, a narrow screen draws one cell per unit; above it the bar
 * stays continuous (the cells would be too thin to tell apart).
 */
export const MAX_CELLS = 30;

/**
 * One horizontal bar per row, all on the same scale, with a mark at each row's plan. On a narrow
 * card (a phone) each row takes two lines and its bar, as long as the row's plan (or its sets, if
 * more), is cut into one cell per set; every row uses the same cell width.
 *
 * The geometry is CSS (Chart.module.css), from four numbers set on each row: `--value`, `--target`,
 * `--span` (the bigger of the two: the cells of the row) and `--scale` (the biggest span of all).
 */
export function BarRows({ rows }: BarRowsProps) {
  const spanOf = (row: BarRow) => Math.max(row.value, row.target);
  const scale = Math.max(1, ...rows.map(spanOf));
  const cells = scale <= MAX_CELLS;
  return (
    <ul className={styles.rows}>
      {rows.map((row) => {
        const met = row.target > 0 && row.value >= row.target;
        const extra = row.target > 0 && row.value > row.target;
        const geometry = {
          '--value': row.value,
          '--target': row.target,
          '--span': spanOf(row),
          '--scale': scale,
        } as CSSProperties;
        return (
          <li key={row.key} className={styles.row} style={geometry}>
            <span aria-hidden="true" className={styles.rowLabel}>
              {row.label}
            </span>
            <span aria-hidden="true" className={styles.track} data-cells={cells ? '' : undefined}>
              <span className={cx(styles.fill, met && styles.fillMet)} />
              {/* Narrow screens only: the sets beyond the plan, in another tone over the bar. */}
              {extra && <span className={styles.fillExtra} />}
              {row.target > 0 && <span className={styles.targetMark} />}
            </span>
            <span aria-hidden="true" className={styles.rowValue}>
              {row.valueText}
              {row.remainingText && (
                <span className={styles.rowRemaining}> · {row.remainingText}</span>
              )}
            </span>
            <VisuallyHidden>{row.name}</VisuallyHidden>
          </li>
        );
      })}
    </ul>
  );
}
