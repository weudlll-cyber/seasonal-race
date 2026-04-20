/**
 * File: apps/web-viewer/src/studio-preset-select-state.ts
 * Model: GPT-5.3-Codex
 * Purpose: Derives preset select list and selected item from preset store state.
 * Usage: Imported by studio-app for preset dropdown refresh behavior.
 */

import {
  listPresetNames,
  resolveSelectedPresetName,
  type StudioTestPresetStore
} from './studio-preset-store.js';

export interface PresetSelectState {
  names: string[];
  nextSelected: string;
}

export function buildPresetSelectState(
  store: StudioTestPresetStore,
  currentValue: string,
  preferredName?: string
): PresetSelectState {
  const names = listPresetNames(store);
  const nextSelected = resolveSelectedPresetName(
    names,
    preferredName,
    currentValue,
    store.lastUsedPresetName
  );
  return { names, nextSelected };
}
