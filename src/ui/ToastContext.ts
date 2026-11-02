import { createContext, useContext } from 'react';

export type ToastTone = 'neutral' | 'success' | 'danger';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** One action, typically "Undo". Clicking it also closes the toast. */
  action?: { label: string; onAction: () => void };
  /** Default: 4 s, or 6 s when there is an action. */
  durationMs?: number;
}

export interface ToastApi {
  /** Shows a toast and returns its id. */
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return value;
}
