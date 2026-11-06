import { describe, expect, it, vi } from 'vitest';
import { downloadFile } from './download';

describe('downloadFile', () => {
  it('downloads the content through a temporary link and releases it afterwards', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:certavi/1');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this);
    });

    downloadFile({ fileName: 'certavi-sets.csv', mimeType: 'text/csv', content: 'a;b' });

    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.download).toBe('certavi-sets.csv');
    expect(clicks[0]?.href).toBe('blob:certavi/1');
    expect(clicks[0]?.isConnected).toBe(false);
    expect(createObjectURL.mock.calls[0]?.[0].type).toBe('text/csv');
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:certavi/1');
    vi.useRealTimers();
  });
});
