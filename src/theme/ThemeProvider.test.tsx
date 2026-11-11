import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setSystemDark } from '../test/matchMedia';
import { useTheme } from './ThemeContext';
import { ThemeProvider } from './ThemeProvider';
import { MONO_STORAGE_KEY, THEME_COLOR, THEME_COLOR_MONO, THEME_STORAGE_KEY } from './theme';

// Test-only probe; its texts are not user-facing, so they do not go through i18n.
function Probe() {
  const { preference, resolved, cyclePreference, setPreference, setMono } = useTheme();
  return (
    <div>
      <p>preference: {preference}</p>
      <p>resolved: {resolved}</p>
      <button
        type="button"
        onClick={() => {
          setMono(true);
        }}
      >
        mono on
      </button>
      <button
        type="button"
        onClick={() => {
          setMono(false);
        }}
      >
        mono off
      </button>
      <button type="button" onClick={cyclePreference}>
        cycle
      </button>
      <button
        type="button"
        onClick={() => {
          setPreference('dark');
        }}
      >
        force dark
      </button>
    </div>
  );
}

function renderWithTheme() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

const htmlTheme = () => document.documentElement.dataset.theme;

describe('ThemeProvider', () => {
  it('follows the system theme by default', () => {
    setSystemDark(true);
    renderWithTheme();

    expect(screen.getByText('preference: system')).toBeInTheDocument();
    expect(screen.getByText('resolved: dark')).toBeInTheDocument();
    expect(htmlTheme()).toBe('dark');
  });

  it('updates live when the system theme changes', () => {
    renderWithTheme();
    expect(htmlTheme()).toBe('light');

    act(() => {
      setSystemDark(true);
    });

    expect(screen.getByText('resolved: dark')).toBeInTheDocument();
    expect(htmlTheme()).toBe('dark');
  });

  it('cycles automatic → light → dark → automatic and saves each choice', async () => {
    const user = userEvent.setup();
    setSystemDark(true);
    renderWithTheme();
    const cycle = screen.getByRole('button', { name: 'cycle' });

    await user.click(cycle);
    expect(screen.getByText('preference: light')).toBeInTheDocument();
    expect(htmlTheme()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    await user.click(cycle);
    expect(screen.getByText('preference: dark')).toBeInTheDocument();
    expect(htmlTheme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(cycle);
    expect(screen.getByText('preference: system')).toBeInTheDocument();
    expect(htmlTheme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('keeps a forced theme when the system changes', async () => {
    const user = userEvent.setup();
    renderWithTheme();

    await user.click(screen.getByRole('button', { name: 'force dark' }));
    act(() => {
      setSystemDark(true);
    });
    act(() => {
      setSystemDark(false);
    });

    expect(htmlTheme()).toBe('dark');
  });

  it('restores the saved preference on start (reload)', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderWithTheme();

    expect(screen.getByText('preference: dark')).toBeInTheDocument();
    expect(htmlTheme()).toBe('dark');
  });

  it('turns the no-colour mode on and off without touching the theme, and keeps it', async () => {
    const user = userEvent.setup();
    setSystemDark(true);
    renderWithTheme();
    expect(document.documentElement).not.toHaveAttribute('data-mono');

    await user.click(screen.getByRole('button', { name: 'mono on' }));
    expect(document.documentElement).toHaveAttribute('data-mono');
    expect(htmlTheme()).toBe('dark');
    expect(localStorage.getItem(MONO_STORAGE_KEY)).toBe('on');
    const meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    expect(meta?.content).toBe(THEME_COLOR_MONO.dark);

    await user.click(screen.getByRole('button', { name: 'cycle' }));
    expect(htmlTheme()).toBe('light');
    expect(document.documentElement).toHaveAttribute('data-mono');

    await user.click(screen.getByRole('button', { name: 'mono off' }));
    expect(document.documentElement).not.toHaveAttribute('data-mono');
    expect(localStorage.getItem(MONO_STORAGE_KEY)).toBe('off');
  });

  it('restores the no-colour mode on start (reload)', () => {
    localStorage.setItem(MONO_STORAGE_KEY, 'on');
    renderWithTheme();
    expect(document.documentElement).toHaveAttribute('data-mono');
  });

  it('sets theme-color to the active background', () => {
    setSystemDark(true);
    renderWithTheme();

    const meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    expect(meta?.content).toBe(THEME_COLOR.dark);
  });

  it('throws a clear error when used outside the provider', () => {
    // React logs the thrown error; that noise is expected here (restored by restoreMocks).
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow('useTheme must be used inside <ThemeProvider>');
  });
});
