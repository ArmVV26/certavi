import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';
import { Notice } from './Notice';
import { ScalePicker } from './ScalePicker';
import { TextArea, TextField } from './TextField';

function Pain() {
  const [value, setValue] = useState<number | null>(null);
  return (
    <ScalePicker label="Dolor" min={0} max={10} warnAbove={3} value={value} onChange={setValue} />
  );
}

describe('ScalePicker', () => {
  it('is a named group of toggle buttons; tapping the chosen value clears it', async () => {
    const user = userEvent.setup();
    render(<Pain />);
    const group = screen.getByRole('group', { name: 'Dolor' });
    expect(group.querySelectorAll('button')).toHaveLength(11);

    await user.click(screen.getByRole('button', { name: '4' }));
    expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: '4' }));
    expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
  });

  it('works without a warning threshold', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ScalePicker label="Cómo llegas" min={1} max={5} value={2} onChange={onChange} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: '5' }));
    expect(onChange).toHaveBeenCalledWith(5);
  });
});

describe('Checkbox', () => {
  it('is named by its label and described by its second line', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox label="Rodillo" description="2 × 30 s" checked={false} onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Rodillo' });
    expect(box).toHaveAccessibleDescription('2 × 30 s');
    await user.click(screen.getByText('2 × 30 s'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('can be checked and disabled, without a description', () => {
    render(<Checkbox label="Pogos" checked disabled onChange={vi.fn()} />);
    const box = screen.getByRole('checkbox', { name: 'Pogos' });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(box).not.toHaveAttribute('aria-describedby');
  });
});

describe('TextField and TextArea', () => {
  it('labels the input and links its hint and error', () => {
    render(<TextField label="Fecha" type="date" hint="Hoy" error="No" defaultValue="2026-11-02" />);
    const input = screen.getByLabelText('Fecha');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Hoy No');
  });

  it('has no description or invalid state when there is none', () => {
    render(<TextField label="Nota" id="note" />);
    const input = screen.getByLabelText('Nota');
    expect(input).toHaveAttribute('id', 'note');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('renders a multi-line field', async () => {
    const user = userEvent.setup();
    render(<TextArea label="Nota del día" />);
    const area = screen.getByLabelText('Nota del día');
    expect(area.tagName).toBe('TEXTAREA');
    await user.type(area, 'Bien');
    expect(area).toHaveValue('Bien');
  });
});

describe('Notice', () => {
  it('shows its content with an info or warning look', () => {
    const { rerender } = render(<Notice>Sin clave</Notice>);
    expect(screen.getByText('Sin clave')).toBeInTheDocument();
    rerender(<Notice tone="warning">Descarga</Notice>);
    expect(screen.getByText('Descarga')).toBeInTheDocument();
  });
});
