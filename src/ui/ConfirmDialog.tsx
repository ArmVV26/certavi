import { useRef } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** Also called on Escape. */
  onCancel: () => void;
  /** Red confirm button for deletions. */
  destructive?: boolean;
}

/**
 * "Are you sure?" dialog. Focus starts on Cancel, so an accidental Enter never deletes anything.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      role="alertdialog"
      dismissible={false}
      initialFocusRef={cancelRef}
      actions={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
