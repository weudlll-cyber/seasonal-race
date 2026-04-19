/**
 * File: apps/web-viewer/src/studio-dom.ts
 * Model: GPT-5.3-Codex
 * Purpose: Resolves and validates studio DOM controls used by the track editor surface.
 * Usage: Imported by studio app orchestrators to avoid duplicating DOM wiring.
 */

import { DEFAULT_EDITOR_TRACK_ID, DEFAULT_EDITOR_TRACK_NAME } from './track-editor-utils';

export interface EditorDom {
  trackIdInput: HTMLInputElement;
  trackNameInput: HTMLInputElement;
  effectProfileInput: HTMLInputElement;
  backgroundImageInput: HTMLInputElement;
  trackEditModeSelect: HTMLSelectElement;
  trackOrientationSelect: HTMLSelectElement;
  boundaryEditSideSelect: HTMLSelectElement;
  laneWidthInput: HTMLInputElement;
  laneWidthValue: HTMLElement;
  racerCountInput: HTMLInputElement;
  racerCountValue: HTMLElement;
  nameModeSelect: HTMLSelectElement;
  focusRacerInput: HTMLInputElement;
  focusRacerLabel: HTMLElement;
  leaderboardList: HTMLElement;
  pointCountLabel: HTMLElement;
  trackLengthLabel: HTMLElement;
  previewToggleButton: HTMLButtonElement;
  smoothToggleButton: HTMLButtonElement;
  replayToggleButton: HTMLButtonElement;
  laneBoardsToggleButton: HTMLButtonElement;
  broadcastToggleButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  clearImageButton: HTMLButtonElement;
  loadCurvyButton: HTMLButtonElement;
  loadStraightButton: HTMLButtonElement;
  copyJsonButton: HTMLButtonElement;
  downloadJsonButton: HTMLButtonElement;
  loadJsonButton: HTMLButtonElement;
  presetNameInput: HTMLInputElement;
  presetSelect: HTMLSelectElement;
  savePresetButton: HTMLButtonElement;
  loadPresetButton: HTMLButtonElement;
  deletePresetButton: HTMLButtonElement;
  editorHelp: HTMLElement;
  jsonOutput: HTMLTextAreaElement;
}

export function resolveStudioDom(): EditorDom {
  const byId = <T extends HTMLElement>(id: string): T => {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing required element #${id}`);
    return node as T;
  };

  const trackIdInput = byId<HTMLInputElement>('track-id-input');
  if (!trackIdInput.value.trim()) {
    trackIdInput.value = DEFAULT_EDITOR_TRACK_ID;
  }

  const trackNameInput = byId<HTMLInputElement>('track-name-input');
  if (!trackNameInput.value.trim()) {
    trackNameInput.value = DEFAULT_EDITOR_TRACK_NAME;
  }

  return {
    trackIdInput,
    trackNameInput,
    effectProfileInput: byId<HTMLInputElement>('effect-profile-input'),
    backgroundImageInput: byId<HTMLInputElement>('background-image-input'),
    trackEditModeSelect: byId<HTMLSelectElement>('track-edit-mode-select'),
    trackOrientationSelect: byId<HTMLSelectElement>('track-orientation-select'),
    boundaryEditSideSelect: byId<HTMLSelectElement>('boundary-edit-side-select'),
    laneWidthInput: byId<HTMLInputElement>('lane-width-input'),
    laneWidthValue: byId<HTMLElement>('lane-width-value'),
    racerCountInput: byId<HTMLInputElement>('racer-count-input'),
    racerCountValue: byId<HTMLElement>('racer-count-value'),
    nameModeSelect: byId<HTMLSelectElement>('name-mode-select'),
    focusRacerInput: byId<HTMLInputElement>('focus-racer-input'),
    focusRacerLabel: byId<HTMLElement>('focus-racer-label'),
    leaderboardList: byId<HTMLElement>('leaderboard-list'),
    pointCountLabel: byId<HTMLElement>('point-count-value'),
    trackLengthLabel: byId<HTMLElement>('track-length-value'),
    previewToggleButton: byId<HTMLButtonElement>('preview-toggle-btn'),
    smoothToggleButton: byId<HTMLButtonElement>('smooth-toggle-btn'),
    replayToggleButton: byId<HTMLButtonElement>('replay-toggle-btn'),
    laneBoardsToggleButton: byId<HTMLButtonElement>('lane-boards-toggle-btn'),
    broadcastToggleButton: byId<HTMLButtonElement>('broadcast-toggle-btn'),
    clearButton: byId<HTMLButtonElement>('clear-btn'),
    undoButton: byId<HTMLButtonElement>('undo-btn'),
    clearImageButton: byId<HTMLButtonElement>('clear-image-btn'),
    loadCurvyButton: byId<HTMLButtonElement>('load-curvy-btn'),
    loadStraightButton: byId<HTMLButtonElement>('load-straight-btn'),
    copyJsonButton: byId<HTMLButtonElement>('copy-json-btn'),
    downloadJsonButton: byId<HTMLButtonElement>('download-json-btn'),
    loadJsonButton: byId<HTMLButtonElement>('load-json-btn'),
    presetNameInput: byId<HTMLInputElement>('preset-name-input'),
    presetSelect: byId<HTMLSelectElement>('preset-select'),
    savePresetButton: byId<HTMLButtonElement>('save-preset-btn'),
    loadPresetButton: byId<HTMLButtonElement>('load-preset-btn'),
    deletePresetButton: byId<HTMLButtonElement>('delete-preset-btn'),
    editorHelp: byId<HTMLElement>('editor-help-text'),
    jsonOutput: byId<HTMLTextAreaElement>('track-json-output')
  };
}
