// What is typed in a set row but not saved yet. It survives re-draws and reloads, lives only on
// this device (localStorage, never synced) and is dropped when the session ends or is deleted.
// Drafts are keyed by exercise and slot, so they follow the rows when rows are added or removed.
import { z } from 'zod';
import type { RowEdit } from '../domain';
import { removeDeviceSetting, writeDeviceSetting, type ReadableStorage } from './deviceStorage';

const rowDraftSchema = z.object({
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  rir: z.number().nullable(),
});
export type RowDraft = z.infer<typeof rowDraftSchema>;

/** exerciseId → slot → what was typed. */
export type SessionDrafts = Record<string, Record<string, RowDraft>>;

const draftsSchema = z.record(z.string(), z.record(z.string(), rowDraftSchema));

export const draftKey = (sessionId: string) => `certavi.draft.${sessionId}`;

export function readDrafts(storage: ReadableStorage | null, sessionId: string): SessionDrafts {
  try {
    const text = storage?.getItem(draftKey(sessionId));
    if (!text) return {};
    const parsed = draftsSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function writeDrafts(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
  sessionId: string,
  drafts: SessionDrafts,
): boolean {
  const empty = Object.values(drafts).every((slots) => Object.keys(slots).length === 0);
  return empty
    ? removeDeviceSetting(storage, draftKey(sessionId))
    : writeDeviceSetting(storage, draftKey(sessionId), JSON.stringify(drafts));
}

export function clearDrafts(storage: Pick<Storage, 'removeItem'> | null, sessionId: string) {
  return removeDeviceSetting(storage, draftKey(sessionId));
}

const isBlank = (draft: RowDraft) =>
  draft.weight === null && draft.reps === null && draft.rir === null;

/** The drafts with the one of a row replaced; a blank (or null) draft removes it. */
export function setDraft(
  drafts: SessionDrafts,
  exerciseId: string,
  slot: number,
  draft: RowDraft | null,
): SessionDrafts {
  const { [exerciseId]: current = {}, ...others } = drafts;
  const slots = Object.fromEntries(Object.entries(current).filter(([key]) => key !== String(slot)));
  const next = draft && !isBlank(draft) ? { ...slots, [String(slot)]: draft } : slots;
  return Object.keys(next).length === 0 ? others : { ...others, [exerciseId]: next };
}

/** The drafts without those of one exercise (it left the session). */
export function dropExerciseDrafts(drafts: SessionDrafts, exerciseId: string): SessionDrafts {
  return Object.fromEntries(Object.entries(drafts).filter(([key]) => key !== exerciseId));
}

/** Moves the drafts of an exercise to follow an edit of its rows; those of removed rows go. */
export function remapDrafts(
  drafts: SessionDrafts,
  exerciseId: string,
  remap: RowEdit['remap'],
): SessionDrafts {
  const current = drafts[exerciseId];
  if (!current) return drafts;
  const moved: Record<string, RowDraft> = {};
  for (const [slot, draft] of Object.entries(current)) {
    const to = remap(Number(slot));
    if (to !== null) moved[String(to)] = draft;
  }
  const others = Object.fromEntries(Object.entries(drafts).filter(([key]) => key !== exerciseId));
  return Object.keys(moved).length === 0 ? others : { ...others, [exerciseId]: moved };
}
