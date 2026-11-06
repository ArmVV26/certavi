import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { DomainRecord } from '../../domain';
import { exportAll, readBackup } from '../../data/backup';
import { exportActivityWeightCsv, exportSetsCsv, type CsvLabels } from '../../data/csv';
import { useDatabase } from '../../data/DatabaseContext';
import type { ExportFile } from '../../data/exportFile';
import { applyImport, planImport, type ImportPlan } from '../../data/importRecords';
import { readGymAppExport } from '../../data/legacy/gymApp';
import { formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/ToastContext';
import { downloadFile } from '../../ui/download';
import styles from './DataCard.module.css';
import { LISTED_TYPES } from './recordTypes';

type Source = 'legacy' | 'backup';

interface Preview {
  source: Source;
  records: DomainRecord[];
  plan: ImportPlan;
  ignored: number;
  invalid: number;
}

const SETS_COLUMNS = [
  'date',
  'session',
  'exercise',
  'setKind',
  'order',
  'weight',
  'reps',
  'rir',
  'straps',
  'band',
  'e1rm',
  'effective',
  'exerciseNote',
  'sessionNote',
] as const;

const ACTIVITY_COLUMNS = ['date', 'type', 'activity', 'minutes', 'weight', 'note'] as const;

function csvLabels(t: TFunction): CsvLabels {
  return {
    yes: t('settings.data.csv.yes'),
    no: t('settings.data.csv.no'),
    text: (ref) => resolveText(t, ref),
    setKind: (kind) => t(`sets.kinds.${kind}`),
    activityKind: (kind) => t(`activities.kinds.${kind}`),
    freeSession: t('routines.free'),
    setsHeader: SETS_COLUMNS.map((c) => t(`settings.data.csv.sets.${c}`)),
    activityHeader: ACTIVITY_COLUMNS.map((c) => t(`settings.data.csv.activity.${c}`)),
    activityRow: t('settings.data.csv.activityRow'),
    weightRow: t('settings.data.csv.weightRow'),
  };
}

const TITLE_KEY = {
  legacy: 'settings.data.importLegacy',
  backup: 'settings.data.importBackup',
} as const;

const ERROR_KEY = {
  legacy: 'settings.data.errors.notLegacy',
  backup: 'settings.data.errors.notBackup',
} as const;

interface ImportExportProps {
  /** Injectable for tests. */
  download?: (file: ExportFile) => void;
}

/** Import from gym_app or a Certavi backup (with a preview), and the JSON / CSV exports. */
export function ImportExport({ download = downloadFile }: ImportExportProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const db = useDatabase();
  const toast = useToast();
  const inputs = { legacy: useRef<HTMLInputElement>(null), backup: useRef<HTMLInputElement>(null) };
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(source: Source, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // so choosing the same file again fires a change
    if (!file) return;
    const text = await file.text();
    const read = source === 'legacy' ? readGymAppExport(text) : readBackup(text);
    if (!read.ok) {
      toast.show({ message: t(ERROR_KEY[source]), tone: 'danger' });
      return;
    }
    const plan = await planImport(db, read.records);
    setPreview({ source, ...read, plan });
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await applyImport(db, preview.records);
      toast.show({
        message: t('settings.data.imported', {
          total: formatNumber(result.toWrite.length, locale),
        }),
        tone: 'success',
      });
    } catch {
      toast.show({ message: t('settings.data.errors.importFailed'), tone: 'danger' });
    } finally {
      setBusy(false);
      setPreview(null);
    }
  }

  async function runExport(make: () => Promise<ExportFile>) {
    try {
      download(await make());
    } catch {
      toast.show({ message: t('settings.data.errors.exportFailed'), tone: 'danger' });
    }
  }

  const close = () => {
    setPreview(null);
  };
  const nothingNew = preview?.plan.toWrite.length === 0;
  const extraRows = preview
    ? ([
        ['settings.data.preview.unchanged', preview.plan.unchanged],
        ['settings.data.preview.ignored', preview.ignored],
        ['settings.data.preview.invalid', preview.invalid],
      ] as const)
    : [];

  return (
    <>
      <h3 className={styles.subheading}>{t('settings.data.import')}</h3>
      <div className={styles.actions}>
        {(['legacy', 'backup'] as const).map((source) => (
          <div key={source}>
            <Button variant="secondary" fullWidth onClick={() => inputs[source].current?.click()}>
              {t(TITLE_KEY[source])}
            </Button>
            <input
              ref={inputs[source]}
              type="file"
              name={`${source}-file`}
              accept=".json,application/json"
              hidden
              onChange={(event) => void onFile(source, event)}
            />
          </div>
        ))}
      </div>

      <h3 className={styles.subheading}>{t('settings.data.export')}</h3>
      <div className={styles.actions}>
        <Button variant="secondary" fullWidth onClick={() => void runExport(() => exportAll(db))}>
          {t('settings.data.exportBackup')}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => void runExport(() => exportSetsCsv(db, csvLabels(t)))}
        >
          {t('settings.data.exportSets')}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => void runExport(() => exportActivityWeightCsv(db, csvLabels(t)))}
        >
          {t('settings.data.exportActivity')}
        </Button>
      </div>

      <Dialog
        open={preview !== null}
        onClose={close}
        title={preview ? t(TITLE_KEY[preview.source]) : ''}
        description={t(
          nothingNew ? 'settings.data.preview.nothing' : 'settings.data.preview.intro',
        )}
        role="alertdialog"
        dismissible={false}
        initialFocusRef={cancelRef}
        actions={
          nothingNew ? (
            <Button ref={cancelRef} variant="secondary" onClick={close}>
              {t('settings.data.preview.close')}
            </Button>
          ) : (
            <>
              <Button ref={cancelRef} variant="secondary" onClick={close} disabled={busy}>
                {t('settings.data.preview.cancel')}
              </Button>
              <Button onClick={() => void confirmImport()} disabled={busy}>
                {t('settings.data.preview.confirm')}
              </Button>
            </>
          )
        }
      >
        {preview && (
          <dl className={styles.list} aria-label={t('settings.data.preview.summary')}>
            {LISTED_TYPES.flatMap((type) => {
              const count = preview.plan.byType[type] ?? 0;
              return count > 0
                ? [
                    <div key={type} className={styles.row}>
                      <dt>{t(`settings.data.types.${type}`)}</dt>
                      <dd className={styles.value}>{formatNumber(count, locale)}</dd>
                    </div>,
                  ]
                : [];
            })}
            {extraRows.flatMap(([key, count]) =>
              count > 0
                ? [
                    <div key={key} className={styles.row}>
                      <dt>{t(key)}</dt>
                      <dd className={styles.value}>{formatNumber(count, locale)}</dd>
                    </div>,
                  ]
                : [],
            )}
          </dl>
        )}
      </Dialog>
    </>
  );
}
