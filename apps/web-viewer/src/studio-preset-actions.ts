/**
 * File: apps/web-viewer/src/studio-preset-actions.ts
 * Model: GPT-5.3-Codex
 * Purpose: Encapsulates studio preset build/save/load/delete behavior.
 * Usage: Used by studio-app to keep preset lifecycle logic out of app orchestration flow.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import {
  clampInteger,
  deletePresetBackground,
  loadPresetStore,
  savePresetBackground,
  savePresetStore,
  type BoundarySide,
  type StudioTestPreset,
  type StudioTestPresetStore
} from './studio-preset-store.js';
import { round3 } from './studio-editor-helpers.js';
import {
  normalizeFocusRacerNumber,
  toNameDisplayMode,
  type NameDisplayMode
} from './replay-visual-policy.js';
import { buildCenterlineFromBoundaries, type StudioTrackEditMode } from './studio-paths.js';
import { rotateStudioGeometry } from './studio-geometry-state.js';
import { normalizeTrackOrientation, type TrackOrientation } from './track-orientation.js';
import { ensureBoundaryPointsFromCenterline as ensureBoundaryPointsFromCenterlineState } from './studio-track-edit-helpers.js';

export interface BuildStudioPresetFromStateInput {
  trackId: string;
  trackName: string;
  effectProfileId: string;
  points: TrackPoint[];
  trackEditMode: StudioTrackEditMode;
  trackOrientation: TrackOrientation;
  boundaryEditSide: BoundarySide;
  leftBoundaryPoints: TrackPoint[];
  rightBoundaryPoints: TrackPoint[];
  laneWidthPx: number;
  replayRacerCount: number;
  nameDisplayMode: NameDisplayMode;
  focusRacerNumber: number;
  playingPreview: boolean;
  smoothingEnabled: boolean;
  replayModeEnabled: boolean;
  laneBoardsVisible: boolean;
  backgroundImageDataUrl: string | null;
  fallbackTrackId: string;
  fallbackTrackName: string;
}

export interface PersistStudioPresetInput {
  presetName: string;
  preset: StudioTestPreset;
}

export interface PresetActionResult {
  message: string;
  preferredName?: string;
}

export interface LookupStudioPresetResult {
  ok: boolean;
  store: StudioTestPresetStore;
  parsed?: Partial<StudioTestPreset>;
}

export interface NormalizeLoadedStudioPresetInput {
  parsed: Partial<StudioTestPreset>;
  fallbackPoints: TrackPoint[];
  defaults: {
    laneWidthPx: number;
    replayRacerCount: number;
    nameDisplayMode: NameDisplayMode;
    focusRacerNumber: number;
    fallbackTrackId: string;
    fallbackTrackName: string;
  };
}

export interface NormalizedLoadedStudioPreset {
  points: TrackPoint[];
  trackEditMode: StudioTrackEditMode;
  trackOrientation: TrackOrientation;
  boundaryEditSide: BoundarySide;
  leftBoundaryPoints: TrackPoint[];
  rightBoundaryPoints: TrackPoint[];
  trackId: string;
  trackName: string;
  effectProfileId: string;
  laneWidthPx: number;
  replayRacerCount: number;
  nameDisplayMode: NameDisplayMode;
  focusRacerNumber: number;
  playingPreview: boolean;
  smoothingEnabled: boolean;
  replayModeEnabled: boolean;
  laneBoardsVisible: boolean;
  inlineBackgroundDataUrl: string | null;
  hasBackgroundImage: boolean;
}

function toRoundedPointList(points: TrackPoint[]): TrackPoint[] {
  return points.map((point) => ({ x: round3(Number(point.x)), y: round3(Number(point.y)) }));
}

export function buildStudioPresetFromState(
  input: BuildStudioPresetFromStateInput
): StudioTestPreset {
  const preset: StudioTestPreset = {
    version: 1,
    trackId: input.trackId.trim() || input.fallbackTrackId,
    trackName: input.trackName.trim() || input.fallbackTrackName,
    effectProfileId: input.effectProfileId.trim(),
    points: input.points.map((point) => ({ x: round3(point.x), y: round3(point.y) })),
    trackEditMode: input.trackEditMode,
    trackOrientation: input.trackOrientation,
    boundaryEditSide: input.boundaryEditSide,
    leftBoundaryPoints: input.leftBoundaryPoints.map((point) => ({
      x: round3(point.x),
      y: round3(point.y)
    })),
    rightBoundaryPoints: input.rightBoundaryPoints.map((point) => ({
      x: round3(point.x),
      y: round3(point.y)
    })),
    laneWidthPx: input.laneWidthPx,
    replayRacerCount: input.replayRacerCount,
    nameDisplayMode: input.nameDisplayMode,
    focusRacerNumber: input.focusRacerNumber,
    playingPreview: input.playingPreview,
    smoothingEnabled: input.smoothingEnabled,
    replayModeEnabled: input.replayModeEnabled,
    laneBoardsVisible: input.laneBoardsVisible,
    editorGeometryMode: 'geometry-rotated-v1'
  };

  if (input.backgroundImageDataUrl) {
    preset.backgroundImageDataUrl = input.backgroundImageDataUrl;
  }

  return preset;
}

export async function persistStudioPreset(
  input: PersistStudioPresetInput
): Promise<PresetActionResult> {
  const { presetName, preset } = input;
  const store = loadPresetStore();

  const backgroundDataUrl = preset.backgroundImageDataUrl;
  const storedPreset: StudioTestPreset = { ...preset };
  delete storedPreset.backgroundImageDataUrl;
  storedPreset.hasBackgroundImage = Boolean(backgroundDataUrl);
  store.presets[presetName] = storedPreset;
  store.lastUsedPresetName = presetName;

  if (backgroundDataUrl) {
    try {
      await savePresetBackground(presetName, backgroundDataUrl);
    } catch {
      // Keep backward-compatible fallback for environments without IndexedDB.
      storedPreset.backgroundImageDataUrl = backgroundDataUrl;
      delete storedPreset.hasBackgroundImage;
    }
  } else {
    try {
      await deletePresetBackground(presetName);
    } catch {
      // Ignore cleanup failures.
    }
  }

  try {
    savePresetStore(store);
    return { message: `Preset "${presetName}" saved.`, preferredName: presetName };
  } catch {
    // If quota is exceeded by image-heavy preset, retry once without background data.
  }

  if (backgroundDataUrl) {
    const lightweightPreset: StudioTestPreset = { ...storedPreset };
    delete lightweightPreset.backgroundImageDataUrl;
    delete lightweightPreset.hasBackgroundImage;
    store.presets[presetName] = lightweightPreset;
    try {
      savePresetStore(store);
      return {
        message: `Preset "${presetName}" saved, but background image could not be stored due to browser storage limits.`,
        preferredName: presetName
      };
    } catch {
      // Continue to generic error message below.
    }
  }

  return {
    message: 'Could not save test preset (browser storage may be full or blocked).'
  };
}

export function lookupStudioPreset(presetName: string): LookupStudioPresetResult {
  const store = loadPresetStore();
  const parsed = store.presets[presetName] as Partial<StudioTestPreset> | undefined;
  if (!parsed) {
    return { ok: false, store };
  }
  return { ok: true, store, parsed };
}

export function normalizeLoadedStudioPreset(
  input: NormalizeLoadedStudioPresetInput
): NormalizedLoadedStudioPreset {
  const { parsed, defaults, fallbackPoints } = input;

  if (!Array.isArray(parsed.points) || parsed.points.length < 3) {
    throw new Error('Invalid preset points');
  }

  let points = toRoundedPointList(parsed.points);
  const trackEditMode: StudioTrackEditMode =
    parsed.trackEditMode === 'boundaries' ? 'boundaries' : 'centerline';
  const nextOrientation = normalizeTrackOrientation(parsed.trackOrientation);
  const boundaryEditSide: BoundarySide = parsed.boundaryEditSide === 'right' ? 'right' : 'left';
  let leftBoundaryPoints = Array.isArray(parsed.leftBoundaryPoints)
    ? toRoundedPointList(parsed.leftBoundaryPoints)
    : [];
  let rightBoundaryPoints = Array.isArray(parsed.rightBoundaryPoints)
    ? toRoundedPointList(parsed.rightBoundaryPoints)
    : [];

  if (trackEditMode === 'boundaries') {
    const ensured = ensureBoundaryPointsFromCenterlineState({
      leftBoundaryPoints,
      rightBoundaryPoints,
      points,
      fallbackPoints,
      halfWidthPx: defaults.laneWidthPx * 8
    });
    leftBoundaryPoints = ensured.leftBoundaryPoints;
    rightBoundaryPoints = ensured.rightBoundaryPoints;
    points = buildCenterlineFromBoundaries(leftBoundaryPoints, rightBoundaryPoints);
  }

  if (nextOrientation === 'top-to-bottom' && parsed.editorGeometryMode !== 'geometry-rotated-v1') {
    const rotated = rotateStudioGeometry(
      { points, leftBoundaryPoints, rightBoundaryPoints },
      'left-to-right',
      'top-to-bottom'
    );
    points = rotated.points;
    leftBoundaryPoints = rotated.leftBoundaryPoints;
    rightBoundaryPoints = rotated.rightBoundaryPoints;
  }

  const laneWidthPx = clampInteger(Number(parsed.laneWidthPx), 1, 24, defaults.laneWidthPx);
  const replayRacerCount = clampInteger(
    Number(parsed.replayRacerCount),
    2,
    100,
    defaults.replayRacerCount
  );
  const nameDisplayMode = toNameDisplayMode(
    String(parsed.nameDisplayMode ?? defaults.nameDisplayMode)
  );
  const focusRacerNumber = normalizeFocusRacerNumber(
    Number(parsed.focusRacerNumber ?? defaults.focusRacerNumber),
    replayRacerCount
  );

  return {
    points,
    trackEditMode,
    trackOrientation: nextOrientation,
    boundaryEditSide,
    leftBoundaryPoints,
    rightBoundaryPoints,
    trackId: (parsed.trackId ?? defaults.fallbackTrackId).trim() || defaults.fallbackTrackId,
    trackName:
      (parsed.trackName ?? defaults.fallbackTrackName).trim() || defaults.fallbackTrackName,
    effectProfileId: (parsed.effectProfileId ?? '').trim(),
    laneWidthPx,
    replayRacerCount,
    nameDisplayMode,
    focusRacerNumber,
    playingPreview: parsed.playingPreview !== false,
    smoothingEnabled: parsed.smoothingEnabled !== false,
    replayModeEnabled: parsed.replayModeEnabled === true,
    laneBoardsVisible: parsed.laneBoardsVisible === true,
    inlineBackgroundDataUrl:
      typeof parsed.backgroundImageDataUrl === 'string' ? parsed.backgroundImageDataUrl : null,
    hasBackgroundImage: parsed.hasBackgroundImage === true
  };
}

export async function deleteStudioPreset(presetName: string): Promise<PresetActionResult> {
  const store = loadPresetStore();
  if (!store.presets[presetName]) {
    return {
      message: `Preset "${presetName}" does not exist anymore.`
    };
  }

  delete store.presets[presetName];
  try {
    await deletePresetBackground(presetName);
  } catch {
    // Ignore cleanup failures.
  }

  if (store.lastUsedPresetName === presetName) {
    delete store.lastUsedPresetName;
  }
  savePresetStore(store);

  return {
    message: `Preset "${presetName}" deleted.`
  };
}
