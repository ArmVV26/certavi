// Wires the sync engine to the page lifecycle (docs/api/sync-v1.md §8 "Triggers" and "Flush on
// exit"). Returns a function that removes every listener.
import type { SyncEngine } from './engine';

export function connectBrowserTriggers(
  engine: Pick<SyncEngine, 'trigger' | 'flush' | 'wentOffline'>,
  win: Window,
): () => void {
  const doc = win.document;
  const onOnline = () => {
    engine.trigger('online');
  };
  const onOffline = () => {
    engine.wentOffline();
  };
  const onVisible = () => {
    engine.trigger('visible');
  };
  const onVisibility = () => {
    if (doc.visibilityState === 'visible') engine.trigger('visible');
    else engine.flush();
  };
  const onPageHide = () => {
    engine.flush();
  };

  win.addEventListener('online', onOnline);
  win.addEventListener('offline', onOffline);
  win.addEventListener('focus', onVisible);
  win.addEventListener('pageshow', onVisible);
  win.addEventListener('pagehide', onPageHide);
  doc.addEventListener('visibilitychange', onVisibility);

  return () => {
    win.removeEventListener('online', onOnline);
    win.removeEventListener('offline', onOffline);
    win.removeEventListener('focus', onVisible);
    win.removeEventListener('pageshow', onVisible);
    win.removeEventListener('pagehide', onPageHide);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}
