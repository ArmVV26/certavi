import type { ExportFile } from '../../data/exportFile';

/** Hands a generated file to the browser as a download. */
export function downloadFile({ fileName, mimeType, content }: ExportFile): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing the file.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
