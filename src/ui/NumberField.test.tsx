import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { NumberField } from './NumberField';

interface HarnessProps {
  initial?: number | null;
  onValue?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: number;
  stepper?: boolean;
  error?: string;
}

/** Controlled usage, as a screen would do. Shows the current value for assertions. */
function Harness({ initial = null, onValue, ...props }: HarnessProps) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <NumberField
        label="Peso"
        unit="kg"
        hint="Acepta coma decimal"
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
        {...props}
      />
      <output>{value === null ? 'null' : String(value)}</output>
    </>
  );
}

const input = () => screen.getByRole('textbox', { name: 'Peso (kg)' });
const current = () => screen.getByRole('status').textContent;

describe('NumberField', () => {
  it('is labelled with its unit, opens the decimal keyboard and has a hint', () => {
    renderWithProviders(<Harness />);
    expect(input()).toHaveAttribute('inputmode', 'decimal');
    expect(input()).toHaveAccessibleDescription('Acepta coma decimal');
  });

  it('accepts a decimal comma', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.type(input(), '27,5');
    expect(current()).toBe('27.5');
    await user.tab();
    expect(input()).toHaveValue('27,5');
  });

  it('accepts a decimal point and shows it with a comma in Spanish', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.type(input(), '22.5');
    await user.tab();
    expect(current()).toBe('22.5');
    expect(input()).toHaveValue('22,5');
  });

  it('shows a point in English', () => {
    renderWithProviders(<Harness initial={27.5} />, { locale: 'en' });
    expect(screen.getByRole('textbox', { name: 'Peso (kg)' })).toHaveValue('27.5');
  });

  it('treats 0 as a real value, not as empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.type(input(), '0');
    await user.tab();
    expect(current()).toBe('0');
    expect(input()).toHaveValue('0');
  });

  it('becomes null when cleared', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={30} />);
    await user.clear(input());
    expect(current()).toBe('null');
  });

  it('ignores letters and a second separator', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.type(input(), '2a5,,5');
    expect(input()).toHaveValue('25,5');
    expect(current()).toBe('25.5');
  });

  it('keeps an incomplete number while typing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.type(input(), '27,');
    expect(input()).toHaveValue('27,');
    expect(current()).toBe('27');
  });

  it('clamps to min / max when leaving the field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness min={0} max={300} />);
    await user.type(input(), '450');
    await user.tab();
    expect(current()).toBe('300');
    expect(input()).toHaveValue('300');
  });

  it('rejects a minus sign when the minimum is 0', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness min={0} />);
    await user.type(input(), '-5');
    expect(input()).toHaveValue('5');
  });

  it('shows the suggested value as a placeholder', () => {
    renderWithProviders(<Harness placeholder={27.5} />);
    expect(input()).toHaveAttribute('placeholder', '27,5');
  });

  it('steps from the suggested value with −/+ and stops at the limits', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    renderWithProviders(
      <Harness stepper step={2.5} min={0} placeholder={27.5} onValue={onValue} />,
    );

    await user.click(screen.getByRole('button', { name: 'Aumentar Peso' }));
    expect(current()).toBe('30');
    expect(input()).toHaveValue('30');

    await user.click(screen.getByRole('button', { name: 'Disminuir Peso' }));
    await user.click(screen.getByRole('button', { name: 'Disminuir Peso' }));
    expect(current()).toBe('25');
    expect(onValue).toHaveBeenLastCalledWith(25);
  });

  it('disables − at the minimum', () => {
    renderWithProviders(<Harness stepper min={0} initial={0} />);
    expect(screen.getByRole('button', { name: 'Disminuir Peso' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aumentar Peso' })).toBeEnabled();
  });

  it('shows an error and marks the field invalid', () => {
    renderWithProviders(<Harness error="Pon un peso" />);
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(input()).toHaveAccessibleDescription('Acepta coma decimal Pon un peso');
  });

  it('shows a value set from outside', async () => {
    const user = userEvent.setup();
    function Outside() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <>
          <NumberField label="Peso" value={value} onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue(42.5);
            }}
          >
            set
          </button>
        </>
      );
    }
    renderWithProviders(<Outside />);
    await user.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByRole('textbox', { name: 'Peso' })).toHaveValue('42,5');
  });
});
