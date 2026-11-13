import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DIAGNOSTICS_LOG_STORAGE_KEY,
  DIAGNOSTICS_STORAGE_KEY,
  readDiagnosticsEnabled,
  readMeasurements,
  recordMeasurement,
  type DiagnosticMetric,
} from '../../data/diagnostics';
import { renderWithProviders } from '../../test/render';
import { DiagnosticsCard } from './DiagnosticsCard';

const SWITCH = 'Medir el rendimiento';
const EMPTY = 'Todavía no hay mediciones. Activa el interruptor y usa la app con normalidad.';
const COPY = 'Copiar mediciones';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(options: Parameters<typeof renderWithProviders>[1] = {}) {
  renderWithProviders(<DiagnosticsCard />, options);
  return userEvent.setup();
}

function measure(metric: DiagnosticMetric, ...values: number[]) {
  values.forEach((ms, at) => recordMeasurement(localStorage, metric, ms, 1_800_000_000_000 + at));
}

/**
 * Replaces the clipboard. Call it after `setup()`: user-event installs its own clipboard stub
 * when it starts, which would hide this one.
 */
function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('TestAgent/1.0');
}

describe('DiagnosticsCard', () => {
  it('is off on a new device, with nothing to copy or clear', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Diagnóstico', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: SWITCH })).not.toBeChecked();
    expect(screen.getByText(EMPTY)).toBeInTheDocument();
    expect(screen.getByText(/menos de 300 ms va bien; más de 1 s es un problema/)).toBeVisible();
    expect(screen.getByRole('button', { name: COPY })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Borrar mediciones' })).toBeDisabled();
    expect(screen.queryByRole('list', { name: 'Mediciones' })).not.toBeInTheDocument();
  });

  it('saves the switch on this device only', async () => {
    const user = setup();
    await user.click(screen.getByRole('switch', { name: SWITCH }));
    expect(screen.getByRole('switch', { name: SWITCH })).toBeChecked();
    expect(localStorage.getItem(DIAGNOSTICS_STORAGE_KEY)).toBe('on');
    await user.click(screen.getByRole('switch', { name: SWITCH }));
    expect(readDiagnosticsEnabled(localStorage)).toBe(false);
  });

  it('remembers the switch the next time it opens', () => {
    localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, 'on');
    setup();
    expect(screen.getByRole('switch', { name: SWITCH })).toBeChecked();
  });

  it('lists each measurement that has data, in order, with its rating written out', () => {
    measure('progressLoad', 1500, 1600, 1700);
    measure('dbOpen', 50);
    measure('setVisible', 250, 350);
    setup();

    const items = within(screen.getByRole('list', { name: 'Mediciones' })).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Apertura de la base de datos');
    expect(items[0]).toHaveTextContent('Bien');
    expect(items[0]).toHaveTextContent('Última: 50 ms · Mediana: 50 ms · Máx.: 50 ms · 1 medición');
    expect(items[1]).toHaveTextContent('De ✓ a serie visible');
    expect(items[1]).toHaveTextContent('Aceptable');
    expect(items[1]).toHaveTextContent(
      'Última: 350 ms · Mediana: 300 ms · Máx.: 350 ms · 2 mediciones',
    );
    expect(items[2]).toHaveTextContent('Carga de Progreso');
    expect(items[2]).toHaveTextContent('Problema');
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    expect(screen.queryByText('Carga de Hoy')).not.toBeInTheDocument();
  });

  it('uses the decimal comma in Spanish', () => {
    measure('todayLoad', 120.5);
    setup();
    expect(screen.getByRole('listitem')).toHaveTextContent('Última: 120,5 ms');
  });

  it('is translated to English, with the decimal point', () => {
    measure('todayLoad', 120.5);
    setup({ locale: 'en' });
    expect(screen.getByRole('heading', { name: 'Diagnostics' })).toBeInTheDocument();
    const item = screen.getByRole('listitem');
    expect(item).toHaveTextContent('Loading Today');
    expect(item).toHaveTextContent('Good');
    expect(item).toHaveTextContent(
      'Last: 120.5 ms · Median: 120.5 ms · Max: 120.5 ms · 1 measurement',
    );
  });

  it('keeps the measurements when the switch is turned off', async () => {
    localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, 'on');
    measure('todayLoad', 100);
    const user = setup();
    await user.click(screen.getByRole('switch', { name: SWITCH }));
    expect(screen.getByRole('listitem')).toHaveTextContent('Carga de Hoy');
    expect(screen.getByRole('button', { name: COPY })).toBeEnabled();
  });

  it('copies the measurements with the app version and tells the user', async () => {
    measure('todayLoad', 100, 200);
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    const user = setup();
    stubClipboard(writeText);
    await user.click(screen.getByRole('button', { name: COPY }));

    expect(await screen.findByText('Mediciones copiadas')).toBeVisible();
    expect(writeText).toHaveBeenCalledOnce();
    const copied = JSON.parse(writeText.mock.calls[0]?.[0] ?? '') as {
      app: string;
      version: string;
      userAgent: string;
      measurements: Record<string, { ms: number }[]>;
    };
    expect(copied.app).toBe('Certavi');
    expect(copied.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(copied.userAgent).toBe('TestAgent/1.0');
    expect(copied.measurements.todayLoad?.map((entry) => entry.ms)).toEqual([100, 200]);
    expect(copied.measurements.dbOpen).toEqual([]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the text to copy by hand when the clipboard says no', async () => {
    measure('dbOpen', 80);
    const user = setup();
    stubClipboard(() => Promise.reject(new Error('denied')));
    await user.click(screen.getByRole('button', { name: COPY }));

    expect(
      await screen.findByText('No se pudo copiar. Selecciona el texto de abajo y cópialo a mano.'),
    ).toBeVisible();
    const box = screen.getByRole('textbox', { name: 'Texto de las mediciones' });
    expect(box).toHaveAttribute('readonly');
    expect((JSON.parse((box as HTMLTextAreaElement).value) as { app: string }).app).toBe('Certavi');
    expect(screen.queryByText('Mediciones copiadas')).not.toBeInTheDocument();
  });

  it('shows the same text when the browser has no clipboard', async () => {
    measure('dbOpen', 80);
    const user = setup();
    stubClipboard(undefined);
    await user.click(screen.getByRole('button', { name: COPY }));
    expect(await screen.findByRole('textbox', { name: 'Texto de las mediciones' })).toBeVisible();
  });

  it('clears the measurements and keeps the switch', async () => {
    localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, 'on');
    measure('dbOpen', 80);
    const user = setup();
    stubClipboard(() => Promise.reject(new Error('denied')));
    await user.click(screen.getByRole('button', { name: COPY }));
    await screen.findByRole('textbox', { name: 'Texto de las mediciones' });

    await user.click(screen.getByRole('button', { name: 'Borrar mediciones' }));
    expect(screen.getByText(EMPTY)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: COPY })).toBeDisabled();
    expect(screen.getByRole('switch', { name: SWITCH })).toBeChecked();
    expect(localStorage.getItem(DIAGNOSTICS_LOG_STORAGE_KEY)).toBeNull();
    expect(readMeasurements(localStorage).dbOpen).toEqual([]);
  });

  it('works when the browser blocks local storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = setup();
    expect(screen.getByText(EMPTY)).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: SWITCH }));
    expect(screen.getByText(EMPTY)).toBeInTheDocument();
  });
});
