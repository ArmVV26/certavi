import { describe, expect, it, vi } from 'vitest';
import { bearerToken, isSecretConfigured, keyMatches } from './auth';
import { createMemoryStore } from './memoryStore';
import { fromNetlifyStore, type BlobsStore } from './netlifyStore';
import { storeNameFor } from './store';

describe('memory store', () => {
  it('reads back what was written, with a new etag on every write', async () => {
    const store = createMemoryStore();
    expect(await store.read('k')).toBeNull();
    await store.write('k', { a: 1 });
    const first = await store.read('k');
    await store.write('k', { a: 2 });
    const second = await store.read('k');
    expect(first?.data).toEqual({ a: 1 });
    expect(second?.data).toEqual({ a: 2 });
    expect(first?.etag).not.toBe(second?.etag);
  });

  it('honours onlyIfNew and onlyIfMatch', async () => {
    const store = createMemoryStore();
    expect(await store.write('k', 1, { condition: { onlyIfMatch: '"0"' } })).toBe(false);
    expect(await store.write('k', 1, { condition: { onlyIfNew: true } })).toBe(true);
    expect(await store.write('k', 2, { condition: { onlyIfNew: true } })).toBe(false);
    const current = await store.read('k');
    expect(await store.write('k', 3, { condition: { onlyIfMatch: 'stale' } })).toBe(false);
    expect(await store.write('k', 3, { condition: { onlyIfMatch: current?.etag ?? '' } })).toBe(
      true,
    );
    expect((await store.read('k'))?.data).toBe(3);
  });

  it('keeps metadata, lists by prefix, deletes and clears', async () => {
    const store = createMemoryStore();
    await store.write('backup/a', 1, { metadata: { count: 3 } });
    await store.write('other', 1);
    expect(await store.readMetadata('backup/a')).toEqual({ count: 3 });
    expect(await store.readMetadata('other')).toEqual({});
    expect(await store.readMetadata('missing')).toBeNull();
    expect(await store.listKeys('backup/')).toEqual(['backup/a']);
    await store.delete('backup/a');
    expect(store.size).toBe(1);
    store.clear();
    expect(store.size).toBe(0);
  });

  it('returns copies, so callers cannot change what is stored', async () => {
    const store = createMemoryStore();
    await store.write('k', { list: [1] }, { metadata: { m: [1] } });
    const read = await store.read('k');
    (read?.data as { list: number[] }).list.push(2);
    const metadata = await store.readMetadata('k');
    (metadata?.m as number[]).push(2);
    expect((await store.read('k'))?.data).toEqual({ list: [1] });
    expect(await store.readMetadata('k')).toEqual({ m: [1] });
  });
});

describe('Netlify Blobs adapter', () => {
  function fakeBlobs(overrides: Partial<Record<keyof BlobsStore, unknown>> = {}) {
    const fake = {
      getWithMetadata: vi.fn(() => Promise.resolve({ data: { a: 1 }, etag: '"e1"', metadata: {} })),
      setJSON: vi.fn(() => Promise.resolve({ modified: true, etag: '"e2"' })),
      getMetadata: vi.fn(() => Promise.resolve({ etag: '"e1"', metadata: { count: 2 } })),
      list: vi.fn(() =>
        Promise.resolve({ blobs: [{ key: 'backup/2026-11-02', etag: '"x"' }], directories: [] }),
      ),
      delete: vi.fn(() => Promise.resolve()),
      ...overrides,
    };
    // The fake implements only the calls the adapter makes; Store's overloads are too wide to
    // satisfy with plain functions.
    return { fake, store: fromNetlifyStore(fake as unknown as BlobsStore) };
  }

  it('reads JSON with its etag', async () => {
    const { fake, store } = fakeBlobs();
    expect(await store.read('records')).toEqual({ data: { a: 1 }, etag: '"e1"' });
    expect(fake.getWithMetadata).toHaveBeenCalledWith('records', { type: 'json' });
  });

  it('returns null for a missing blob and fails without an etag', async () => {
    const missing = fakeBlobs({ getWithMetadata: () => Promise.resolve(null) });
    expect(await missing.store.read('records')).toBeNull();
    const noEtag = fakeBlobs({
      getWithMetadata: () => Promise.resolve({ data: {}, metadata: {} }),
    });
    await expect(noEtag.store.read('records')).rejects.toThrow('has no etag');
  });

  it('passes conditions and metadata to setJSON and reports `modified`', async () => {
    const { fake, store } = fakeBlobs({
      setJSON: vi.fn(() => Promise.resolve({ modified: false })),
    });
    expect(
      await store.write(
        'records',
        { b: 1 },
        { condition: { onlyIfMatch: '"e1"' }, metadata: { m: 1 } },
      ),
    ).toBe(false);
    expect(fake.setJSON).toHaveBeenCalledWith(
      'records',
      { b: 1 },
      { onlyIfMatch: '"e1"', metadata: { m: 1 } },
    );
    await store.write('backup/x', {});
    expect(fake.setJSON).toHaveBeenLastCalledWith('backup/x', {}, { metadata: undefined });
  });

  it('reads metadata, lists keys and deletes', async () => {
    const { fake, store } = fakeBlobs();
    expect(await store.readMetadata('backup/2026-11-02')).toEqual({ count: 2 });
    expect(await store.listKeys('backup/')).toEqual(['backup/2026-11-02']);
    expect(fake.list).toHaveBeenCalledWith({ prefix: 'backup/' });
    await store.delete('backup/2026-11-02');
    expect(fake.delete).toHaveBeenCalledWith('backup/2026-11-02');
    const none = fakeBlobs({ getMetadata: () => Promise.resolve(null) });
    expect(await none.store.readMetadata('k')).toBeNull();
  });
});

describe('storeNameFor', () => {
  it('keeps the real data in production only', () => {
    expect(storeNameFor('production')).toBe('certavi');
    expect(storeNameFor('branch-deploy')).toBe('certavi-branch-deploy');
    expect(storeNameFor('dev')).toBe('certavi-dev');
    expect(storeNameFor('Deploy Preview')).toBe('certavi-deploy-preview');
    expect(storeNameFor(undefined)).toBe('certavi-unknown');
    expect(storeNameFor('')).toBe('certavi-unknown');
  });
});

describe('auth helpers', () => {
  it('requires a secret of at least 32 characters', () => {
    expect(isSecretConfigured(undefined)).toBe(false);
    expect(isSecretConfigured('a'.repeat(31))).toBe(false);
    expect(isSecretConfigured('a'.repeat(32))).toBe(true);
  });

  it('reads a bearer token', () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('  BEARER   abc  ')).toBe('abc');
    expect(bearerToken('Bearer ')).toBeNull();
    expect(bearerToken('Basic abc')).toBeNull();
  });

  it('matches only the exact key', () => {
    const secret = 's'.repeat(40);
    expect(keyMatches(secret, secret)).toBe(true);
    expect(keyMatches(`${secret} `, secret)).toBe(false);
    expect(keyMatches('s', secret)).toBe(false);
    expect(keyMatches(null, secret)).toBe(false);
  });
});
