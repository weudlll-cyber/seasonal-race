/**
 * File: apps/web-viewer/src/studio-ui-state.ts
 * Model: GPT-5.3-Codex
 * Purpose: Applies current studio runtime state to UI controls and labels.
 * Usage: Imported by studio-app to keep UI synchronization logic centralized.
 */

import type { EditorDom } from './studio-dom.js';
import type { NameDisplayMode } from './replay-visual-policy.js';
import type { StudioTrackEditMode } from './studio-paths.js';
import type { BoundarySide } from './studio-preset-store.js';
import type { TrackOrientation } from './track-orientation.js';

export interface StudioUiStateSnapshot {
  trackEditMode: StudioTrackEditMode;
  trackOrientation: TrackOrientation;
  boundaryEditSide: BoundarySide;
  laneWidthPx: number;
  replayRacerCount: number;
  nameDisplayMode: NameDisplayMode;
  focusRacerNumber: number;
  playingPreview: boolean;
  smoothingEnabled: boolean;
  replayModeEnabled: boolean;
  laneBoardsVisible: boolean;
  broadcastViewEnabled: boolean;
}

export function applyStudioUiState(dom: EditorDom, state: StudioUiStateSnapshot): void {
  dom.trackEditModeSelect.value = state.trackEditMode;
  dom.trackOrientationSelect.value = state.trackOrientation;
  dom.boundaryEditSideSelect.value = state.boundaryEditSide;
  dom.boundaryEditSideSelect.disabled = state.trackEditMode !== 'boundaries';

  dom.laneWidthInput.value = String(state.laneWidthPx);
  dom.laneWidthValue.textContent = `${state.laneWidthPx} px`;

  dom.racerCountInput.value = String(state.replayRacerCount);
  dom.racerCountValue.textContent = String(state.replayRacerCount);

  dom.nameModeSelect.value = state.nameDisplayMode;
  dom.focusRacerInput.value = String(state.focusRacerNumber);
  dom.focusRacerLabel.textContent = `D${state.focusRacerNumber}`;

  dom.previewToggleButton.textContent = state.playingPreview ? 'Pause Preview' : 'Play Preview';
  dom.smoothToggleButton.textContent = `Smoothing: ${state.smoothingEnabled ? 'On' : 'Off'}`;
  dom.replayToggleButton.textContent = `Replay Test: ${state.replayModeEnabled ? 'On' : 'Off'}`;
  dom.laneBoardsToggleButton.textContent = `Lane Boards: ${state.laneBoardsVisible ? 'On' : 'Off'}`;
  dom.broadcastToggleButton.textContent = `Broadcast View: ${state.broadcastViewEnabled ? 'On' : 'Off'}`;
}
