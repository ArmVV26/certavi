import { useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './Dialog.module.css';
import { IconButton } from './IconButton';
import { useModal } from './useModal';

export interface DialogProps {
  open: boolean;
  /** Called on Escape, the close button and a tap outside (when dismissible). */
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Buttons at the bottom (e.g. Cancel / Confirm). */
  actions?: ReactNode;
  /** 'alertdialog' for confirmations that interrupt the user. */
  role?: 'dialog' | 'alertdialog';
  /** Show the close button and close on a tap outside. Escape always closes. */
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/** Accessible modal dialog. Replaces window.confirm / alert / prompt (banned by ESLint). */
export function Dialog(props: DialogProps) {
  return props.open ? <DialogLayer {...props} /> : null;
}

function DialogLayer({
  onClose,
  title,
  description,
  children,
  actions,
  role = 'dialog',
  dismissible = true,
  initialFocusRef,
}: DialogProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useModal({ containerRef: panelRef, onClose, initialFocusRef });

  return createPortal(
    <div className={styles.layer} data-modal-layer="">
      <div
        className={styles.backdrop}
        aria-hidden="true"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panelRef}
        className={styles.panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {dismissible && <IconButton icon="close" label={t('ui.close')} onClick={onClose} />}
        </div>
        {description && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
        {children && <div className={styles.body}>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}
