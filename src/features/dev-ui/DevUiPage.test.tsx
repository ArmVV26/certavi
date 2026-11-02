import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/renderApp';

describe('DevUiPage', () => {
  it('shows every component section', () => {
    renderApp('/dev/ui');
    for (const name of [
      'Botones',
      'Botones de icono',
      'Chips y etiquetas',
      'Tarjeta',
      'Campos numéricos',
      'Selector segmentado',
      'Interruptor',
      'Diálogo',
      'Hoja inferior',
      'Avisos',
      'Estado vacío',
      'Fechas y números',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
  });

  it('shows the localized warm-up symbol', () => {
    renderApp('/dev/ui');
    expect(screen.getByTitle('Calentamiento')).toHaveTextContent('C');
  });

  it('remove → confirm → toast with Undo → restored', async () => {
    const user = userEvent.setup();
    renderApp('/dev/ui');

    await user.click(screen.getByRole('button', { name: 'Quitar serie…' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Quitar esta serie?' });
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Serie quitada')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByText('Serie recuperada')).toBeInTheDocument();
  });

  it('number field shows its value in the active language', async () => {
    const user = userEvent.setup();
    renderApp('/dev/ui');

    await user.type(screen.getByRole('textbox', { name: 'Peso (kg)' }), '0');
    expect(screen.getByText('Valor: 0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aumentar Peso' }));
    expect(screen.getByText('Valor: 2,5')).toBeInTheDocument();
  });
});
