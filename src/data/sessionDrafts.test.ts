import { describe, expect, it } from 'vitest';
import {
  clearDrafts,
  draftKey,
  readDrafts,
  remapDrafts,
  setDraft,
  writeDrafts,
  type SessionDrafts,
} from './sessionDrafts';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const typed = { weight: 60, reps: 8, rir: null };

describe('drafts in storage', () => {
  it('are saved per session and read back', () => {
    const storage = memoryStorage();
    const drafts: SessionDrafts = { press: { '1': typed } };
    expect(writeDrafts(storage, 's1', drafts)).toBe(true);
    expect(readDrafts(storage, 's1')).toEqual(drafts);
    expect(readDrafts(storage, 's2')).toEqual({});
  });

  it('remove the key when nothing is left, and when the session ends', () => {
    const storage = memoryStorage();
    writeDrafts(storage, 's1', { press: { '1': typed } });
    writeDrafts(storage, 's1', {});
    expect(storage.getItem(draftKey('s1'))).toBeNull();
    writeDrafts(storage, 's1', { press: { '1': typed } });
    clearDrafts(storage, 's1');
    expect(storage.getItem(draftKey('s1'))).toBeNull();
  });

  it('survive missing, broken or hostile storage', () => {
    expect(readDrafts(null, 's1')).toEqual({});
    expect(writeDrafts(null, 's1', { a: { '0': typed } })).toBe(false);
    const storage = memoryStorage();
    storage.setItem(draftKey('s1'), '{not json');
    expect(readDrafts(storage, 's1')).toEqual({});
    storage.setItem(draftKey('s1'), JSON.stringify({ a: { '0': { weight: 'x' } } }));
    expect(readDrafts(storage, 's1')).toEqual({});
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readDrafts(throwing, 's1')).toEqual({});
  });
});

describe('editing drafts', () => {
  it('sets, replaces and drops the draft of a row', () => {
    let drafts = setDraft({}, 'press', 2, typed);
    expect(drafts).toEqual({ press: { '2': typed } });
    drafts = setDraft(drafts, 'press', 2, { ...typed, reps: 9 });
    expect(drafts.press?.['2']?.reps).toBe(9);
    drafts = setDraft(drafts, 'press', 3, typed);
    drafts = setDraft(drafts, 'press', 2, null);
    expect(drafts).toEqual({ press: { '3': typed } });
    drafts = setDraft(drafts, 'press', 3, { weight: null, reps: null, rir: null });
    expect(drafts).toEqual({});
  });

  it('follow the rows when rows are added or removed', () => {
    const drafts: SessionDrafts = { press: { '0': typed, '2': typed }, curl: { '1': typed } };
    const down = remapDrafts(drafts, 'press', (slot) => slot + 1);
    expect(Object.keys(down.press ?? {})).toEqual(['1', '3']);
    expect(down.curl).toEqual(drafts.curl);
    const removed = remapDrafts(drafts, 'press', (slot) => (slot === 0 ? null : slot - 1));
    expect(removed.press).toEqual({ '1': typed });
    expect(remapDrafts(drafts, 'press', () => null)).toEqual({ curl: drafts.curl });
    expect(remapDrafts(drafts, 'bench', (slot) => slot)).toBe(drafts);
  });
});
