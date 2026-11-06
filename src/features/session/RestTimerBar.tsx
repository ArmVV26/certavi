import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { VisuallyHidden } from '../../ui/VisuallyHidden';
import { formatClock } from './formatClock';
import styles from './RestTimerBar.module.css';
import type { RestTimer } from './useRestTimer';

interface RestTimerBarProps {
  timer: RestTimer;
  /** Name of the exercise of the next empty row, if there is one. */
  nextName: string | null;
  onAdjust: (delta: number) => void;
  onClose: () => void;
}

/** The bar fixed above the navigation bar while resting. */
export function RestTimerBar({ timer, nextName, onAdjust, onClose }: RestTimerBarProps) {
  const { t } = useTranslation();
  const { remaining, total, finished } = timer;
  const progress = finished || total <= 0 ? 1 : 1 - remaining / total;
  return (
    <section className={styles.bar} aria-label={t('session.rest.title')}>
      <div className={styles.top}>
        <div className={styles.text}>
          <p className={styles.title}>{t('session.rest.title')}</p>
          <p className={finished ? styles.done : styles.next}>
            {finished
              ? t('session.rest.go')
              : nextName
                ? t('session.rest.next', { name: nextName })
                : ''}
          </p>
        </div>
        <p className={styles.clock} aria-hidden="true">
          {formatClock(remaining)}
        </p>
        <IconButton icon="close" label={t('session.rest.close')} onClick={onClose} />
      </div>
      <div className={styles.track} aria-hidden="true">
        <div
          className={finished ? styles.fillDone : styles.fill}
          style={{ width: `${String(Math.round(progress * 100))}%` }}
        />
      </div>
      <div className={styles.buttons}>
        <Button
          variant="secondary"
          onClick={() => {
            onAdjust(-15);
          }}
        >
          {t('session.rest.minus')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            onAdjust(15);
          }}
        >
          {t('session.rest.plus')}
        </Button>
      </div>
      <div role="status">
        <VisuallyHidden>
          {finished
            ? t('session.rest.go')
            : t('session.rest.started', { time: formatClock(total) })}
        </VisuallyHidden>
      </div>
    </section>
  );
}
