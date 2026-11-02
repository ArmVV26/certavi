import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { NumberField } from '../../ui/NumberField';
import { Segmented } from '../../ui/Segmented';
import { Sheet } from '../../ui/Sheet';
import { Switch } from '../../ui/Switch';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/ToastContext';
import styles from './DevUiPage.module.css';

type Range = 'week' | 'last' | 'average';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card element="section">
      <h2 className={styles.heading}>{title}</h2>
      {children}
    </Card>
  );
}

/** Internal catalog of the base components (not linked from the tab bar). */
export function DevUiPage() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const toast = useToast();

  const [straps, setStraps] = useState(true);
  const [band, setBand] = useState(false);
  const [custom, setCustom] = useState(false);
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(8);
  const [range, setRange] = useState<Range>('week');
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const showValue = (value: number | null) =>
    t('devUi.value', { value: value === null ? t('devUi.empty') : formatNumber(value, locale) });

  return (
    <div className={styles.page}>
      <p className={styles.intro}>{t('devUi.intro')}</p>

      <Section title={t('devUi.buttons')}>
        <div className={styles.stack}>
          <Button icon="today" fullWidth size="lg">
            {t('devUi.primary')}
          </Button>
          <div className={styles.row}>
            <Button variant="secondary">{t('devUi.secondary')}</Button>
            <Button variant="ghost">{t('devUi.ghost')}</Button>
          </div>
          <div className={styles.row}>
            <Button variant="danger" icon="trash">
              {t('devUi.danger')}
            </Button>
            <Button disabled>{t('devUi.disabled')}</Button>
          </div>
        </div>
      </Section>

      <Section title={t('devUi.iconButtons')}>
        <div className={styles.row}>
          <IconButton icon="plus" label={t('devUi.add')} variant="filled" />
          <IconButton icon="minus" label={t('devUi.remove')} />
          <IconButton icon="trash" label={t('devUi.danger')} variant="danger" />
          <IconButton icon="close" label={t('ui.close')} disabled />
        </div>
      </Section>

      <Section title={t('devUi.chipsTags')}>
        <div className={styles.row}>
          <Chip
            selected={straps}
            onClick={() => {
              setStraps(!straps);
            }}
          >
            {t('devUi.chipStraps')}
          </Chip>
          <Chip
            selected={band}
            onClick={() => {
              setBand(!band);
            }}
          >
            {t('devUi.chipBand')}
          </Chip>
          <Chip
            selected={custom}
            onClick={() => {
              setCustom(!custom);
            }}
          >
            {t('devUi.chipCustom')}
          </Chip>
        </div>
        <div className={styles.row}>
          <Tag>{t('devUi.tagPlates')}</Tag>
          <Tag tone="accent">{t('devUi.tagNew')}</Tag>
          <Tag tone="success">{t('devUi.tagDone')}</Tag>
          <Tag tone="warning">{t('devUi.tagNotCounting')}</Tag>
          <Tag tone="danger">{t('devUi.tagError')}</Tag>
          <Tag tone="warmup">
            <abbr title={t('sets.warmup')}>{t('sets.warmupSymbol')}</abbr>
          </Tag>
        </div>
      </Section>

      <Section title={t('devUi.card')}>
        <Card element="article">
          <div className={styles.between}>
            <h3 className={styles.cardTitle}>{t('devUi.cardTitle')}</h3>
            <Tag>{t('devUi.tagPlates')}</Tag>
          </div>
          <p className={styles.muted}>{t('devUi.cardText')}</p>
        </Card>
      </Section>

      <Section title={t('devUi.numberFields')}>
        <NumberField
          label={t('devUi.weight')}
          unit="kg"
          value={weight}
          onChange={setWeight}
          placeholder={27.5}
          step={2.5}
          min={0}
          max={500}
          stepper
          hint={t('devUi.weightHint')}
        />
        <p className={styles.muted}>{showValue(weight)}</p>
        <NumberField
          label={t('devUi.reps')}
          value={reps}
          onChange={setReps}
          min={0}
          max={100}
          maxFractionDigits={0}
          stepper
        />
        <p className={styles.muted}>{showValue(reps)}</p>
      </Section>

      <Section title={t('devUi.segmented')}>
        <Segmented<Range>
          legend={t('devUi.range')}
          value={range}
          onChange={setRange}
          options={[
            { value: 'week', label: t('devUi.rangeWeek') },
            { value: 'last', label: t('devUi.rangeLast') },
            { value: 'average', label: t('devUi.rangeAverage') },
          ]}
        />
      </Section>

      <Section title={t('devUi.switch')}>
        <Switch label={t('devUi.sound')} checked={sound} onChange={setSound} />
        <Switch
          label={t('devUi.vibration')}
          description={t('devUi.vibrationHint')}
          checked={vibration}
          onChange={setVibration}
        />
      </Section>

      <Section title={t('devUi.dialog')}>
        <Button
          variant="danger"
          icon="trash"
          onClick={() => {
            setConfirmOpen(true);
          }}
        >
          {t('devUi.openDialog')}
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          title={t('devUi.dialogTitle')}
          message={t('devUi.dialogText')}
          confirmLabel={t('devUi.confirmRemove')}
          cancelLabel={t('devUi.cancel')}
          destructive
          onCancel={() => {
            setConfirmOpen(false);
          }}
          onConfirm={() => {
            setConfirmOpen(false);
            toast.show({
              message: t('devUi.removed'),
              action: {
                label: t('devUi.undo'),
                onAction: () => {
                  toast.show({ message: t('devUi.restored'), tone: 'success' });
                },
              },
            });
          }}
        />
      </Section>

      <Section title={t('devUi.sheet')}>
        <Button
          variant="secondary"
          icon="plus"
          onClick={() => {
            setSheetOpen(true);
          }}
        >
          {t('devUi.openSheet')}
        </Button>
        <Sheet
          open={sheetOpen}
          title={t('devUi.sheetTitle')}
          onClose={() => {
            setSheetOpen(false);
          }}
        >
          <p className={styles.muted}>{t('devUi.sheetText')}</p>
        </Sheet>
      </Section>

      <Section title={t('devUi.toast')}>
        <Button
          variant="secondary"
          onClick={() => {
            toast.show({ message: t('devUi.toastSaved'), tone: 'success' });
          }}
        >
          {t('devUi.showToast')}
        </Button>
      </Section>

      <Section title={t('devUi.emptyState')}>
        <EmptyState
          icon="calendar"
          headingLevel={3}
          title={t('devUi.emptyTitle')}
          description={t('devUi.emptyText')}
          action={<Button>{t('devUi.emptyAction')}</Button>}
        />
      </Section>

      <Section title={t('devUi.formats')}>
        <p>{t('devUi.today', { date: formatDate(new Date(), locale) })}</p>
        <p>{t('devUi.number', { value: formatNumber(1234.5, locale) })}</p>
      </Section>
    </div>
  );
}
