import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stat, StatGrid } from './Stat';

describe('Stat', () => {
  it('pairs each label with its value inside a description list', () => {
    const { container } = render(
      <StatGrid>
        <Stat label="Volumen" value="1.200" />
        <Stat label="Series efectivas" value={12} />
      </StatGrid>,
    );
    expect(container.querySelector('dl')).not.toBeNull();
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Volumen',
      'Series efectivas',
    ]);
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual([
      '1.200',
      '12',
    ]);
  });

  it('shows the note under the value when there is one', () => {
    render(
      <StatGrid>
        <Stat label="Semana" value="45" note="2–8 nov" />
        <Stat label="Sesiones" value="3" />
      </StatGrid>,
    );
    expect(screen.getByText('2–8 nov')).toBeInTheDocument();
    // A tile without a note has just its value: one definition.
    expect(screen.getAllByRole('definition')).toHaveLength(3);
  });

  it('keeps a zero as a value', () => {
    render(
      <StatGrid>
        <Stat label="Series" value={0} />
      </StatGrid>,
    );
    expect(screen.getByRole('definition')).toHaveTextContent('0');
  });
});
