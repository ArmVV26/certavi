import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { ToastContext } from './ToastContext';
import type { ToastApi, ToastOptions } from './ToastContext';
import styles from './Toast.module.css';

interface ToastItem extends ToastOptions {
  id: string;
}

const MAX_VISIBLE = 3;
const DEFAULT_MS = 4000;
const WITH_ACTION_MS = 6000;

/** Short messages at the bottom ("Saved", "Set removed · Undo"), announced politely. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    const id = `toast-${String(nextId.current)}`;
    setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { ...options, id }]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext value={api}>
      {children}
      <section className={styles.viewport} aria-label={t('ui.notifications')}>
        <ol className={styles.list} aria-live="polite">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismiss} closeLabel={t('ui.close')} />
          ))}
        </ol>
      </section>
    </ToastContext>
  );
}

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  closeLabel: string;
}

function Toast({ toast, onDismiss, closeLabel }: ToastProps) {
  const { id, message, tone = 'neutral', action, durationMs } = toast;

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        onDismiss(id);
      },
      durationMs ?? (action ? WITH_ACTION_MS : DEFAULT_MS),
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [id, durationMs, action, onDismiss]);

  return (
    <li className={cx(styles.toast, styles[tone])}>
      <Icon name={tone === 'success' ? 'check' : 'info'} size={20} className={styles.icon} />
      <p className={styles.message}>{message}</p>
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            action.onAction();
            onDismiss(id);
          }}
        >
          {action.label}
        </button>
      )}
      <IconButton
        icon="close"
        label={closeLabel}
        className={styles.close}
        onClick={() => {
          onDismiss(id);
        }}
      />
    </li>
  );
}
