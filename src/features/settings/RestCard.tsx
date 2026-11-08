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
import { useToast } from '../../ui/ToastContext';
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
  const toast = useToast();
  const db = useDatabase();
  const [compound, setCompound] = useState<number | null>(stored.compound);
  const [isolation, setIsolation] = useState<number | null>(stored.isolation);
  const [synced, setSynced] = useState(stored);
  // Saves made from this screen that the live query has not read back yet (a slow browser can
  // take a while). Reading one of them back is not a change from outside.
  const [unread, setUnread] = useState<RestTimes[]>([]);

  if (!sameTimes(stored, synced)) {
    setSynced(stored);
    const own = unread.findIndex((times) => sameTimes(times, stored));
    if (own >= 0) {
      // Our own save: the fields already show it, and may already hold the next typed value.
      setUnread(unread.slice(own + 1));
    } else {
      // A change that arrives from outside (sync) replaces the field that changed.
      if (stored.compound !== synced.compound) setCompound(stored.compound);
      if (stored.isolation !== synced.isolation) setIsolation(stored.isolation);
      setUnread([]);
    }
  }

  const inRange = (seconds: number) => Math.min(MAX_REST, Math.max(MIN_REST, Math.round(seconds)));

  /** Keeps a whole number from 15 to 900; an empty field goes back to the saved value. */
  const settle = (key: keyof RestTimes) => {
    // The latest save, even if `stored` (the database read back) does not hold it yet.
    const saved = unread[unread.length - 1] ?? stored;
    const typed = key === 'compound' ? compound : isolation;
    const next = typed === null ? saved[key] : inRange(typed);
    (key === 'compound' ? setCompound : setIsolation)(next);
    // The other time comes from this screen too, so a save never writes an old value back.
    const other = key === 'compound' ? isolation : compound;
    const otherKey = key === 'compound' ? 'isolation' : 'compound';
    const times = {
      ...saved,
      [key]: next,
      [otherKey]: other === null ? saved[otherKey] : inRange(other),
    };
    if (sameTimes(times, saved)) return;
    setUnread([...unread, times]);
    saveRestTimes(db, times).catch((error: unknown) => {
      console.error('Could not save the rest times', error);
      // Back to what is really saved: the fields must not show a time the database does not have.
      setUnread((list) => list.filter((entry) => entry !== times));
      setCompound(saved.compound);
      setIsolation(saved.isolation);
      toast.show({ message: t('settings.rest.failed'), tone: 'danger' });
    });
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

function sameTimes(a: RestTimes, b: RestTimes): boolean {
  return a.compound === b.compound && a.isolation === b.isolation;
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
