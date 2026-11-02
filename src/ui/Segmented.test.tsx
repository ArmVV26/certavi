import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Segmented } from './Segmented';
import { Switch } from './Switch';

type Range = 'week' | 'last' | 'avg';

function RangePicker({ hideLegend = false }: { hideLegend?: boolean }) {
  const [value, setValue] = useState<Range>('week');
  return (
    <Segmented
      legend="Periodo"
      hideLegend={hideLegend}
      value={value}
      onChange={setValue}
      options={[
        { value: 'week', label: 'Esta semana' },
        { value: 'last', label: 'Pasada' },
        { value: 'avg', label: 'Media' },
      ]}
    />
  );
}

describe('Segmented', () => {
  it('is a named radio group with one option checked', () => {
    render(<RangePicker />);
    expect(screen.getByRole('group', { name: 'Periodo' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Esta semana' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Pasada' })).not.toBeChecked();
  });

  it('changes on click', async () => {
    const user = userEvent.setup();
    render(<RangePicker />);
    await user.click(screen.getByText('Pasada'));
    expect(screen.getByRole('radio', { name: 'Pasada' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Esta semana' })).not.toBeChecked();
  });

  it('changes with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<RangePicker />);
    await user.click(screen.getByRole('radio', { name: 'Esta semana' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Pasada' })).toBeChecked();
  });

  it('keeps the group name for screen readers when the legend is hidden', () => {
    render(<RangePicker hideLegend />);
    expect(screen.getByRole('group', { name: 'Periodo' })).toBeInTheDocument();
  });
});

function SoundSwitch() {
  const [on, setOn] = useState(true);
  return (
    <Switch label="Sonido" description="Al acabar el descanso" checked={on} onChange={setOn} />
  );
}

describe('Switch', () => {
  it('is a named switch with a description', () => {
    render(<SoundSwitch />);
    const control = screen.getByRole('switch', { name: 'Sonido' });
    expect(control).toBeChecked();
    expect(control).toHaveAccessibleDescription('Al acabar el descanso');
  });

  it('toggles by click on the label and with Space', async () => {
    const user = userEvent.setup();
    render(<SoundSwitch />);
    const control = screen.getByRole('switch');

    await user.click(screen.getByText('Sonido'));
    expect(control).not.toBeChecked();

    control.focus();
    await user.keyboard(' ');
    expect(control).toBeChecked();
  });
});
