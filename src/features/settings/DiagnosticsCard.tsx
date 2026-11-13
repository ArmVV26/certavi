import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '../../app/appInfo';
import { getLocalStorage } from '../../data/deviceStorage';
import {
  DIAGNOSTIC_METRICS,
  clearMeasurements,
  formatMeasurements,
  hasMeasurements,
  rateDuration,
  readDiagnosticsEnabled,
  readMeasurements,
  summarize,
  writeDiagnosticsEnabled,
  type Rating,
} from '../../data/diagnostics';
import { formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Switch } from '../../ui/Switch';
import { Tag, type TagTone } from '../../ui/Tag';
import { useToast } from '../../ui/ToastContext';
import styles from './DiagnosticsCard.module.css';
import settingsStyles from './SettingsPage.module.css';

const RATING_TONE: Record<Rating, TagTone> = {
  good: 'success',
  fair: 'warning',
  problem: 'danger',
};

/** Where copying the measurements stands; `failed` keeps the text so it can be copied by hand. */
type CopyState = { kind: 'idle' } | { kind: 'copying' } | { kind: 'failed'; text: string };

/**
 * Settings → Diagnostics: the switch for the performance timers (this device only), the last
 * measurements of each one and a button to copy them (docs/spec/diagnostics.md).
 */
export function DiagnosticsCard() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const toast = useToast();
  const storage = useMemo(() => getLocalStorage(window), []);
  const [enabled, setEnabled] = useState(() => readDiagnosticsEnabled(storage));
  const [log, setLog] = useState(() => readMeasurements(storage));
  const [copy, setCopy] = useState<CopyState>({ kind: 'idle' });
  const any = hasMeasurements(log);

  const copyAll = async () => {
    setCopy({ kind: 'copying' });
    const text = formatMeasurements(readMeasurements(storage), {
      version: APP_VERSION,
      now: Date.now(),
      userAgent: navigator.userAgent,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopy({ kind: 'idle' });
      toast.show({ message: t('settings.diagnostics.copied'), tone: 'success' });
    } catch {
      // No clipboard, or the browser said no: show the text so it can be selected by hand.
      setCopy({ kind: 'failed', text });
    }
  };

  const clearAll = () => {
    clearMeasurements(storage);
    setLog(readMeasurements(storage));
    setCopy({ kind: 'idle' });
  };

  return (
    <Card element="section">
      <h2 className={settingsStyles.heading}>{t('settings.diagnostics.title')}</h2>
      <Switch
        label={t('settings.diagnostics.switch')}
        description={t('settings.diagnostics.switchHint')}
        checked={enabled}
        onChange={(next) => {
          setEnabled(next);
          writeDiagnosticsEnabled(storage, next);
        }}
      />
      <p className={styles.note}>{t('settings.diagnostics.reference')}</p>

      {any ? (
        <ul className={styles.list} aria-label={t('settings.diagnostics.listLabel')}>
          {DIAGNOSTIC_METRICS.map((metric) => {
            const summary = summarize(log[metric]);
            if (!summary) return null;
            const number = (value: number) =>
              formatNumber(value, locale, { maximumFractionDigits: 1 });
            return (
              <li key={metric} className={styles.item}>
                <div className={styles.head}>
                  <span className={styles.name}>{t(`settings.diagnostics.metrics.${metric}`)}</span>
                  <Tag tone={RATING_TONE[rateDuration(summary.median)]}>
                    {t(`settings.diagnostics.ratings.${rateDuration(summary.median)}`)}
                  </Tag>
                </div>
                <p className={styles.summary}>
                  {t('settings.diagnostics.summary', {
                    count: summary.count,
                    last: number(summary.last),
                    median: number(summary.median),
                    max: number(summary.max),
                  })}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.note}>{t('settings.diagnostics.empty')}</p>
      )}

      <div className={styles.actions}>
        <Button
          variant="secondary"
          disabled={!any || copy.kind === 'copying'}
          onClick={() => {
            void copyAll();
          }}
        >
          {t('settings.diagnostics.copy')}
        </Button>
        <Button variant="secondary" icon="trash" disabled={!any} onClick={clearAll}>
          {t('settings.diagnostics.clear')}
        </Button>
      </div>
      <CopyFallback state={copy} />
    </Card>
  );
}

function CopyFallback({ state }: { state: CopyState }) {
  const { t } = useTranslation();
  switch (state.kind) {
    case 'idle':
    case 'copying':
      return null;
    case 'failed':
      return (
        <>
          <p className={styles.error} role="alert">
            {t('settings.diagnostics.copyFailed')}
          </p>
          <textarea
            className={styles.text}
            readOnly
            rows={8}
            aria-label={t('settings.diagnostics.copyText')}
            value={state.text}
            onFocus={(event) => {
              event.currentTarget.select();
            }}
          />
        </>
      );
  }
}
