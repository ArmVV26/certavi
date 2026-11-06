import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../../data/DatabaseContext';
import { getLocalStorage } from '../../data/deviceStorage';
import {
  readRestAlerts,
  readRestTimes,
  saveRestTimes,
  writeRestAlerts,
  type RestTimes,
} from '../../data/restSettings';
import { Card } from '../../ui/Card';
import { NumberField } from '../../ui/NumberField';
import { Switch } from '../../ui/Switch';
import styles from './SettingsPage.module.css';

const MIN_REST = 15;
const MAX_REST = 900;
const REST_STEP = 15;

/** Settings of the rest timer: the two rest times (synced) and sound and vibration (this device). */
export function RestCard() {
  const { t } = useTranslation();
  const db = useDatabase();
  const stored = useLiveQuery(() => readRestTimes(db), [db]);

  return (
    <Card element="section">
      <h2 className={styles.heading}>{t('settings.rest.title')}</h2>
      {stored && <Times stored={stored} />}
      <Alerts />
    </Card>
  );
}

function Times({ stored }: { stored: RestTimes }) {
  const { t } = useTranslation();
  const db = useDatabase();
  const [compound, setCompound] = useState<number | null>(stored.compound);
  const [isolation, setIsolation] = useState<number | null>(stored.isolation);
  const [synced, setSynced] = useState(stored);

  // A change that arrives from outside (sync) replaces the field that changed.
  if (stored.compound !== synced.compound || stored.isolation !== synced.isolation) {
    if (stored.compound !== synced.compound) setCompound(stored.compound);
    if (stored.isolation !== synced.isolation) setIsolation(stored.isolation);
    setSynced(stored);
  }

  /** Keeps a whole number from 15 to 900; an empty field goes back to the saved value. */
  const settle = (key: keyof RestTimes) => {
    const typed = key === 'compound' ? compound : isolation;
    const next =
      typed === null ? stored[key] : Math.min(MAX_REST, Math.max(MIN_REST, Math.round(typed)));
    (key === 'compound' ? setCompound : setIsolation)(next);
    if (next !== stored[key]) void saveRestTimes(db, { ...stored, [key]: next });
  };

  return (
    <>
      <NumberField
        label={t('settings.rest.compound')}
        value={compound}
        min={MIN_REST}
        max={MAX_REST}
        step={REST_STEP}
        maxFractionDigits={0}
        stepper
        onChange={setCompound}
        onBlur={() => {
          settle('compound');
        }}
      />
      <NumberField
        label={t('settings.rest.isolation')}
        value={isolation}
        min={MIN_REST}
        max={MAX_REST}
        step={REST_STEP}
        maxFractionDigits={0}
        stepper
        onChange={setIsolation}
        onBlur={() => {
          settle('isolation');
        }}
      />
    </>
  );
}

function Alerts() {
  const { t } = useTranslation();
  const storage = useMemo(() => getLocalStorage(window), []);
  const [alerts, setAlerts] = useState(() => readRestAlerts(storage));
  return (
    <>
      <Switch
        label={t('settings.rest.sound')}
        checked={alerts.sound}
        onChange={(sound) => {
          setAlerts((current) => ({ ...current, sound }));
          writeRestAlerts(storage, { sound });
        }}
      />
      <Switch
        label={t('settings.rest.vibration')}
        description={t('settings.rest.vibrationHint')}
        checked={alerts.vibration}
        onChange={(vibration) => {
          setAlerts((current) => ({ ...current, vibration }));
          writeRestAlerts(storage, { vibration });
        }}
      />
    </>
  );
}
