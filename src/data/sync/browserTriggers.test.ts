import { describe, expect, it, vi } from 'vitest';
import { connectBrowserTriggers } from './browserTriggers';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('connectBrowserTriggers', () => {
  it('syncs on the page events of the contract and flushes when the page goes away', () => {
    const engine = { trigger: vi.fn(), flush: vi.fn(), wentOffline: vi.fn() };
    const disconnect = connectBrowserTriggers(engine, window);

    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));
    setVisibility('visible');
    expect(engine.trigger.mock.calls).toEqual([['online'], ['visible'], ['visible'], ['visible']]);

    window.dispatchEvent(new Event('offline'));
    expect(engine.wentOffline).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    window.dispatchEvent(new Event('pagehide'));
    expect(engine.flush).toHaveBeenCalledTimes(2);

    disconnect();
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('offline'));
    setVisibility('visible');
    expect(engine.trigger).toHaveBeenCalledTimes(4);
    expect(engine.flush).toHaveBeenCalledTimes(2);
    expect(engine.wentOffline).toHaveBeenCalledTimes(1);
  });
});
