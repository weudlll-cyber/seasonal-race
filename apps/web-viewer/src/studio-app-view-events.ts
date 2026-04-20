/**
 * File: apps/web-viewer/src/studio-app-view-events.ts
 * Model: GPT-5.3-Codex
 * Purpose: Wires studio view/broadcast and editor zoom related DOM/window events.
 * Usage: Imported by studio-app to keep orchestration setup focused.
 */

import type { EditorDom } from './studio-dom.js';

interface WireBroadcastWindowEventsOptions {
  dom: Pick<EditorDom, 'broadcastToggleButton' | 'editorHelp'>;
  getBroadcastViewEnabled: () => boolean;
  setBroadcastViewEnabled: (value: boolean) => void;
  applyViewMode: () => void;
}

interface WireEditorZoomEventsOptions {
  dom: Pick<EditorDom, 'editorZoomInput' | 'zoomResetButton' | 'editorHelp'>;
  getBroadcastViewEnabled: () => boolean;
  getScreenWidth: () => number;
  getScreenHeight: () => number;
  getEditorZoom: () => number;
  setEditorZoomAroundScreenPoint: (nextZoom: number, screenX: number, screenY: number) => void;
  resetEditorView: () => void;
  editorCanvas: HTMLCanvasElement | undefined;
}

export function wireStudioBroadcastWindowEvents(options: WireBroadcastWindowEventsOptions): void {
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !options.getBroadcastViewEnabled()) return;

    options.setBroadcastViewEnabled(false);
    options.dom.broadcastToggleButton.textContent = 'Broadcast View: Off';
    options.dom.editorHelp.textContent = 'Editor view active: full track + points for editing.';
    options.applyViewMode();
  });

  window.addEventListener('resize', () => {
    if (!options.getBroadcastViewEnabled()) return;
    options.applyViewMode();
  });
}

export function wireStudioEditorZoomEvents(options: WireEditorZoomEventsOptions): void {
  options.dom.editorZoomInput.addEventListener('input', () => {
    const nextZoom = Number(options.dom.editorZoomInput.value) / 100;
    options.setEditorZoomAroundScreenPoint(
      nextZoom,
      options.getScreenWidth() * 0.5,
      options.getScreenHeight() * 0.5
    );
  });

  options.dom.zoomResetButton.addEventListener('click', () => {
    options.resetEditorView();
    options.dom.editorHelp.textContent = 'Editor zoom reset to 100%.';
  });

  if (options.editorCanvas) {
    options.editorCanvas.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        if (options.getBroadcastViewEnabled()) {
          return;
        }

        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
        options.setEditorZoomAroundScreenPoint(
          options.getEditorZoom() * zoomFactor,
          event.offsetX,
          event.offsetY
        );
      },
      { passive: false }
    );
  }
}
