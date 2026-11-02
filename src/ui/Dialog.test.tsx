import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { ConfirmDialog } from './ConfirmDialog';
import { Dialog } from './Dialog';
import { Sheet } from './Sheet';

function DialogDemo({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Abrir
      </button>
      <button type="button">Fuera</button>
      <Dialog
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Detalle"
        description="Texto del diálogo"
        actions={<button type="button">Aceptar</button>}
      >
        <input aria-label="Nota" />
      </Dialog>
    </>
  );
}

async function openDialog() {
  const user = userEvent.setup();
  renderWithProviders(<DialogDemo />);
  await user.click(screen.getByRole('button', { name: 'Abrir' }));
  return user;
}

describe('Dialog', () => {
  it('is a named, described modal dialog', async () => {
    await openDialog();
    const dialog = screen.getByRole('dialog', { name: 'Detalle' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Texto del diálogo');
  });

  it('moves focus inside when it opens', async () => {
    await openDialog();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
  });

  it('traps focus: Tab and Shift+Tab cycle inside the dialog', async () => {
    const user = await openDialog();
    const close = screen.getByRole('button', { name: 'Cerrar' });
    const note = screen.getByRole('textbox', { name: 'Nota' });
    const accept = screen.getByRole('button', { name: 'Aceptar' });

    await user.tab();
    expect(note).toHaveFocus();
    await user.tab();
    expect(accept).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(accept).toHaveFocus();
  });

  it('makes the rest of the page inert', async () => {
    await openDialog();
    const layer = screen.getByRole('dialog').closest('[data-modal-layer]');
    for (const child of document.body.children) {
      if (child === layer) expect(child).not.toHaveAttribute('inert');
      else expect(child).toHaveAttribute('inert');
    }
  });

  it('closes with Escape and returns focus to the opener', async () => {
    const user = await openDialog();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
    for (const child of document.body.children) expect(child).not.toHaveAttribute('inert');
  });

  it('closes with the close button and with a tap outside', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DialogDemo onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const backdrop = document.querySelector('[data-modal-layer] > [aria-hidden="true"]');
    if (!(backdrop instanceof HTMLElement)) throw new Error('backdrop not found');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('locks page scroll while open', async () => {
    const user = await openDialog();
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });
});

function ConfirmDemo({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Quitar serie
      </button>
      <ConfirmDialog
        open={open}
        title="¿Quitar esta serie?"
        message="Se quitará de esta sesión."
        confirmLabel="Quitar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
        onCancel={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('is an alert dialog that starts on Cancel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfirmDemo onConfirm={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Quitar serie' }));

    const dialog = screen.getByRole('alertdialog', { name: '¿Quitar esta serie?' });
    expect(dialog).toHaveAccessibleDescription('Se quitará de esta sesión.');
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(within(dialog).queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
  });

  it('pressing Enter right away cancels instead of confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(<ConfirmDemo onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Quitar serie' }));
    await user.keyboard('{Enter}');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('confirms with the confirm button', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(<ConfirmDemo onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Quitar serie' }));
    await user.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cancels with Escape', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(<ConfirmDemo onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Quitar serie' }));
    await user.keyboard('{Escape}');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

function SheetDemo() {
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSheet(true);
        }}
      >
        Añadir ejercicio
      </button>
      <Sheet
        open={sheet}
        onClose={() => {
          setSheet(false);
        }}
        title="Catálogo"
      >
        <button
          type="button"
          onClick={() => {
            setConfirm(true);
          }}
        >
          Borrar filtro
        </button>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title="¿Borrar?"
        confirmLabel="Borrar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          setConfirm(false);
        }}
        onCancel={() => {
          setConfirm(false);
        }}
      />
    </>
  );
}

describe('Sheet', () => {
  it('opens as a named modal dialog and closes with Escape', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheetDemo />);
    await user.click(screen.getByRole('button', { name: 'Añadir ejercicio' }));

    expect(screen.getByRole('dialog', { name: 'Catálogo' })).toHaveAttribute('aria-modal', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir ejercicio' })).toHaveFocus();
  });

  it('with a dialog on top, Escape closes only the top one', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SheetDemo />);
    await user.click(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    await user.click(screen.getByRole('button', { name: 'Borrar filtro' }));
    expect(screen.getByRole('alertdialog', { name: '¿Borrar?' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Catálogo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrar filtro' })).toHaveFocus();
  });
});
