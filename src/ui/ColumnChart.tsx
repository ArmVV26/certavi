import { linearScale, niceTicks } from './chartScale';
import styles from './Chart.module.css';

export interface Column {
  /** Short label under the column. */
  label: string;
  value: number;
  /** The planned value, drawn as a mark across the column; null/absent = no plan. */
  target?: number | null;
  /** Text equivalent of the column; also its tooltip. */
  name: string;
}

interface ColumnChartProps {
  columns: readonly Column[];
  /** What the chart shows, read by screen readers. */
  description: string;
  formatY: (value: number) => string;
  height?: number;
}

const WIDTH = 360;
const MARGIN = { top: 10, right: 8, bottom: 24, left: 36 };

/** Columns from zero with an optional plan mark on each. Hand-written SVG. */
export function ColumnChart({ columns, description, formatY, height = 180 }: ColumnChartProps) {
  const top = Math.max(0, ...columns.flatMap((c) => [c.value, c.target ?? 0]));
  const ticks = niceTicks(0, top);
  const y = linearScale(0, ticks.max, height - MARGIN.bottom, MARGIN.top);
  const slot = (WIDTH - MARGIN.left - MARGIN.right) / Math.max(columns.length, 1);
  const barWidth = Math.min(slot * 0.62, 28);

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${String(WIDTH)} ${String(height)}`}
      role="img"
      aria-label={description}
    >
      {ticks.values.map((value) => (
        <g key={value}>
          <line
            className={styles.grid}
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={y(value)}
            y2={y(value)}
          />
          <text
            className={styles.tick}
            x={MARGIN.left - 6}
            y={y(value)}
            textAnchor="end"
            dy="0.32em"
          >
            {formatY(value)}
          </text>
        </g>
      ))}
      {columns.map((column, index) => {
        const center = MARGIN.left + slot * (index + 0.5);
        const barTop = y(column.value);
        return (
          <g key={`${column.label}-${String(index)}`}>
            <title>{column.name}</title>
            {column.value > 0 && (
              <rect
                className={styles.column}
                x={center - barWidth / 2}
                y={barTop}
                width={barWidth}
                height={Math.max(y(0) - barTop, 0)}
                rx={3}
              />
            )}
            {column.target != null && column.target > 0 && (
              <line
                className={styles.target}
                x1={center - barWidth / 2 - 2}
                x2={center + barWidth / 2 + 2}
                y1={y(column.target)}
                y2={y(column.target)}
              />
            )}
            <text className={styles.tick} x={center} y={height - 6} textAnchor="middle">
              {column.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
