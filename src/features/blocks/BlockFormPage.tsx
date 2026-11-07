import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import {
  BLOCK_TYPES,
  LIMIT_RANGE,
  MAX_BLOCK_NAME,
  WEEKDAYS,
  draftFromBlock,
  emptyItemDraft,
  emptyMetricDraft,
  moveInList,
  newBlockDraft,
  validateBlockDraft,
  type BlockDraft,
  type BlockDraftError,
  type ItemDraft,
  type MetricDraft,
  type OptionalBlock,
  type Weekday,
} from '../../domain';
import { InvalidBlockError, createBlock, readBlocks, updateBlock } from '../../data/blocks';
import { useDatabase } from '../../data/DatabaseContext';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Button } from '../../ui/Button';
import { buttonClasses } from '../../ui/buttonClasses';
import { Checkbox } from '../../ui/Checkbox';
import { Chip } from '../../ui/Chip';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import { Segmented } from '../../ui/Segmented';
import { TextField } from '../../ui/TextField';
import { useToast } from '../../ui/ToastContext';
import styles from './Blocks.module.css';
import { weekdayLong, weekdayNarrow } from './blockText';

/** Create a block (`/settings/blocks/new`) or edit one (`/settings/blocks/:blockId/edit`). */
export function BlockFormPage() {
  const { t } = useTranslation();
  const db = useDatabase();
  const { blockId } = useParams();
  const blocks = useLiveQuery(() => readBlocks(db), [db]);
  if (!blocks) return null;
  if (blockId === undefined) return <BlockForm />;

  const block = blocks.find((b) => b.id === blockId);
  if (!block) {
    return (
      <EmptyState
        icon="info"
        title={t('blocksPage.notFound')}
        action={
          <Link to="/settings/blocks" className={buttonClasses({ variant: 'secondary' })}>
            {t('blocksPage.back')}
          </Link>
        }
      />
    );
  }
  return <BlockForm key={blockId} block={block} />;
}

/** The id of the control of a field, to give it the focus when it has an error. */
const fieldId = (error: BlockDraftError) =>
  error.field === 'name' ? 'block-name' : `${error.field}-${error.key ?? ''}`;

