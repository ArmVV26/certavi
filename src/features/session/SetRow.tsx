import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DisplayRow } from '../../domain';
import type { RowDraft } from '../../data/sessionDrafts';
import type { RowType } from '../../data/sessionLog';
import { formatNumber } from '../../i18n/format';
import { useLocale } from '../../i18n/LocaleContext';
import { cx } from '../../ui/cx';
import { Icon } from '../../ui/Icon';
import { NumberField } from '../../ui/NumberField';
import { SelectField } from '../../ui/SelectField';
import { Sheet } from '../../ui/Sheet';
import { fieldId } from './fieldId';
import styles from './SetRow.module.css';

/** Pixels the row slides to show "Quitar". */
const REVEAL_PX = 88;
const OPEN_FROM_PX = 40;
const DRAG_FROM_PX = 10;

const BLANK: RowDraft = { weight: null, reps: null, rir: null };

const RIR_OPTIONS = ['', '0', '1', '2', '3', '4', '5'];

export interface SetRowProps {
  exerciseId: string;
  row: DisplayRow;
  /** Visible label of the type cell: "2", "C", "D". */
  symbol: string;
  /** Name for assistive technology and dialogs: "2", "C1", "D1". */
  name: string;
  /** Small text under the row: the role, the rep target, "no cuenta". */
  caption: string;
  bodyweight: boolean;
  draft: RowDraft | null;
  canRemove: boolean;
  invalidField: 'weight' | 'reps' | null;
  /** The row was just added: move the focus to its weight field. */
  focusWeight: boolean;
  onFocused: () => void;
  onEdit: (draft: RowDraft, commit: boolean) => void;
  onDone: () => void;
  onType: (type: RowType) => void;
  onRemove: () => void;
}

function typeOf(row: DisplayRow): RowType {
  return row.kind === 'warmup' ? 'warmup' : row.kind === 'dropset' ? 'dropset' : 'effective';
}

/** One row of sets: type, last time, weight, reps, RIR and ✓. Swipe it left to remove it. */
export function SetRow({
  exerciseId,
  row,
  symbol,
  name,
  caption,
  bodyweight,
  draft,
  canRemove,
  invalidField,
  focusWeight,
  onFocused,
  onEdit,
  onDone,
  onType,
  onRemove,
}: SetRowProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [sheetOpen, setSheetOpen] = useState(false);
  const swipe = useSwipe();

  useEffect(() => {
    if (!focusWeight) return;
    document.getElementById(fieldId(exerciseId, row.slot, 'weight'))?.focus();
    onFocused();
  }, [focusWeight, exerciseId, row.slot, onFocused]);

  const { set } = row;
  const current: RowDraft =
    draft ?? (set ? { weight: set.weight, reps: set.reps, rir: set.rir } : BLANK);
  const type = typeOf(row);
  const typeName = t(`session.row.types.${type}`);
  const rowLabel = (key: 'weightOf' | 'addedOf' | 'repsOf' | 'rirOf') =>
    t(`session.row.${key}`, { name });
  const previous = row.previous
    ? `${formatNumber(row.previous.weight, locale, { maximumFractionDigits: 2 })} × ${String(row.previous.reps)}`
    : '—';

  const edit = (patch: Partial<RowDraft>, commit = false) => {
    onEdit({ ...current, ...patch }, commit);
  };
  // A saved row is corrected as soon as the field loses focus.
  const commitIfSaved = () => {
    if (set && draft) onEdit(draft, true);
  };

  return (
    <li className={styles.item}>
      <div className={styles.swipe}>
        {canRemove && (
          <button
            type="button"
            className={styles.removeAction}
            aria-label={t('session.row.removeOf', { name })}
            onFocus={swipe.reveal}
            onBlur={swipe.hide}
            onClick={onRemove}
          >
            <Icon name="trash" size={18} />
            {t('session.row.remove')}
          </button>
        )}
        <div
          className={cx(
            styles.content,
            row.kind === 'warmup' && styles.warmup,
            set && styles.done,
            swipe.state === 'open' && styles.open,
            swipe.state === 'dragging' && styles.dragging,
          )}
          style={swipe.style}
          {...swipe.handlers}
        >
          <p className={styles.caption}>{caption}</p>
          <div className={styles.grid}>
            <button
              type="button"
              className={cx(styles.type, row.kind === 'warmup' && styles.typeWarmup)}
              aria-label={t('session.row.typeOf', { name, type: typeName.toLowerCase() })}
              onClick={() => {
                setSheetOpen(true);
              }}
            >
              {symbol}
            </button>
            <span className={styles.previous}>{previous}</span>
            <NumberField
              compact
              hideLabel
              id={fieldId(exerciseId, row.slot, 'weight')}
              label={rowLabel(bodyweight ? 'addedOf' : 'weightOf')}
              value={current.weight}
              invalid={invalidField === 'weight'}
              onChange={(weight) => {
                edit({ weight });
              }}
              onBlur={commitIfSaved}
            />
            <NumberField
              compact
              hideLabel
              id={fieldId(exerciseId, row.slot, 'reps')}
              label={rowLabel('repsOf')}
              value={current.reps}
              maxFractionDigits={0}
              min={0}
              invalid={invalidField === 'reps'}
              onChange={(reps) => {
                edit({ reps });
              }}
              onBlur={commitIfSaved}
            />
            <SelectField
              compact
              hideLabel
              label={rowLabel('rirOf')}
              value={current.rir === null ? '' : String(Math.min(current.rir, 5))}
              options={RIR_OPTIONS.map((value) => ({
                value,
                label: value === '' ? t('session.row.rir') : value === '5' ? '5+' : value,
              }))}
              onChange={(value) => {
                edit({ rir: value === '' ? null : Number(value) }, set !== null);
              }}
            />
            <button
              type="button"
              className={cx(styles.check, set && styles.checked)}
              aria-label={set ? t('session.row.isDone') : t('session.row.markDone')}
              aria-pressed={set !== null}
              onClick={onDone}
            >
              <Icon name="check" size={22} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
        }}
        title={t('session.row.typeTitle')}
      >
        <ul className={styles.types}>
          {(['warmup', 'effective', 'dropset'] as const).map((option) => (
            <li key={option}>
              <button
                type="button"
                className={cx(styles.typeOption, option === type && styles.typeCurrent)}
                aria-pressed={option === type}
                onClick={() => {
                  setSheetOpen(false);
                  if (option !== type) onType(option);
                }}
              >
                {t(`session.row.types.${option}`)}
                {option === type && <Icon name="check" size={20} />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </li>
  );
}

/** Swipe to the left to show the remove button; it also shows when the button has the focus. */
function useSwipe() {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      start.current = { x: event.clientX, y: event.clientY };
      if (open) setOpen(false);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const from = start.current;
      if (!from) return;
      const dx = event.clientX - from.x;
      if (drag === null) {
        if (Math.abs(dx) < DRAG_FROM_PX || Math.abs(dx) < Math.abs(event.clientY - from.y)) return;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      setDrag(Math.max(-REVEAL_PX, Math.min(0, dx)));
    },
    onPointerUp() {
      if (drag !== null) setOpen(drag < -OPEN_FROM_PX);
      start.current = null;
      setDrag(null);
    },
    onPointerCancel() {
      start.current = null;
      setDrag(null);
    },
  };

  return {
    handlers,
    state: drag !== null ? ('dragging' as const) : open ? ('open' as const) : ('closed' as const),
    style: drag === null ? undefined : { transform: `translateX(${String(drag)}px)` },
    reveal: () => {
      setOpen(true);
    },
    hide: () => {
      setOpen(false);
    },
  };
}
