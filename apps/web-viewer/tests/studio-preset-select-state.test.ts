/**
 * File: apps/web-viewer/tests/studio-preset-select-state.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for studio preset select state helper.
 * Usage: Runs in Vitest as part of web-viewer tests.
 */

import { describe, expect, it } from 'vitest';
import { buildPresetSelectState } from '../src/studio-preset-select-state.js';
import type { StudioTestPreset, StudioTestPresetStore } from '../src/studio-preset-store.js';

function makeStore(names: string[], lastUsedPresetName?: string): StudioTestPresetStore {
  const basePreset: StudioTestPreset = {
    version: 1,
    trackId: 'track',
    trackName: 'Track',
    effectProfileId: '',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 }
    ],
    laneWidthPx: 6,
    replayRacerCount: 4,
    nameDisplayMode: 'leaders-focus',
    focusRacerNumber: 1,
    playingPreview: true,
    smoothingEnabled: true,
    replayModeEnabled: false,
    laneBoardsVisible: false
  };
  const presets = Object.fromEntries(names.map((name) => [name, basePreset]));
  return {
    version: 2,
    presets,
    ...(lastUsedPresetName ? { lastUsedPresetName } : {})
  };
}

describe('buildPresetSelectState', () => {
  it('prefers an explicit preferred preset name when present', () => {
    const store = makeStore(['alpha', 'beta', 'gamma'], 'beta');

    const state = buildPresetSelectState(store, 'alpha', 'gamma');

    expect(state.names).toEqual(['alpha', 'beta', 'gamma']);
    expect(state.nextSelected).toBe('gamma');
  });

  it('falls back to current select value when preferred name is missing', () => {
    const store = makeStore(['alpha', 'beta', 'gamma'], 'gamma');

    const state = buildPresetSelectState(store, 'beta', 'missing');

    expect(state.nextSelected).toBe('beta');
  });

  it('falls back to last used preset and then first preset', () => {
    const withLastUsed = makeStore(['alpha', 'beta', 'gamma'], 'gamma');
    const fromLastUsed = buildPresetSelectState(withLastUsed, '', undefined);
    expect(fromLastUsed.nextSelected).toBe('gamma');

    const noLastUsed = makeStore(['alpha', 'beta', 'gamma']);
    const fromFirst = buildPresetSelectState(noLastUsed, '', undefined);
    expect(fromFirst.nextSelected).toBe('alpha');
  });

  it('returns an empty selection when no presets exist', () => {
    const store = makeStore([]);

    const state = buildPresetSelectState(store, 'alpha', 'beta');

    expect(state.names).toEqual([]);
    expect(state.nextSelected).toBe('');
  });
});