function BlockForm({ block }: { block?: OptionalBlock }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const db = useDatabase();
  const toast = useToast();
  const navigate = useNavigate();
  const keys = useRef(0);
  const nextKey = () => {
    keys.current += 1;
    return `new-${String(keys.current)}`;
  };

  const [draft, setDraft] = useState<BlockDraft>(() =>
    block ? draftFromBlock(block, (ref) => resolveText(t, ref)) : newBlockDraft(),
  );
  const [errors, setErrors] = useState<readonly BlockDraftError[]>([]);
  const [saving, setSaving] = useState(false);

  const change = (patch: Partial<BlockDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };
  const changeItem = (key: string, patch: Partial<ItemDraft>) => {
    change({ items: draft.items.map((item) => (item.key === key ? { ...item, ...patch } : item)) });
  };
  const changeMetric = (key: string, patch: Partial<MetricDraft>) => {
    change({
      metrics: draft.metrics.map((metric) =>
        metric.key === key ? { ...metric, ...patch } : metric,
      ),
    });
  };
  const toggleDay = (day: Weekday) => {
    change({
      days: draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day],
    });
  };

  const message = (field: BlockDraftError['field'], key?: string): string | undefined => {
    const found = errors.find((e) => e.field === field && e.key === key);
    if (!found) return undefined;
    const long = found.code === 'too-long';
    switch (field) {
      case 'name':
        return long
          ? t('blocksPage.form.errors.nameLong', { max: MAX_BLOCK_NAME })
          : t('blocksPage.form.errors.name');
      case 'itemName':
        return t(long ? 'blocksPage.form.errors.itemLong' : 'blocksPage.form.errors.itemName');
      case 'timesPerWeek':
        return t('blocksPage.form.errors.times');
      case 'metricName':
        return t(long ? 'blocksPage.form.errors.metricLong' : 'blocksPage.form.errors.metricName');
      case 'limit':
        return t('blocksPage.form.errors.limit', LIMIT_RANGE);
    }
  };
  const errorProp = (field: BlockDraftError['field'], key?: string) => {
    const text = message(field, key);
    return text === undefined ? {} : { error: text };
  };

  const fail = (found: readonly BlockDraftError[]) => {
    setErrors(found);
    const first = found[0];
    if (first) document.getElementById(fieldId(first))?.focus();
  };

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (saving) return;
    const found = validateBlockDraft(draft);
    if (found.length > 0) {
      fail(found);
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      const saved = block ? await updateBlock(db, block.id, draft) : await createBlock(db, draft);
      toast.show({ message: t('blocksPage.form.saved'), tone: 'success' });
      void navigate(`/settings/blocks/${saved.id}`);
    } catch (error) {
      setSaving(false);
      if (error instanceof InvalidBlockError) fail(error.errors);
      else toast.show({ message: t('blocksPage.form.failed'), tone: 'danger' });
    }
  };

  const cancelTo = block ? `/settings/blocks/${block.id}` : '/settings/blocks';
  const itemName = (item: ItemDraft, index: number) =>
    item.name.trim() || t('blocksPage.form.item', { n: index + 1 });
  const metricName = (metric: MetricDraft, index: number) =>
    metric.name.trim() || t('blocksPage.form.metric', { n: index + 1 });
  const weekly = block?.weeklyMetrics
    .map(
      (def) =>
        `${resolveText(t, def.name)} (${def.unit}): ${def.parts.map((p) => resolveText(t, p.name)).join(', ')}`,
    )
    .join('; ');

  return (
    <form className={styles.page} onSubmit={(event) => void submit(event)} noValidate>
      <Link to={cancelTo} className={styles.back}>
        <Icon name="back" size={20} />
        <span>{t('blocksPage.back')}</span>
      </Link>

      <TextField
        id="block-name"
        label={t('blocksPage.form.name')}
        value={draft.name}
        autoComplete="off"
        onChange={(event) => {
          change({ name: event.target.value });
        }}
        {...errorProp('name')}
      />

      {block ? (
        <p className={styles.muted}>
          {t('blocksPage.form.type')}: {t(`blocksPage.types.${block.blockType}`)}
        </p>
      ) : (
        <Segmented
          legend={t('blocksPage.form.type')}
          value={draft.blockType}
          onChange={(blockType) => {
            change({ blockType });
          }}
          options={BLOCK_TYPES.map((value) => ({
            value,
            label: t(`blocksPage.types.${value}`),
          }))}
        />
      )}

      <Checkbox
        label={t('blocksPage.form.active')}
        checked={draft.active}
        onChange={(active) => {
          change({ active });
        }}
      />

      <fieldset className={styles.fields}>
        <legend className={styles.subheading}>{t('blocksPage.form.days')}</legend>
        <div className={styles.days}>
          {WEEKDAYS.map((day) => (
            <Chip
              key={day}
              className={styles.day}
              selected={draft.days.includes(day)}
              aria-label={weekdayLong(day, locale)}
              onClick={() => {
                toggleDay(day);
              }}
            >
              {weekdayNarrow(day, locale)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className={styles.row}>
        <TextField
          type="date"
          label={t('blocksPage.form.start')}
          value={draft.startDate}
          onChange={(event) => {
            change({ startDate: event.target.value });
          }}
        />
        <TextField
          type="date"
          label={t('blocksPage.form.review')}
          value={draft.reviewDate}
          onChange={(event) => {
            change({ reviewDate: event.target.value });
          }}
        />
      </div>

      <section className={styles.fields} aria-labelledby="block-items">
        <h2 id="block-items" className={styles.heading}>
          {t('blocksPage.form.items')}
        </h2>
        {draft.items.map((item, index) => {
          const name = itemName(item, index);
          return (
            <fieldset key={item.key} className={styles.entry}>
              <legend className={styles.entryLegend}>
                {t('blocksPage.form.item', { n: index + 1 })}
              </legend>
              <TextField
                id={`itemName-${item.key}`}
                label={t('blocksPage.form.itemName')}
                value={item.name}
                autoComplete="off"
                onChange={(event) => {
                  changeItem(item.key, { name: event.target.value });
                }}
                {...errorProp('itemName', item.key)}
              />
              <TextField
                label={t('blocksPage.form.dose')}
                value={item.dose}
                autoComplete="off"
                onChange={(event) => {
                  changeItem(item.key, { dose: event.target.value });
                }}
              />
              <TextField
                id={`timesPerWeek-${item.key}`}
                label={t('blocksPage.form.times')}
                hint={t('blocksPage.form.timesHint')}
                value={item.timesPerWeek}
                autoComplete="off"
                onChange={(event) => {
                  changeItem(item.key, { timesPerWeek: event.target.value });
                }}
                {...errorProp('timesPerWeek', item.key)}
              />
              <div className={styles.entryActions}>
                <IconButton
                  icon="chevronUp"
                  label={t('blocksPage.form.up', { name })}
                  disabled={index === 0}
                  onClick={() => {
                    change({ items: moveInList(draft.items, index, -1) });
                  }}
                />
                <IconButton
                  icon="chevronDown"
                  label={t('blocksPage.form.down', { name })}
                  disabled={index === draft.items.length - 1}
                  onClick={() => {
                    change({ items: moveInList(draft.items, index, 1) });
                  }}
                />
                <IconButton
                  icon="trash"
                  variant="danger"
                  label={t('blocksPage.form.remove', { name })}
                  onClick={() => {
                    change({ items: draft.items.filter((i) => i.key !== item.key) });
                  }}
                />
              </div>
            </fieldset>
          );
        })}
        <Button
          variant="secondary"
          onClick={() => {
            change({ items: [...draft.items, emptyItemDraft(nextKey())] });
          }}
        >
          {t('blocksPage.form.addItem')}
        </Button>
      </section>

      <section className={styles.fields} aria-labelledby="block-metrics">
        <h2 id="block-metrics" className={styles.heading}>
          {t('blocksPage.form.metrics')}
        </h2>
        {draft.metrics.map((metric, index) => {
          const name = metricName(metric, index);
          return (
            <fieldset key={metric.key} className={styles.entry}>
              <legend className={styles.entryLegend}>
                {t('blocksPage.form.metric', { n: index + 1 })}
              </legend>
              <TextField
                id={`metricName-${metric.key}`}
                label={t('blocksPage.form.metricName')}
                value={metric.name}
                autoComplete="off"
                onChange={(event) => {
                  changeMetric(metric.key, { name: event.target.value });
                }}
                {...errorProp('metricName', metric.key)}
              />
              <TextField
                id={`limit-${metric.key}`}
                label={t('blocksPage.form.limit')}
                hint={t('blocksPage.form.limitHint')}
                inputMode="numeric"
                value={metric.limit}
                autoComplete="off"
                onChange={(event) => {
                  changeMetric(metric.key, { limit: event.target.value });
                }}
                {...errorProp('limit', metric.key)}
              />
              <div className={styles.entryActions}>
                <IconButton
                  icon="trash"
                  variant="danger"
                  label={t('blocksPage.form.remove', { name })}
                  onClick={() => {
                    change({ metrics: draft.metrics.filter((m) => m.key !== metric.key) });
                  }}
                />
              </div>
            </fieldset>
          );
        })}
        <Button
          variant="secondary"
          onClick={() => {
            change({ metrics: [...draft.metrics, emptyMetricDraft(nextKey())] });
          }}
        >
          {t('blocksPage.form.addMetric')}
        </Button>
        {weekly && <p className={styles.muted}>{t('blocksPage.form.weekly', { list: weekly })}</p>}
      </section>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={saving}>
          {t('blocksPage.form.save')}
        </Button>
        <Link to={cancelTo} className={buttonClasses({ variant: 'ghost' })}>
          {t('blocksPage.form.cancel')}
        </Link>
      </div>
    </form>
  );
}
