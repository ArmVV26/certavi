import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { BarRows } from './BarRows';
import { ChartFrame } from './ChartFrame';
import { ColumnChart } from './ColumnChart';
import { LineChart } from './LineChart';

const kg = (value: number) => `${String(value)} kg`;

describe('LineChart', () => {
  it('is an image with a description and one titled point per record', () => {
    const { container } = renderWithProviders(
      <LineChart
        description="Peso corporal: 2 puntos"
        formatY={kg}
        points={[
          { x: 0, y: 82, name: '2 nov: 82 kg', xLabel: '2 nov' },
          { x: 7, y: 81, name: '9 nov: 81 kg', xLabel: '9 nov' },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Peso corporal: 2 puntos' })).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(container.querySelectorAll('title')).toHaveLength(2);
    expect(container.querySelector('path')).not.toBeNull();
    expect(screen.getByText('2 nov')).toBeInTheDocument();
    expect(screen.getByText('9 nov')).toBeInTheDocument();
  });

  it('draws a single point without a line and labels it once', () => {
    const { container } = renderWithProviders(
      <LineChart
        description="Un punto"
        formatY={kg}
        points={[{ x: 5, y: 80, name: '5 nov: 80 kg', xLabel: '5 nov' }]}
      />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(1);
    expect(container.querySelector('path')).toBeNull();
    expect(screen.getAllByText('5 nov')).toHaveLength(1);
  });

  it('draws a reference line and uses a fixed range when given one', () => {
    const { container } = renderWithProviders(
      <LineChart
        description="Escala"
        formatY={String}
        points={[{ x: 0, y: 4, name: 'a' }]}
        reference={{ value: 3 }}
        yRange={{ min: 0, max: 10, step: 2 }}
      />,
    );
    // Grid lines for 0, 2, 4, 6, 8, 10 plus the dashed reference line.
    expect(container.querySelectorAll('line')).toHaveLength(7);
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});

describe('ColumnChart', () => {
  it('draws a titled column with its plan mark; empty weeks have no column', () => {
    const { container } = renderWithProviders(
      <ColumnChart
        description="Series por semana"
        formatY={String}
        columns={[
          { label: '2/11', value: 98, target: 107, name: '2–8 nov: 98 de 107 series' },
          { label: '9/11', value: 0, target: null, name: '9–15 nov: 0 series' },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Series por semana' })).toBeInTheDocument();
    expect(container.querySelectorAll('rect')).toHaveLength(1);
    // The plan mark is the only line besides the grid.
    expect(container.querySelectorAll('line[class*="target"]')).toHaveLength(1);
    expect(container.querySelectorAll('title')).toHaveLength(2);
    expect(screen.getByText('9/11')).toBeInTheDocument();
  });

  it('copes with no columns', () => {
    const { container } = renderWithProviders(
      <ColumnChart description="Nada" formatY={String} columns={[]} />,
    );
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });
});

describe('chart width', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A layout engine for jsdom: every element is `width` wide. (Spies are restored by Vitest.) */
  function layOutAt(width: number) {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  }

  it('draws on a 360-wide canvas when there is no layout (tests, old engines)', () => {
    const { container } = renderWithProviders(
      <ColumnChart description="Sin medir" formatY={String} columns={[]} />,
    );
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 360 180');
  });

  it.each([
    ['LineChart', 700],
    ['ColumnChart', 310],
  ])('%s draws on a canvas as wide as its container (%i px)', (kind, width) => {
    layOutAt(width);
    const { container } = renderWithProviders(
      kind === 'LineChart' ? (
        <LineChart description="Medido" formatY={String} points={[{ x: 0, y: 1, name: 'a' }]} />
      ) : (
        <ColumnChart description="Medido" formatY={String} columns={[]} />
      ),
    );
    // One unit is one pixel: the 12 px axis text keeps its size on any screen.
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', `0 0 ${String(width)} 180`);
  });

  it('never goes below 200 px', () => {
    layOutAt(80);
    const { container } = renderWithProviders(
      <ColumnChart description="Estrecho" formatY={String} columns={[]} />,
    );
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 200 180');
  });
});

describe('BarRows', () => {
  it('names each row in text and marks the rows that met the plan', () => {
    const { container } = renderWithProviders(
      <BarRows
        rows={[
          {
            key: 'chest',
            label: 'Pecho',
            value: 12,
            target: 16,
            valueText: '12 / 16',
            name: 'Pecho: 12 de 16 series',
          },
          {
            key: 'back',
            label: 'Espalda',
            value: 16,
            target: 16,
            valueText: '16 / 16',
            name: 'Espalda: 16 de 16 series, plan cumplido',
          },
          {
            key: 'core',
            label: 'Core',
            value: 0,
            target: 0,
            valueText: '0 / 0',
            name: 'Core: 0 de 0 series',
          },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Pecho: 12 de 16 series')).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="fillMet"]')).toHaveLength(1);
    // A mark for the two rows that have a plan.
    expect(container.querySelectorAll('[class*="targetMark"]')).toHaveLength(2);
  });

  const row = (key: string, value: number, target: number, remainingText?: string) => ({
    key,
    label: key,
    value,
    target,
    valueText: `${String(value)} / ${String(target)}`,
    ...(remainingText && { remainingText }),
    name: `${key}: ${String(value)} de ${String(target)} series`,
  });

  it('puts what is missing after the numbers, for the narrow layout', () => {
    renderWithProviders(
      <BarRows
        rows={[row('Pecho', 8, 12, 'faltan 4'), row('Espalda', 14, 14, '✓'), row('Core', 0, 0)]}
      />,
    );
    expect(screen.getByText('8 / 12')).toHaveTextContent('8 / 12 · faltan 4');
    expect(screen.getByText('14 / 14')).toHaveTextContent('14 / 14 · ✓');
    expect(screen.getByText('0 / 0')).toHaveTextContent(/^0 \/ 0$/);
  });

  const geometry = (item: HTMLElement) =>
    ['--value', '--target', '--span', '--scale'].map((name) => item.style.getPropertyValue(name));

  it('sets the cells of each row (its plan or its sets, if more) on one shared scale', () => {
    const { container } = renderWithProviders(
      <BarRows rows={[row('Pecho', 8, 12), row('Triceps', 6, 6), row('Hombro', 9, 7)]} />,
    );
    const items = [...container.querySelectorAll<HTMLElement>('li')];
    // value, plan, cells of the row, scale: the scale is the biggest row, so every row has the
    // same cell width and a row with half the sets has half the bar.
    expect(items.map(geometry)).toEqual([
      ['8', '12', '12', '12'],
      ['6', '6', '6', '12'],
      ['9', '7', '9', '12'],
    ]);
    expect(container.querySelectorAll('[data-cells]')).toHaveLength(3);
  });

  it('keeps a continuous bar when there are too many sets for cells', () => {
    const { container } = renderWithProviders(<BarRows rows={[row('Pecho', 20, 31)]} />);
    expect(container.querySelector('[data-cells]')).toBeNull();
  });

  it('draws the sets beyond the plan apart, only for rows that went over it', () => {
    const { container } = renderWithProviders(
      <BarRows rows={[row('Pecho', 15, 12), row('Espalda', 12, 12), row('Core', 3, 0)]} />,
    );
    // Only Pecho went over its plan; its extra part is drawn from the plan to the value.
    const extra = container.querySelectorAll('[class*="fillExtra"]');
    expect(extra).toHaveLength(1);
    expect(extra[0]?.closest('li')?.style.getPropertyValue('--target')).toBe('12');
    expect(extra[0]?.closest('li')?.style.getPropertyValue('--value')).toBe('15');
  });
});

describe('ChartFrame', () => {
  it('shows the legend and gives the values as a table behind "Ver datos"', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ChartFrame
        legend={[
          { label: 'Series hechas', kind: 'bar' },
          { label: 'Plan cumplido', kind: 'met' },
          { label: 'Plan', kind: 'mark' },
          { label: 'Tendencia', kind: 'line' },
        ]}
        table={{
          caption: 'Peso corporal',
          head: ['Semana', 'Peso'],
          rows: [
            ['2 nov', '82 kg'],
            ['9 nov', '81 kg'],
          ],
        }}
      >
        <svg role="img" aria-label="gráfica" />
      </ChartFrame>,
    );
    expect(screen.getByRole('img', { name: 'gráfica' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);

    await user.click(screen.getByText('Ver datos'));
    const table = screen.getByRole('table', { name: 'Peso corporal' });
    expect(within(table).getByRole('rowheader', { name: '9 nov' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '81 kg' })).toBeInTheDocument();
  });

  it('is just the chart without legend or table', () => {
    renderWithProviders(
      <ChartFrame>
        <svg role="img" aria-label="sola" />
      </ChartFrame>,
    );
    expect(screen.getByRole('img', { name: 'sola' })).toBeInTheDocument();
    expect(screen.queryByText('Ver datos')).toBeNull();
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});
