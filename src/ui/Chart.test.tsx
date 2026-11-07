import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
