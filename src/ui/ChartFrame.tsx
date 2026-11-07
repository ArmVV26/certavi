import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Chart.module.css';
import { cx } from './cx';

export type LegendKind = 'bar' | 'met' | 'mark' | 'line';

const SWATCH: Readonly<Record<LegendKind, string>> = {
  bar: styles.legendBar ?? '',
  met: styles.legendMet ?? '',
  mark: styles.legendMark ?? '',
  line: styles.legendLine ?? '',
};

export interface LegendItem {
  label: string;
  kind: LegendKind;
}

export interface ChartTable {
  /** What the table shows; read by screen readers. */
  caption: string;
  head: readonly string[];
  rows: readonly (readonly string[])[];
}

interface ChartFrameProps {
  children: ReactNode;
  legend?: readonly LegendItem[];
  /** The exact values as a table, behind a "Show data" disclosure: the text equivalent of the chart. */
  table?: ChartTable;
}

/** The chart, its legend and its text equivalent. The chart itself describes itself (`role="img"`). */
export function ChartFrame({ children, legend, table }: ChartFrameProps) {
  const { t } = useTranslation();
  return (
    <figure className={styles.figure}>
      {children}
      {legend && (
        <ul className={styles.legend}>
          {legend.map((item) => (
            <li key={item.label}>
              <i className={cx(styles.swatch, SWATCH[item.kind])} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      {table && (
        <details className={styles.data}>
          <summary>{t('ui.chart.showData')}</summary>
          {/* The table scrolls when it is long: keyboard users must be able to reach it (axe). */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div className={styles.tableWrap} role="region" aria-label={table.caption} tabIndex={0}>
            <table className={styles.table}>
              <caption className={styles.caption}>{table.caption}</caption>
              <thead>
                <tr>
                  {table.head.map((cell) => (
                    <th key={cell} scope="col">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, column) =>
                      column === 0 ? (
                        <th key={column} scope="row">
                          {cell}
                        </th>
                      ) : (
                        <td key={column}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
