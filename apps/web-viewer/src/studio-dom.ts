/**
 * File: apps/web-viewer/src/studio-dom.ts
 * Model: GPT-5.3-Codex
 * Purpose: Resolves and validates studio DOM controls used by the track editor surface.
 * Usage: Imported by studio app orchestrators to avoid duplicating DOM wiring.
 */

import { DEFAULT_EDITOR_TRACK_ID, DEFAULT_EDITOR_TRACK_NAME } from './track-editor-utils.js';

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
  surfaceRaceTypeSelect: HTMLSelectElement;
  surfaceCategorySelect: HTMLSelectElement;
  surfaceSizeClassSelect: HTMLSelectElement;
  surfaceProfileSelect: HTMLSelectElement;
  trackPreviewSizeInput: HTMLInputElement;
  trackPreviewSizeValue: HTMLElement;
  spriteSourceImageInput: HTMLInputElement;
  spriteFrameCountInput: HTMLInputElement;
  spriteFrameCountValue: HTMLElement;
  spriteVariantCountInput: HTMLInputElement;
  spriteVariantCountValue: HTMLElement;
  spritePresetMinimalButton: HTMLButtonElement | null;
  spritePresetBalancedButton: HTMLButtonElement | null;
  spritePresetMaxContrastButton: HTMLButtonElement | null;
  spriteGenerationWarning: HTMLElement;
  generateSpriteSheetButton: HTMLButtonElement;
  spriteSheetPreview: HTMLImageElement;
  spritePackAnimPreviewCanvas: HTMLCanvasElement;
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

  const byIdOptional = <T extends HTMLElement>(id: string): T | null => {
    const node = document.getElementById(id);
    return node ? (node as T) : null;
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
    surfaceRaceTypeSelect: byId<HTMLSelectElement>('surface-race-type-select'),
    surfaceCategorySelect: byId<HTMLSelectElement>('surface-category-select'),
    surfaceSizeClassSelect: byId<HTMLSelectElement>('surface-size-class-select'),
    surfaceProfileSelect: byId<HTMLSelectElement>('surface-profile-select'),
    trackPreviewSizeInput: byId<HTMLInputElement>('track-preview-size-input'),
    trackPreviewSizeValue: byId<HTMLElement>('track-preview-size-value'),
    spriteSourceImageInput: byId<HTMLInputElement>('sprite-source-image-input'),
    spriteFrameCountInput: byId<HTMLInputElement>('sprite-frame-count-input'),
    spriteFrameCountValue: byId<HTMLElement>('sprite-frame-count-value'),
    spriteVariantCountInput: byId<HTMLInputElement>('sprite-variant-count-input'),
    spriteVariantCountValue: byId<HTMLElement>('sprite-variant-count-value'),
    spritePresetMinimalButton: byIdOptional<HTMLButtonElement>('sprite-preset-minimal-btn'),
    spritePresetBalancedButton: byIdOptional<HTMLButtonElement>('sprite-preset-balanced-btn'),
    spritePresetMaxContrastButton: byIdOptional<HTMLButtonElement>(
      'sprite-preset-max-contrast-btn'
    ),
    spriteGenerationWarning: byId<HTMLElement>('sprite-generation-warning'),
    generateSpriteSheetButton: byId<HTMLButtonElement>('generate-sprite-sheet-btn'),
    spriteSheetPreview: byId<HTMLImageElement>('sprite-sheet-preview'),
    spritePackAnimPreviewCanvas: byId<HTMLCanvasElement>('sprite-pack-anim-preview'),
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
