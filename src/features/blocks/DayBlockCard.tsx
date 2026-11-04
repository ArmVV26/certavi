import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  daysBetween,
  doneCount,
  isAboveThreshold,
  parseIsoDate,
  type BlockLog,
  type BlockLogPatch,
  type OptionalBlock,
} from '../../domain';
import { formatDate } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { Card } from '../../ui/Card';
import { Checkbox } from '../../ui/Checkbox';
import { Icon } from '../../ui/Icon';
import { ScalePicker } from '../../ui/ScalePicker';
import { TextArea } from '../../ui/TextField';
import styles from './DayBlockCard.module.css';

interface DayBlockCardProps {
  block: OptionalBlock;
  log: BlockLog | undefined;
  today: string;
  /** Saves one change to today's log; resolves to false if it could not be saved. */
  onChange: (patch: BlockLogPatch) => Promise<boolean>;
}

/** An optional block on Today: its checklist, its 0–10 metrics and a note for the day. */
export function DayBlockCard({ block, log, today, onChange }: DayBlockCardProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const warned = block.metrics.find((m) => isAboveThreshold(m, log?.metrics[m.id]));

  return (
    <Card element="section">
      <h2 className={styles.heading}>{resolveText(t, block.name)}</h2>
      {block.reviewDate !== undefined && block.reviewDate >= today && (
        <p className={styles.muted}>
          {block.reviewDate === today
            ? t('blocksDay.reviewToday')
            : t('blocksDay.reviewIn', {
                date: formatDate(parseIsoDate(block.reviewDate), locale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                }),
                count: daysBetween(today, block.reviewDate),
              })}
        </p>
      )}

      {block.items.length > 0 && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>
            {t('blocksDay.checklist', {
              done: doneCount(block, log),
              total: block.items.length,
            })}
          </legend>
          {block.items.map((item) => {
            const dose = item.dose ? resolveText(t, item.dose) : undefined;
            const description =
              item.timesPerWeek !== undefined
                ? t('blocksDay.timesPerWeek', { dose: dose ?? '', times: item.timesPerWeek })
                : dose;
            return (
              <Checkbox
                key={item.id}
                label={resolveText(t, item.name)}
                {...(description ? { description } : {})}
                checked={log?.done[item.id] === true}
                onChange={(value) => {
                  void onChange({ done: { itemId: item.id, value } });
                }}
              />
            );
          })}
        </fieldset>
      )}

      {block.metrics.map((metric) => (
        <ScalePicker
          key={metric.id}
          label={resolveText(t, metric.name)}
          min={metric.min}
          max={metric.max}
          {...(metric.threshold !== undefined ? { warnAbove: metric.threshold } : {})}
          value={log?.metrics[metric.id] ?? null}
          onChange={(value) => {
            void onChange({ metric: { metricId: metric.id, value } });
          }}
        />
      ))}
      {warned?.threshold !== undefined && (
        <p className={styles.warning} role="status">
          <Icon name="warning" size={20} />
          <span>{t('blocksDay.warning', { threshold: warned.threshold })}</span>
        </p>
      )}

      <NoteField saved={log?.note ?? ''} onSave={(note) => onChange({ note })} />
    </Card>
  );
}

/** The day's note, saved when the field loses focus. What is typed survives re-renders. */
function NoteField({
  saved,
  onSave,
}: {
  saved: string;
  onSave: (note: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | undefined>(undefined);
  // Once the saved note matches what was typed, follow the saved one again (e.g. from sync).
  if (draft !== undefined && draft === saved) setDraft(undefined);
  const value = draft ?? saved;
  return (
    <TextArea
      label={t('blocksDay.note')}
      value={value}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={() => {
        if (draft !== undefined) void onSave(draft);
      }}
    />
  );
}
