/**
 * File: apps/web-viewer/src/studio-file-utils.ts
 * Model: GPT-5.3-Codex
 * Purpose: Browser file and image utility helpers for studio workflows.
 * Usage: Imported by studio-app for JSON/image download and local image loading.
 */

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load selected image.'));
    };
    image.src = url;
  });
}
