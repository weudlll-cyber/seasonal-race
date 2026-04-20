/**
 * File: tests/studio-ui-state.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for studio UI state synchronization helper.
 * Usage: Runs with Vitest as part of studio refactor parity checks.
 */

import { describe, expect, it } from 'vitest';

import { applyStudioUiState } from '../apps/web-viewer/src/studio-ui-state';

function createElementWithText(): HTMLElement {
  return { textContent: '' } as HTMLElement;
}

describe('studio ui state helper', () => {
  it('applies values and toggle labels to dom controls', () => {
    const dom = {
      trackEditModeSelect: { value: '' },
      trackOrientationSelect: { value: '' },
      boundaryEditSideSelect: { value: '', disabled: false },
      laneWidthInput: { value: '' },
      laneWidthValue: createElementWithText(),
      racerCountInput: { value: '' },
      racerCountValue: createElementWithText(),
      nameModeSelect: { value: '' },
      focusRacerInput: { value: '' },
      focusRacerLabel: createElementWithText(),
      previewToggleButton: createElementWithText(),
      smoothToggleButton: createElementWithText(),
      replayToggleButton: createElementWithText(),
      laneBoardsToggleButton: createElementWithText(),
      broadcastToggleButton: createElementWithText()
    } as unknown;

    applyStudioUiState(dom as never, {
      trackEditMode: 'boundaries',
      trackOrientation: 'top-to-bottom',
      boundaryEditSide: 'right',
      laneWidthPx: 12,
      replayRacerCount: 64,
      nameDisplayMode: 'leaders-focus',
      focusRacerNumber: 3,
      playingPreview: false,
      smoothingEnabled: true,
      replayModeEnabled: true,
      laneBoardsVisible: false,
      broadcastViewEnabled: true
    });

    const typedDom = dom as {
      trackEditModeSelect: { value: string };
      trackOrientationSelect: { value: string };
      boundaryEditSideSelect: { value: string; disabled: boolean };
      laneWidthInput: { value: string };
      laneWidthValue: { textContent: string };
      racerCountInput: { value: string };
      racerCountValue: { textContent: string };
      nameModeSelect: { value: string };
      focusRacerInput: { value: string };
      focusRacerLabel: { textContent: string };
      previewToggleButton: { textContent: string };
      smoothToggleButton: { textContent: string };
      replayToggleButton: { textContent: string };
      laneBoardsToggleButton: { textContent: string };
      broadcastToggleButton: { textContent: string };
    };

    expect(typedDom.trackEditModeSelect.value).toBe('boundaries');
    expect(typedDom.trackOrientationSelect.value).toBe('top-to-bottom');
    expect(typedDom.boundaryEditSideSelect.value).toBe('right');
    expect(typedDom.boundaryEditSideSelect.disabled).toBe(false);
    expect(typedDom.laneWidthInput.value).toBe('12');
    expect(typedDom.laneWidthValue.textContent).toBe('12 px');
    expect(typedDom.racerCountInput.value).toBe('64');
    expect(typedDom.racerCountValue.textContent).toBe('64');
    expect(typedDom.focusRacerLabel.textContent).toBe('D3');
    expect(typedDom.previewToggleButton.textContent).toBe('Play Preview');
    expect(typedDom.smoothToggleButton.textContent).toBe('Smoothing: On');
    expect(typedDom.replayToggleButton.textContent).toBe('Replay Test: On');
    expect(typedDom.laneBoardsToggleButton.textContent).toBe('Lane Boards: Off');
    expect(typedDom.broadcastToggleButton.textContent).toBe('Broadcast View: On');
  });
});
