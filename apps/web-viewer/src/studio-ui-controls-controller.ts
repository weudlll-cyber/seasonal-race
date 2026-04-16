/**
 * File: apps/web-viewer/src/studio-ui-controls-controller.ts
 * Model: GPT-5.3-Codex
 * Purpose: Encapsulates studio UI control event wiring for toggles and range/select inputs.
 * Usage: Wire once from studio app and pass callbacks for state updates and side effects.
 */

interface StudioUiControls {
  previewToggleButton: HTMLButtonElement;
  smoothToggleButton: HTMLButtonElement;
  replayToggleButton: HTMLButtonElement;
  laneWidthInput: HTMLInputElement;
  laneWidthValue: HTMLElement;
  racerCountInput: HTMLInputElement;
  racerCountValue: HTMLElement;
  nameModeSelect: HTMLSelectElement;
  focusRacerInput: HTMLInputElement;
  focusRacerLabel: HTMLElement;
  laneBoardsToggleButton: HTMLButtonElement;
  broadcastToggleButton: HTMLButtonElement;
  editorHelp: HTMLElement;
}

export interface StudioUiControlsControllerOptions {
  controls: StudioUiControls;
  getPlayingPreview: () => boolean;
  setPlayingPreview: (value: boolean) => void;
  getSmoothingEnabled: () => boolean;
  setSmoothingEnabled: (value: boolean) => void;
  onSmoothingChanged: () => void;
  getReplayModeEnabled: () => boolean;
  setReplayModeEnabled: (value: boolean) => void;
  onReplayModeChanged: (enabled: boolean) => void;
  onLaneWidthChanged: (value: number) => void;
  onRacerCountChanged: (value: number) => void;
  onNameModeChanged: (value: string) => void;
  onFocusRacerInput: (value: number) => number;
  getLaneBoardsVisible: () => boolean;
  setLaneBoardsVisible: (value: boolean) => void;
  getBroadcastViewEnabled: () => boolean;
  setBroadcastViewEnabled: (value: boolean) => void;
  onBroadcastModeChanged: (enabled: boolean) => void;
}

export function wireStudioUiControlsController(options: StudioUiControlsControllerOptions): void {
  const {
    controls,
    getPlayingPreview,
    setPlayingPreview,
    getSmoothingEnabled,
    setSmoothingEnabled,
    onSmoothingChanged,
    getReplayModeEnabled,
    setReplayModeEnabled,
    onReplayModeChanged,
    onLaneWidthChanged,
    onRacerCountChanged,
    onNameModeChanged,
    onFocusRacerInput,
    getLaneBoardsVisible,
    setLaneBoardsVisible,
    getBroadcastViewEnabled,
    setBroadcastViewEnabled,
    onBroadcastModeChanged
  } = options;

  controls.previewToggleButton.addEventListener('click', () => {
    const next = !getPlayingPreview();
    setPlayingPreview(next);
    controls.previewToggleButton.textContent = next ? 'Pause Preview' : 'Play Preview';
  });

  controls.smoothToggleButton.addEventListener('click', () => {
    const next = !getSmoothingEnabled();
    setSmoothingEnabled(next);
    controls.smoothToggleButton.textContent = next ? 'Smoothing: On' : 'Smoothing: Off';
    onSmoothingChanged();
  });

  controls.replayToggleButton.addEventListener('click', () => {
    const next = !getReplayModeEnabled();
    setReplayModeEnabled(next);
    controls.replayToggleButton.textContent = next ? 'Replay Test: On' : 'Replay Test: Off';

    controls.editorHelp.textContent = next
      ? 'Replay test active: generated recorded-race frames are playing on your track. Use lane width to tune river fit.'
      : 'Replay test disabled: single runner preview active.';

    onReplayModeChanged(next);
  });

  controls.laneWidthInput.addEventListener('input', () => {
    const value = Number(controls.laneWidthInput.value);
    controls.laneWidthValue.textContent = `${value} px`;
    onLaneWidthChanged(value);
  });

  controls.racerCountInput.addEventListener('input', () => {
    const value = Number(controls.racerCountInput.value);
    controls.racerCountValue.textContent = String(value);
    onRacerCountChanged(value);
  });

  controls.nameModeSelect.addEventListener('change', () => {
    onNameModeChanged(controls.nameModeSelect.value);
  });

  controls.focusRacerInput.addEventListener('input', () => {
    const normalized = onFocusRacerInput(Number(controls.focusRacerInput.value));
    controls.focusRacerInput.value = String(normalized);
    controls.focusRacerLabel.textContent = `D${normalized}`;
  });

  controls.laneBoardsToggleButton.addEventListener('click', () => {
    const next = !getLaneBoardsVisible();
    setLaneBoardsVisible(next);
    controls.laneBoardsToggleButton.textContent = next ? 'Lane Boards: On' : 'Lane Boards: Off';
  });

  controls.broadcastToggleButton.addEventListener('click', () => {
    const next = !getBroadcastViewEnabled();
    setBroadcastViewEnabled(next);
    controls.broadcastToggleButton.textContent = next
      ? 'Broadcast View: On'
      : 'Broadcast View: Off';

    controls.editorHelp.textContent = next
      ? 'Broadcast view active: camera follows the race like final player view.'
      : 'Editor view active: full track + points for editing.';

    onBroadcastModeChanged(next);
  });
}
