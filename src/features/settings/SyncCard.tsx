import { useId, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { hasSyncKey } from '../../data/sync/engine';
import { useSyncEngine, useSyncState } from '../../data/sync/SyncContext';
import { isValidKey, normalizeKey } from '../../data/sync/syncKey';
import { formatDate, formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { cx } from '../../ui/cx';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/ToastContext';
import styles from './SyncCard.module.css';
import { errorKeyOf, syncLabelOf } from './syncText';

/** What the card is doing with the key: showing it, being asked for a new one, or confirming. */
type CardMode = 'view' | 'changingKey' | 'confirmingForget';

/** Settings card: sync state, the key, "Sync now" and the link to the log and backups. */
export function SyncCard() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const engine = useSyncEngine();
  const state = useSyncState();
  const toast = useToast();
  const [mode, setMode] = useState<CardMode>('view');
  const label = syncLabelOf(state);
  const keySaved = hasSyncKey(state);
  // Without a key the form is always there, whatever the mode says; "Cancel" only makes sense
  // when there is a saved key to go back to.
  const changingKey = keySaved && mode === 'changingKey';
  const showForm = !keySaved || changingKey;

  async function syncNow() {
    const result = await engine.syncNow();
    if (result.status === 'idle')
      toast.show({ message: t('settings.sync.synced'), tone: 'success' });
    else if (result.status === 'error' || result.status === 'offline') {
      toast.show({ message: t(errorKeyOf(result.error ?? 'network')), tone: 'danger' });
    }
  }

  function forget() {
    setMode('view');
    engine.forgetKey();
    toast.show({ message: t('settings.sync.keyForgotten') });
  }

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('settings.sync.title')}</h2>
      <p className={styles.muted}>{t('settings.sync.intro')}</p>
      <dl className={styles.list} aria-label={t('settings.sync.listLabel')}>
        <div className={styles.row}>
          <dt>{t('settings.sync.status')}</dt>
          <dd className={cx(styles.value, label === 'error' && styles.danger)}>
            {t(`sync.status.${label}`)}
          </dd>
        </div>
        <div className={styles.row}>
          <dt>{t('settings.sync.lastSync')}</dt>
          <dd className={styles.value}>
            {state.lastSuccessAt === null
              ? t('settings.sync.never')
              : formatDate(new Date(state.lastSuccessAt), locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
          </dd>
        </div>
        <div className={styles.row}>
          <dt>{t('settings.sync.pending')}</dt>
          <dd className={cx(styles.value, styles.number)}>{formatNumber(state.pending, locale)}</dd>
        </div>
      </dl>
      {state.status === 'error' && (
        <p className={styles.error}>
          <Icon name="warning" size={20} />
          <span>{t(errorKeyOf(state.error))}</span>
        </p>
      )}

      {showForm ? (
        <KeyForm
          onSaved={() => {
            setMode('view');
          }}
          {...(changingKey
            ? {
                onCancel: () => {
                  setMode('view');
                },
              }
            : {})}
        />
      ) : (
        <>
          <p className={styles.muted}>{t('settings.sync.keySaved')}</p>
          <div className={styles.actions}>
            <Button
              icon="refresh"
              disabled={state.status === 'syncing'}
              onClick={() => {
                void syncNow();
              }}
            >
              {t('settings.sync.syncNow')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setMode('changingKey');
              }}
            >
              {t('settings.sync.changeKey')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setMode('confirmingForget');
              }}
            >
              {t('settings.sync.forgetKey')}
            </Button>
          </div>
        </>
      )}

      <Link to="/settings/sync" className={styles.link}>
        <span>{t('settings.sync.details')}</span>
        <Icon name="chevronRight" size={20} />
      </Link>

      <ConfirmDialog
        open={keySaved && mode === 'confirmingForget'}
        title={t('settings.sync.forgetTitle')}
        message={t('settings.sync.forgetMessage')}
        confirmLabel={t('settings.sync.forgetConfirm')}
        cancelLabel={t('settings.sync.cancel')}
        destructive
        onConfirm={forget}
        onCancel={() => {
          setMode('view');
        }}
      />
    </Card>
  );
}

interface KeyFormProps {
  onSaved: () => void;
  /** Shown when changing a saved key. */
  onCancel?: () => void;
}

function KeyForm({ onSaved, onCancel }: KeyFormProps) {
  const { t } = useTranslation();
  const engine = useSyncEngine();
  const toast = useToast();
  const id = useId();
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!isValidKey(normalizeKey(value))) {
      setError(t('settings.sync.keyTooShort'));
      return;
    }
    setSaving(true);
    try {
      const result = await engine.setKey(value);
      if (result === 'storage-error') {
        setError(t('settings.sync.keyNotSaved'));
        return;
      }
      setValue('');
      setError(null);
      toast.show({ message: t('settings.sync.keySavedToast'), tone: 'success' });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <label htmlFor={id} className={styles.label}>
        {t('settings.sync.keyLabel')}
      </label>
      <div className={cx(styles.inputWrap, error !== null && styles.invalid)}>
        <input
          id={id}
          className={styles.input}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={error === null ? hintId : `${errorId} ${hintId}`}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
        />
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={visible}
          aria-label={t('settings.sync.showKey')}
          title={t('settings.sync.showKey')}
          onClick={() => {
            setVisible((v) => !v);
          }}
        >
          <Icon name="eye" size={22} />
        </button>
      </div>
      {error !== null && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
      <p id={hintId} className={styles.hint}>
        {t('settings.sync.keyHint')}
      </p>
      <div className={styles.actions}>
        <Button type="submit" disabled={saving}>
          {t('settings.sync.saveKey')}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {t('settings.sync.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
