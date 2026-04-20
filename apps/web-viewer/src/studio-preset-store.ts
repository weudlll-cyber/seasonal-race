/**
 * File: apps/web-viewer/src/studio-preset-store.ts
 * Model: GPT-5.3-Codex
 * Purpose: Studio preset persistence helpers (localStorage + IndexedDB asset storage).
 * Usage: Imported by studio-app preset save/load/delete flows.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import type { NameDisplayMode } from './replay-visual-policy.js';
import type { StudioTrackEditMode } from './studio-paths.js';
import type { TrackOrientation } from './track-orientation.js';

const STUDIO_TEST_PRESET_STORAGE_KEY = 'seasonal-race:studio-test-presets:v2';
const STUDIO_PRESET_BACKGROUND_DB = 'seasonal-race-studio-preset-assets';
const STUDIO_PRESET_BACKGROUND_STORE = 'backgrounds';

export type BoundarySide = 'left' | 'right';

export interface StudioTestPreset {
  version: 1;
  trackId: string;
  trackName: string;
  effectProfileId: string;
  points: TrackPoint[];
  trackEditMode?: StudioTrackEditMode;
  trackOrientation?: TrackOrientation;
  boundaryEditSide?: BoundarySide;
  leftBoundaryPoints?: TrackPoint[];
  rightBoundaryPoints?: TrackPoint[];
  laneWidthPx: number;
  replayRacerCount: number;
  nameDisplayMode: NameDisplayMode;
  focusRacerNumber: number;
  playingPreview: boolean;
  smoothingEnabled: boolean;
  replayModeEnabled: boolean;
  laneBoardsVisible: boolean;
  backgroundImageDataUrl?: string;
  hasBackgroundImage?: boolean;
  editorGeometryMode?: 'geometry-rotated-v1';
}

export interface StudioTestPresetStore {
  version: 2;
  lastUsedPresetName?: string;
  presets: Record<string, StudioTestPreset>;
}

function createEmptyPresetStore(): StudioTestPresetStore {
  return { version: 2, presets: {} };
}

export function parsePresetStore(raw: string | null): StudioTestPresetStore {
  if (!raw) {
    return createEmptyPresetStore();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StudioTestPresetStore>;
    if (parsed.version !== 2 || typeof parsed.presets !== 'object' || parsed.presets === null) {
      return createEmptyPresetStore();
    }

    const store: StudioTestPresetStore = {
      version: 2,
      presets: parsed.presets as Record<string, StudioTestPreset>
    };
    if (typeof parsed.lastUsedPresetName === 'string' && parsed.lastUsedPresetName) {
      store.lastUsedPresetName = parsed.lastUsedPresetName;
    }
    return store;
  } catch {
    return createEmptyPresetStore();
  }
}

export function loadPresetStore(): StudioTestPresetStore {
  return parsePresetStore(localStorage.getItem(STUDIO_TEST_PRESET_STORAGE_KEY));
}

export function savePresetStore(store: StudioTestPresetStore): void {
  localStorage.setItem(STUDIO_TEST_PRESET_STORAGE_KEY, JSON.stringify(store));
}

export async function savePresetBackground(presetName: string, dataUrl: string): Promise<void> {
  const db = await openPresetBackgroundDb();
  await runBackgroundStoreRequest(db, 'readwrite', (store) => store.put(dataUrl, presetName));
}

export async function loadPresetBackground(presetName: string): Promise<string | null> {
  const db = await openPresetBackgroundDb();
  const value = await runBackgroundStoreRequest(db, 'readonly', (store) => store.get(presetName));
  return typeof value === 'string' ? value : null;
}

export async function deletePresetBackground(presetName: string): Promise<void> {
  const db = await openPresetBackgroundDb();
  await runBackgroundStoreRequest(db, 'readwrite', (store) => store.delete(presetName));
}

function openPresetBackgroundDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(STUDIO_PRESET_BACKGROUND_DB, 1);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STUDIO_PRESET_BACKGROUND_STORE)) {
        db.createObjectStore(STUDIO_PRESET_BACKGROUND_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function runBackgroundStoreRequest<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STUDIO_PRESET_BACKGROUND_STORE, mode);
    const store = tx.objectStore(STUDIO_PRESET_BACKGROUND_STORE);
    const request = run(store);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    request.onsuccess = () => resolve(request.result);
  });
}

export function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function listPresetNames(store: StudioTestPresetStore): string[] {
  return Object.keys(store.presets).sort((a, b) => a.localeCompare(b));
}

export function resolveSelectedPresetName(
  names: string[],
  preferredName: string | undefined,
  currentValue: string,
  lastUsedPresetName: string | undefined
): string {
  return (
    (preferredName && names.includes(preferredName) && preferredName) ||
    (currentValue && names.includes(currentValue) && currentValue) ||
    (lastUsedPresetName && names.includes(lastUsedPresetName) ? lastUsedPresetName : names[0]) ||
    ''
  );
}
