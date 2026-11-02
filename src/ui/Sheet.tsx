import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { IconButton } from './IconButton';
import styles from './Sheet.module.css';
import { useModal } from './useModal';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Panel that slides up from the bottom (pickers, filters). Same modal behaviour as Dialog. */
export function Sheet(props: SheetProps) {
  return props.open ? <SheetLayer {...props} /> : null;
}

function SheetLayer({ onClose, title, children }: SheetProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal({ containerRef: panelRef, onClose });

  return createPortal(
    <div className={styles.layer} data-modal-layer="">
      <div className={styles.backdrop} aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <IconButton icon="close" label={t('ui.close')} onClick={onClose} />
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
