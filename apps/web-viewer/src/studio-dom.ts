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
  editorZoomInput: HTMLInputElement;
  editorZoomValue: HTMLElement;
  trackTemplateSelect: HTMLSelectElement;
  trackTemplatePointsInput: HTMLInputElement;
  trackTemplatePointsValue: HTMLElement;
  generateTrackTemplateButton: HTMLButtonElement;
  spriteSourceImageInput: HTMLInputElement;
  spriteFrameCountInput: HTMLInputElement;
  spriteFrameCountValue: HTMLElement;
  spriteVariantCountInput: HTMLInputElement;
  spriteVariantCountValue: HTMLElement;
  spritePresetMinimalButton: HTMLButtonElement;
  spritePresetBalancedButton: HTMLButtonElement;
  spritePresetMaxContrastButton: HTMLButtonElement;
  generateSpriteSheetButton: HTMLButtonElement;
  spriteSheetPreview: HTMLImageElement;
  downloadSpriteSheetButton: HTMLButtonElement;
  downloadSpriteMetaButton: HTMLButtonElement;
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
  zoomResetButton: HTMLButtonElement;
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
    editorZoomInput: byId<HTMLInputElement>('editor-zoom-input'),
    editorZoomValue: byId<HTMLElement>('editor-zoom-value'),
    trackTemplateSelect: byId<HTMLSelectElement>('track-template-select'),
    trackTemplatePointsInput: byId<HTMLInputElement>('track-template-points-input'),
    trackTemplatePointsValue: byId<HTMLElement>('track-template-points-value'),
    generateTrackTemplateButton: byId<HTMLButtonElement>('generate-track-template-btn'),
    spriteSourceImageInput: byId<HTMLInputElement>('sprite-source-image-input'),
    spriteFrameCountInput: byId<HTMLInputElement>('sprite-frame-count-input'),
    spriteFrameCountValue: byId<HTMLElement>('sprite-frame-count-value'),
    spriteVariantCountInput: byId<HTMLInputElement>('sprite-variant-count-input'),
    spriteVariantCountValue: byId<HTMLElement>('sprite-variant-count-value'),
    spritePresetMinimalButton: byId<HTMLButtonElement>('sprite-preset-minimal-btn'),
    spritePresetBalancedButton: byId<HTMLButtonElement>('sprite-preset-balanced-btn'),
    spritePresetMaxContrastButton: byId<HTMLButtonElement>('sprite-preset-max-contrast-btn'),
    generateSpriteSheetButton: byId<HTMLButtonElement>('generate-sprite-sheet-btn'),
    spriteSheetPreview: byId<HTMLImageElement>('sprite-sheet-preview'),
    downloadSpriteSheetButton: byId<HTMLButtonElement>('download-sprite-sheet-btn'),
    downloadSpriteMetaButton: byId<HTMLButtonElement>('download-sprite-meta-btn'),
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
    zoomResetButton: byId<HTMLButtonElement>('zoom-reset-btn'),
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
