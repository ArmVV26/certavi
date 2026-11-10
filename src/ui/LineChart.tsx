import { linearScale, niceTicks } from './chartScale';
import styles from './Chart.module.css';
import { useChartWidth } from './useChartWidth';

export interface LinePoint {
  /** Position on the horizontal axis (e.g. days since some date). Points are drawn in this order. */
  x: number;
  y: number;
  /** Text equivalent of the point; also its tooltip. */
  name: string;
  /** Label under the axis; only the first and the last point's are shown. */
  xLabel?: string;
}

interface LineChartProps {
  points: readonly LinePoint[];
  /** What the chart shows, read by screen readers. */
  description: string;
  formatY: (value: number) => string;
  height?: number;
  /** A dashed horizontal line (a threshold), always inside the range. */
  reference?: { value: number };
  /** Fixed vertical range with its tick step, e.g. 0–10 every 2 for a scale. */
  yRange?: { min: number; max: number; step: number };
}

const MARGIN = { top: 10, right: 14, bottom: 24, left: 44 };

function fixedTicks({ min, max, step }: { min: number; max: number; step: number }) {
  const values: number[] = [];
  for (let value = min; value <= max + 1e-9; value += step) values.push(value);
  return { values, min, max };
}

/** A line with one point per record. Hand-written SVG; colours come from the theme tokens. */
export function LineChart({
  points,
  description,
  formatY,
  height = 180,
  reference,
  yRange,
}: LineChartProps) {
  const [svgRef, width] = useChartWidth();
  const values = points.map((p) => p.y);
  if (reference) values.push(reference.value);
  const ticks = yRange ? fixedTicks(yRange) : niceTicks(Math.min(...values), Math.max(...values));
  const tickValues = ticks.values;

  const xs = points.map((p) => p.x);
  const x = linearScale(Math.min(...xs), Math.max(...xs), MARGIN.left, width - MARGIN.right);
  const y = linearScale(ticks.min, ticks.max, height - MARGIN.bottom, MARGIN.top);
  const first = points[0];
  const last = points.at(-1);
  const path = points.map(
    (p, i) => `${i === 0 ? 'M' : 'L'}${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`,
  );

  return (
    <svg
      ref={svgRef}
      className={styles.svg}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      role="img"
      aria-label={description}
    >
      {tickValues.map((value) => (
        <g key={value}>
          <line
            className={styles.grid}
            x1={MARGIN.left}
            x2={width - MARGIN.right}
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
      {reference && (
        <line
          className={styles.reference}
          x1={MARGIN.left}
          x2={width - MARGIN.right}
          y1={y(reference.value)}
          y2={y(reference.value)}
        />
      )}
      {points.length > 1 && <path className={styles.line} d={path.join(' ')} />}
      {points.map((p) => (
        <circle
          key={`${String(p.x)}-${p.name}`}
          className={styles.point}
          cx={x(p.x)}
          cy={y(p.y)}
          r={4}
        >
          <title>{p.name}</title>
        </circle>
      ))}
      {first?.xLabel && (
        <text
          className={styles.tick}
          x={x(first.x)}
          y={height - 6}
          textAnchor={points.length > 1 ? 'start' : 'middle'}
        >
          {first.xLabel}
        </text>
      )}
      {last?.xLabel && points.length > 1 && (
        <text className={styles.tick} x={x(last.x)} y={height - 6} textAnchor="end">
          {last.xLabel}
        </text>
      )}
    </svg>
  );
}
