import { useTranslation } from 'react-i18next';
import { useToast } from '../../ui/ToastContext';

/** Runs a write; on failure shows a toast and resolves to false. */
export function useSave() {
  const { t } = useTranslation();
  const toast = useToast();
  return async (write: () => Promise<unknown>, success?: string): Promise<boolean> => {
    try {
      await write();
      if (success) toast.show({ message: success, tone: 'success' });
      return true;
    } catch (error: unknown) {
      console.error('Could not save', error);
      toast.show({ message: t('today.saveError'), tone: 'danger' });
      return false;
    }
  };
}
