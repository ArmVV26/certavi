// jsdom has no window.matchMedia. This fake answers `prefers-color-scheme` queries and lets tests
// flip the system setting with setSystemDark(), notifying listeners like a real browser does.

type ChangeListener = (event: MediaQueryListEvent) => void;

interface FakeQuery {
  media: string;
  listeners: Set<ChangeListener>;
}

let systemDark = false;
const queries = new Set<FakeQuery>();

function evaluate(media: string): boolean {
  if (media.includes('prefers-color-scheme: dark')) return systemDark;
  if (media.includes('prefers-color-scheme: light')) return !systemDark;
  return false;
}

function createMediaQueryList(media: string): MediaQueryList {
  const query: FakeQuery = { media, listeners: new Set() };
  queries.add(query);

  const add = (type: string, listener: ChangeListener) => {
    if (type === 'change') query.listeners.add(listener);
  };
  const remove = (type: string, listener: ChangeListener) => {
    if (type === 'change') query.listeners.delete(listener);
  };

  const list = {
    media,
    get matches() {
      return evaluate(media);
    },
    onchange: null,
    addEventListener: add,
    removeEventListener: remove,
    addListener: (listener: ChangeListener) => {
      add('change', listener);
    },
    removeListener: (listener: ChangeListener) => {
      remove('change', listener);
    },
    dispatchEvent: () => true,
  };
  // The fake implements the parts of MediaQueryList the app uses.
  return list as unknown as MediaQueryList;
}

export function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: createMediaQueryList,
  });
}

/** Changes the system colour scheme and fires `change` on every matching query. */
export function setSystemDark(dark: boolean): void {
  if (systemDark === dark) return;
  systemDark = dark;
  for (const query of queries) {
    if (!query.media.includes('prefers-color-scheme')) continue;
    const event = { matches: evaluate(query.media), media: query.media } as MediaQueryListEvent;
    for (const listener of query.listeners) listener(event);
  }
}

export function resetMatchMedia(): void {
  systemDark = false;
  queries.clear();
}
