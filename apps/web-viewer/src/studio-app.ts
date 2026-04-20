/**
 * File: apps/web-viewer/src/studio-app.ts
 * Model: GPT-5.3-Codex
 * Purpose: Runs the studio track editor and replay/broadcast authoring preview.
 * Usage: `pnpm --filter web-viewer dev` then open the viewer and place points.
 * Dependencies: PixiJS and local track-editor utility helpers.
 */

import { Application, Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { CameraController } from './camera';
import { DEFAULT_EDITOR_TRACK_ID } from './track-editor-utils';
import { buildDemoRecordedRaceData } from './replay-utils';
import {
  createRacerIds,
  normalizeFocusRacerNumber,
  toNameDisplayMode,
  type NameDisplayMode
} from './replay-visual-policy';
import { mapTrackPointsToCurrentLayout } from './track-layout-helpers';
import { resetWorldTransform } from './world-transform-utils';
import { resolveStudioDom } from './studio-dom';
import { redrawEditor, refreshExport } from './studio-render';
import { round3 } from './studio-editor-helpers';
import { wireStudioPointEditorController } from './studio-point-editor-controller';
import { tickStudioReplayMode, type StudioReplayRacerView } from './studio-replay-controller';
import { tickStudioSinglePreviewMode } from './studio-single-preview-controller';
import { wireStudioBackgroundController } from './studio-background-controller';
import { wireStudioUiControlsController } from './studio-ui-controls-controller';
import { normalizeTrackOrientation, type TrackOrientation } from './track-orientation.js';
import {
  generateRacerSpritePackFromImage,
  generateTrackTemplate,
  type GeneratedRacerSpritePack,
  type GeneratedRacerSpritePackMeta,
  type TrackTemplateKind
} from './studio-generators';
import { downloadDataUrl, downloadTextFile, loadImageFromFile } from './studio-file-utils';
import {
  buildCenterlineFromBoundaries,
  resolveStudioPaths,
  type StudioTrackEditMode
} from './studio-paths';
import {
  loadPresetBackground,
  loadPresetStore,
  savePresetStore,
  type BoundarySide,
  type StudioTestPreset
} from './studio-preset-store';
import {
  applyEditablePointsUpdate,
  buildBoundaryPairFromCenterline,
  ensureBoundaryPointsFromCenterline as ensureBoundaryPointsFromCenterlineState,
  getEditablePoints as getEditablePointsForMode,
  resolveCenterlinePoints
} from './studio-track-edit-helpers';
import { type RuntimeRacerPackCache, resolveTrackPreviewSizePx } from './studio-racer-pack-utils';
import { rebuildReplayRacerViews } from './studio-replay-racer-builder';
import { applyStudioUiState } from './studio-ui-state';
import { orientCenterlinePoints, rotateStudioGeometry } from './studio-geometry-state';
import { buildPresetSelectState } from './studio-preset-select-state';
import {
  computeEditorWorldTransform,
  computeZoomAroundScreenPoint,
  createDefaultEditorViewState
} from './studio-editor-view-state';
import {
  advanceStudioSurfaceEmitter,
  resolveStudioSurfaceEffectSetupInput
} from './studio-surface-effects-state';
import {
  buildSpriteGenerationWarning,
  resolveGeneratorPresetLabel
} from './studio-generator-ui-state';
import { parseStudioTrackJsonLoadState } from './studio-track-json-load-state';
import {
  drawSpritePreviewPlaceholder,
  drawSpritePreviewSingle,
  rebuildTrackPreviewTextures
} from './studio-sprite-preview-render';
import {
  createDefaultStudioSpritePreviewState,
  tickStudioSpritePreviewState
} from './studio-sprite-preview-state';
import {
  resolveRunnerPreviewScale,
  resolveRunnerPreviewTexture
} from './studio-runner-preview-texture';
import {
  buildStudioPresetFromState,
  deleteStudioPreset,
  lookupStudioPreset,
  normalizeLoadedStudioPreset,
  persistStudioPreset
} from './studio-preset-actions';
import {
  wireStudioBroadcastWindowEvents,
  wireStudioEditorZoomEvents
} from './studio-app-view-events';
import { tickStudioAppPlaybackFrame } from './studio-app-ticker-controller';
import { wireStudioSecondaryControlsController } from './studio-app-secondary-controls-controller';
import {
  buildSurfaceEffectSetup,
  drawSurfaceParticles,
  tickSurfaceParticles,
  type SurfaceParticle
} from './surface-effects';

const VIEW_WIDTH = 1160;
const VIEW_HEIGHT = 720;

const SAMPLE_CURVY_POINTS: TrackPoint[] = [
  { x: 80, y: 630 },
  { x: 220, y: 500 },
  { x: 360, y: 280 },
  { x: 520, y: 140 },
  { x: 700, y: 220 },
  { x: 860, y: 430 },
  { x: 990, y: 610 },
  { x: 1120, y: 540 }
];

const SAMPLE_STRAIGHT_POINTS: TrackPoint[] = [
  { x: 110, y: 360 },
  { x: 920, y: 360 },
  { x: 1060, y: 360 }
];

const RUNNER_SPEED = 0.09;
const DEFAULT_REPLAY_RACER_COUNT = 12;
const MIN_EDITOR_ZOOM = 1;
const MAX_EDITOR_ZOOM = 4;
const DEFAULT_RUNTIME_PACK_FRAME_COUNT = 10;

type TrackEditMode = StudioTrackEditMode;

export async function startStudioApp(): Promise<void> {
  const app = new Application({
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: 0x101923,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2)
  });

  const mount = document.getElementById('race-canvas');
  if (!mount) throw new Error('Mount element #race-canvas not found');
  mount.appendChild(app.view as HTMLCanvasElement);

  const dom = resolveStudioDom();

  const world = new Container();
  app.stage.addChild(world);
  let camera = new CameraController(app.screen.width, app.screen.height);

  const backgroundLayer = new Container();
  const pathLayer = new Graphics();
  const markerLayer = new Graphics();
  const laneBoardLayer = new Graphics();
  const surfaceEffectLayer = new Graphics();
  const runnerLayer = new Container();
  const labelLayer = new Container();
  runnerLayer.sortableChildren = true;
  labelLayer.sortableChildren = true;
  world.addChild(backgroundLayer);
  world.addChild(pathLayer);
  world.addChild(markerLayer);
  world.addChild(laneBoardLayer);
  world.addChild(surfaceEffectLayer);
  world.addChild(runnerLayer);
  world.addChild(labelLayer);

  const runner = Sprite.from('https://pixijs.io/examples/examples/assets/bunny.png');
  runner.anchor.set(0.5);
  runner.scale.set(1.35);
  runner.visible = false;
  runnerLayer.addChild(runner);
  const defaultRunnerTexture = runner.texture;

  let replayRacerCount = DEFAULT_REPLAY_RACER_COUNT;
  let replayRacers: StudioReplayRacerView[] = [];

  let points: TrackPoint[] = [...SAMPLE_CURVY_POINTS];
  let leftBoundaryPoints: TrackPoint[] = [];
  let rightBoundaryPoints: TrackPoint[] = [];
  let trackEditMode: TrackEditMode = 'centerline';
  let trackOrientation: TrackOrientation = 'left-to-right';
  let boundaryEditSide: BoundarySide = 'left';
  let playingPreview = true;
  let smoothingEnabled = true;
  let replayModeEnabled = false;
  let broadcastViewEnabled = false;
  let laneBoardsVisible = false;
  let laneWidthPx = 7;
  let nameDisplayMode: NameDisplayMode = 'leaders-focus';
  let focusRacerNumber = 1;
  let leaderboardTickMs = 0;
  let previewProgress = 0;
  let replayTimeMs = 0;
  let singlePreviewElapsedSeconds = 0;
  let replayRunId = 1;
  let replayData = buildDemoRecordedRaceData(
    createRacerIds(replayRacerCount),
    42_000,
    200,
    replayRunId
  );
  let generatedSpriteSheetDataUrl: string | null = null;
  let generatedSpriteSheetMeta: GeneratedRacerSpritePackMeta | null = null;
  let generatedRacerPack: GeneratedRacerSpritePack | null = null;
  let runtimeRacerPackCache: RuntimeRacerPackCache = {
    fallbackRuntimeRacerPack: null,
    fallbackRuntimeRacerPackKey: ''
  };
  let spriteSourceImageDimensions: { width: number; height: number } | null = null;

  dom.laneWidthInput.value = String(laneWidthPx);
  dom.laneWidthValue.textContent = `${laneWidthPx} px`;
  dom.racerCountInput.value = String(replayRacerCount);
  dom.racerCountValue.textContent = String(replayRacerCount);
  nameDisplayMode = toNameDisplayMode(dom.nameModeSelect.value);
  focusRacerNumber = normalizeFocusRacerNumber(Number(dom.focusRacerInput.value), replayRacerCount);
  dom.focusRacerInput.value = String(focusRacerNumber);
  dom.focusRacerLabel.textContent = `D${focusRacerNumber}`;
  dom.trackEditModeSelect.value = trackEditMode;
  dom.trackOrientationSelect.value = trackOrientation;
  dom.boundaryEditSideSelect.value = boundaryEditSide;
  dom.boundaryEditSideSelect.disabled = true;
  const defaultEditorViewState = createDefaultEditorViewState(VIEW_WIDTH, VIEW_HEIGHT);
  let editorZoom = defaultEditorViewState.zoom;
  let editorViewCenterX = defaultEditorViewState.centerX;
  let editorViewCenterY = defaultEditorViewState.centerY;
  dom.editorZoomInput.value = String(Math.round(editorZoom * 100));
  dom.editorZoomValue.textContent = `${Math.round(editorZoom * 100)}%`;
  dom.trackTemplatePointsValue.textContent = dom.trackTemplatePointsInput.value;
  dom.trackPreviewSizeValue.textContent = `${dom.trackPreviewSizeInput.value} px`;
  dom.spriteFrameCountValue.textContent = dom.spriteFrameCountInput.value;
  dom.spriteVariantCountValue.textContent = dom.spriteVariantCountInput.value;
  dom.downloadSpriteSheetButton.disabled = true;
  dom.downloadSpriteMetaButton.disabled = true;

  let spritePreviewState = createDefaultStudioSpritePreviewState();
  let trackPreviewTextures: Texture[] = [];
  let studioSurfaceElapsedMs = 0;
  const studioSurfaceParticles: SurfaceParticle[] = [];
  const replayPreviousPositions = new Map<string, { x: number; y: number }>();
  let runnerPreviousPosition: { x: number; y: number } | null = null;

  const hasSurfaceProfileOption = (value: string): boolean => {
    return [...dom.surfaceProfileSelect.options].some((option) => option.value === value);
  };

  const syncSurfaceProfileSelectFromInput = (): void => {
    const effectProfileId = dom.effectProfileInput.value.trim();
    if (effectProfileId && hasSurfaceProfileOption(effectProfileId)) {
      dom.surfaceProfileSelect.value = effectProfileId;
      return;
    }
    dom.surfaceProfileSelect.value = 'auto';
  };

  syncSurfaceProfileSelectFromInput();

  const setGeneratorPresetActive = (
    activePreset: 'Minimal' | 'Balanced' | 'Max Contrast' | null
  ): void => {
    dom.spritePresetMinimalButton?.classList.toggle('primary', activePreset === 'Minimal');
    dom.spritePresetBalancedButton?.classList.toggle('primary', activePreset === 'Balanced');
    dom.spritePresetMaxContrastButton?.classList.toggle('primary', activePreset === 'Max Contrast');
  };

  const refreshGeneratorPresetHighlight = (): void => {
    const frameCount = Number(dom.spriteFrameCountInput.value);
    const variantCount = Number(dom.spriteVariantCountInput.value);
    setGeneratorPresetActive(resolveGeneratorPresetLabel(frameCount, variantCount));
  };

  refreshGeneratorPresetHighlight();

  const refreshSpriteGenerationWarning = (): void => {
    dom.spriteGenerationWarning.textContent = buildSpriteGenerationWarning({
      spriteSourceImageDimensions,
      frameCountInput: Number(dom.spriteFrameCountInput.value),
      variantCountInput: Number(dom.spriteVariantCountInput.value)
    });
  };

  refreshSpriteGenerationWarning();

  const applyGeneratorPreset = (
    frameCount: number,
    racerVariantCount: number,
    label: 'Minimal' | 'Balanced' | 'Max Contrast'
  ): void => {
    dom.spriteFrameCountInput.value = String(frameCount);
    dom.spriteVariantCountInput.value = String(racerVariantCount);
    dom.spriteFrameCountValue.textContent = String(frameCount);
    dom.spriteVariantCountValue.textContent = String(racerVariantCount);
    setGeneratorPresetActive(label);
    dom.editorHelp.textContent = `Generator preset applied: ${label}.`;
  };

  const updateStudioSurfaceEffects = (dtSec: number): void => {
    const setupInput = resolveStudioSurfaceEffectSetupInput(
      {
        surfaceRaceType: dom.surfaceRaceTypeSelect.value,
        surfaceCategory: dom.surfaceCategorySelect.value,
        surfaceSizeClass: dom.surfaceSizeClassSelect.value,
        surfaceProfile: dom.surfaceProfileSelect.value,
        effectProfileInput: dom.effectProfileInput.value,
        trackId: dom.trackIdInput.value
      },
      replayRacerCount
    );
    const setup = buildSurfaceEffectSetup(setupInput);
    const nextSurfaceState = advanceStudioSurfaceEmitter({
      dtSec,
      setup,
      particles: studioSurfaceParticles,
      replayModeEnabled,
      replayRacers,
      runnerVisible: runner.visible,
      runnerX: runner.position.x,
      runnerY: runner.position.y,
      state: {
        elapsedMs: studioSurfaceElapsedMs,
        replayPreviousPositions,
        runnerPreviousPosition
      }
    });
    studioSurfaceElapsedMs = nextSurfaceState.elapsedMs;
    runnerPreviousPosition = nextSurfaceState.runnerPreviousPosition;

    tickSurfaceParticles(studioSurfaceParticles, setup, dtSec);
    drawSurfaceParticles(surfaceEffectLayer, studioSurfaceParticles);
  };

  const renderGeneratedSpritePreviews = (deltaMs: number): void => {
    if (!generatedRacerPack) {
      drawSpritePreviewPlaceholder(
        dom.spritePackAnimPreviewCanvas,
        'Generate racer pack to preview animation.',
        false
      );
      return;
    }

    const frameDurationMs = Math.max(40, generatedRacerPack.meta.frames[0]?.durationMs ?? 90);
    const tickedState = tickStudioSpritePreviewState({
      state: spritePreviewState,
      deltaMs,
      frameDurationMs,
      frameCount: generatedRacerPack.meta.frameCount,
      variantCount: generatedRacerPack.meta.racerVariantCount
    });
    spritePreviewState = tickedState.nextState;

    if (tickedState.variantChanged) {
      trackPreviewTextures = rebuildTrackPreviewTextures(
        generatedRacerPack,
        spritePreviewState.variantIndex
      );
    }

    drawSpritePreviewSingle(
      dom.spritePackAnimPreviewCanvas,
      generatedRacerPack,
      spritePreviewState.frameIndex,
      spritePreviewState.variantIndex,
      false
    );
  };

  function getCenterlinePoints(): TrackPoint[] {
    return resolveCenterlinePoints(trackEditMode, points, leftBoundaryPoints, rightBoundaryPoints);
  }

  function ensureBoundaryPointsFromCenterline(): void {
    const ensured = ensureBoundaryPointsFromCenterlineState({
      leftBoundaryPoints,
      rightBoundaryPoints,
      points,
      fallbackPoints: SAMPLE_CURVY_POINTS,
      halfWidthPx: laneWidthPx * 8
    });
    leftBoundaryPoints = ensured.leftBoundaryPoints;
    rightBoundaryPoints = ensured.rightBoundaryPoints;
  }

  function getEditablePoints(): TrackPoint[] {
    return getEditablePointsForMode(
      trackEditMode,
      boundaryEditSide,
      points,
      leftBoundaryPoints,
      rightBoundaryPoints
    );
  }

  function setEditablePoints(nextPoints: TrackPoint[]): void {
    const updated = applyEditablePointsUpdate({
      trackEditMode,
      boundaryEditSide,
      nextPoints,
      points,
      leftBoundaryPoints,
      rightBoundaryPoints
    });
    points = updated.points;
    leftBoundaryPoints = updated.leftBoundaryPoints;
    rightBoundaryPoints = updated.rightBoundaryPoints;
  }

  function regenerateReplayData(): ReturnType<typeof buildDemoRecordedRaceData> {
    replayRunId += 1;
    replayData = buildDemoRecordedRaceData(
      createRacerIds(replayRacerCount),
      42_000,
      200,
      replayRunId
    );
    replayTimeMs = 0;
    return replayData;
  }

  const syncUiFromState = (): void => {
    applyStudioUiState(dom, {
      trackEditMode,
      trackOrientation,
      boundaryEditSide,
      laneWidthPx,
      replayRacerCount,
      nameDisplayMode,
      focusRacerNumber,
      playingPreview,
      smoothingEnabled,
      replayModeEnabled,
      laneBoardsVisible,
      broadcastViewEnabled
    });
  };

  const buildCurrentTestPreset = (): StudioTestPreset => {
    return buildStudioPresetFromState({
      trackId: dom.trackIdInput.value,
      trackName: dom.trackNameInput.value,
      effectProfileId: dom.effectProfileInput.value,
      points,
      trackEditMode,
      trackOrientation,
      boundaryEditSide,
      leftBoundaryPoints,
      rightBoundaryPoints,
      laneWidthPx,
      replayRacerCount,
      nameDisplayMode,
      focusRacerNumber,
      playingPreview,
      smoothingEnabled,
      replayModeEnabled,
      laneBoardsVisible,
      backgroundImageDataUrl: backgroundController.getBackgroundDataUrl(),
      fallbackTrackId: DEFAULT_EDITOR_TRACK_ID,
      fallbackTrackName: 'Custom Track'
    });
  };

  const saveTestPreset = async (): Promise<void> => {
    const presetName = dom.presetNameInput.value.trim();
    if (!presetName) {
      dom.editorHelp.textContent = 'Enter a preset name first, then click Save.';
      return;
    }

    const saveResult = await persistStudioPreset({
      presetName,
      preset: buildCurrentTestPreset()
    });
    refreshPresetSelect(saveResult.preferredName);
    dom.editorHelp.textContent = saveResult.message;
  };

  const loadTestPreset = async (): Promise<void> => {
    const presetName = dom.presetSelect.value;
    if (!presetName) {
      dom.editorHelp.textContent = 'No preset selected. Choose one first.';
      return;
    }

    try {
      const lookedUpPreset = lookupStudioPreset(presetName);
      if (!lookedUpPreset.ok || !lookedUpPreset.parsed) {
        dom.editorHelp.textContent = `Preset "${presetName}" was not found.`;
        refreshPresetSelect();
        return;
      }

      const loadedPreset = normalizeLoadedStudioPreset({
        parsed: lookedUpPreset.parsed,
        fallbackPoints: SAMPLE_CURVY_POINTS,
        defaults: {
          laneWidthPx,
          replayRacerCount,
          nameDisplayMode,
          focusRacerNumber,
          fallbackTrackId: DEFAULT_EDITOR_TRACK_ID,
          fallbackTrackName: 'Custom Track'
        }
      });

      points = loadedPreset.points;
      trackEditMode = loadedPreset.trackEditMode;
      trackOrientation = loadedPreset.trackOrientation;
      boundaryEditSide = loadedPreset.boundaryEditSide;
      leftBoundaryPoints = loadedPreset.leftBoundaryPoints;
      rightBoundaryPoints = loadedPreset.rightBoundaryPoints;
      dom.trackIdInput.value = loadedPreset.trackId;
      dom.trackNameInput.value = loadedPreset.trackName;
      dom.effectProfileInput.value = loadedPreset.effectProfileId;

      laneWidthPx = loadedPreset.laneWidthPx;
      replayRacerCount = loadedPreset.replayRacerCount;
      nameDisplayMode = loadedPreset.nameDisplayMode;
      focusRacerNumber = loadedPreset.focusRacerNumber;
      playingPreview = loadedPreset.playingPreview;
      smoothingEnabled = loadedPreset.smoothingEnabled;
      replayModeEnabled = loadedPreset.replayModeEnabled;
      laneBoardsVisible = loadedPreset.laneBoardsVisible;
      broadcastViewEnabled = false;

      safeRebuildReplayRacers('loadPreset');
      resetReplayPreviewState();
      redrawEditor(points, pathLayer, markerLayer, smoothingEnabled, VIEW_WIDTH, VIEW_HEIGHT, {
        mode: trackEditMode,
        activeSide: boundaryEditSide,
        leftBoundaryPoints,
        rightBoundaryPoints
      });
      refreshExport(dom, points, {
        mode: trackEditMode,
        activeSide: boundaryEditSide,
        leftBoundaryPoints,
        rightBoundaryPoints
      });

      if (loadedPreset.inlineBackgroundDataUrl) {
        await backgroundController.loadBackgroundFromDataUrl(loadedPreset.inlineBackgroundDataUrl);
      } else if (loadedPreset.hasBackgroundImage) {
        const indexedDbBackground = await loadPresetBackground(presetName);
        if (indexedDbBackground) {
          await backgroundController.loadBackgroundFromDataUrl(indexedDbBackground);
        } else {
          backgroundController.clearBackground();
          dom.backgroundImageInput.value = '';
          dom.editorHelp.textContent = `Preset "${presetName}" loaded, but its background image could not be found in local asset storage.`;
        }
      } else {
        backgroundController.clearBackground();
        dom.backgroundImageInput.value = '';
      }

      syncUiFromState();
      applyViewMode();
      dom.presetNameInput.value = presetName;
      lookedUpPreset.store.lastUsedPresetName = presetName;
      savePresetStore(lookedUpPreset.store);
      refreshPresetSelect(presetName);
      dom.editorHelp.textContent = `Preset "${presetName}" loaded.`;
    } catch {
      dom.editorHelp.textContent = 'Saved test preset is invalid or outdated.';
    }
  };

  const deleteSelectedPreset = async (): Promise<void> => {
    const presetName = dom.presetSelect.value;
    if (!presetName) {
      dom.editorHelp.textContent = 'No preset selected for deletion.';
      return;
    }

    const deleteResult = await deleteStudioPreset(presetName);
    refreshPresetSelect();
    dom.editorHelp.textContent = deleteResult.message;
  };

  const refreshPresetSelect = (preferredName?: string): void => {
    const store = loadPresetStore();
    const { names, nextSelected } = buildPresetSelectState(
      store,
      dom.presetSelect.value,
      preferredName
    );

    dom.presetSelect.innerHTML = '';
    if (names.length === 0) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No saved presets yet';
      dom.presetSelect.appendChild(empty);
      dom.presetSelect.value = '';
      return;
    }

    for (const name of names) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      dom.presetSelect.appendChild(option);
    }
    dom.presetSelect.value = nextSelected;
  };

  function rebuildReplayRacers(): void {
    const rebuilt = rebuildReplayRacerViews({
      replayRacers,
      replayRacerCount,
      runnerLayer,
      labelLayer,
      generatedRacerPack,
      runtimeRacerPackCache,
      defaultRuntimePackFrameCount: DEFAULT_RUNTIME_PACK_FRAME_COUNT
    });
    replayRacers = rebuilt.replayRacers;
    runtimeRacerPackCache = rebuilt.runtimeRacerPackCache;

    focusRacerNumber = normalizeFocusRacerNumber(focusRacerNumber, replayRacerCount);
    dom.focusRacerInput.value = String(focusRacerNumber);
    dom.focusRacerLabel.textContent = `D${focusRacerNumber}`;
    dom.leaderboardList.innerHTML = '';
    applyReplaySpriteSizeFromSlider();
    regenerateReplayData();
  }

  const applyReplaySpriteSizeFromSlider = (): void => {
    const sizeFactor = resolveTrackPreviewSizePx(Number(dom.trackPreviewSizeInput.value)) / 34;
    for (const rr of replayRacers) {
      if (!rr.bodySprite) continue;
      const baseX = rr.bodyBaseScaleX ?? rr.bodySprite.scale.x;
      const baseY = rr.bodyBaseScaleY ?? rr.bodySprite.scale.y;
      rr.bodySprite.scale.set(baseX * sizeFactor, baseY * sizeFactor);
    }
  };

  const safeRebuildReplayRacers = (origin: string): void => {
    try {
      rebuildReplayRacers();
    } catch (error) {
      replayRacers = [];
      dom.leaderboardList.innerHTML = '';
      dom.editorHelp.textContent =
        'Replay visuals could not be rebuilt. Track editing is still active; try refreshing the page.';
      console.error(`Replay rebuild failed (${origin}).`, error);
    }
  };

  safeRebuildReplayRacers('startup');

  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  const renderPointsChanged = (): void => {
    points = getCenterlinePoints();
    redrawEditor(points, pathLayer, markerLayer, smoothingEnabled, VIEW_WIDTH, VIEW_HEIGHT, {
      mode: trackEditMode,
      activeSide: boundaryEditSide,
      leftBoundaryPoints,
      rightBoundaryPoints
    });
    refreshExport(dom, points, {
      mode: trackEditMode,
      activeSide: boundaryEditSide,
      leftBoundaryPoints,
      rightBoundaryPoints
    });
  };

  const resetReplayPreviewState = (): void => {
    previewProgress = 0;
    replayTimeMs = 0;
    singlePreviewElapsedSeconds = 0;
  };

  wireStudioPointEditorController({
    app,
    controls: {
      clearButton: dom.clearButton,
      undoButton: dom.undoButton,
      loadCurvyButton: dom.loadCurvyButton,
      loadStraightButton: dom.loadStraightButton
    },
    viewWidth: VIEW_WIDTH,
    viewHeight: VIEW_HEIGHT,
    sampleCurvyPoints: SAMPLE_CURVY_POINTS,
    sampleStraightPoints: SAMPLE_STRAIGHT_POINTS,
    getPoints: getEditablePoints,
    setPoints: setEditablePoints,
    mapScreenToWorldPoint: (x, y) => ({
      x: (x - world.position.x) / editorZoom,
      y: (y - world.position.y) / editorZoom
    }),
    isBroadcastViewEnabled: () => broadcastViewEnabled,
    onResetAndRender: () => {
      resetReplayPreviewState();
      renderPointsChanged();
    },
    onRenderOnly: renderPointsChanged
  });

  const backgroundController = wireStudioBackgroundController({
    controls: {
      backgroundImageInput: dom.backgroundImageInput,
      clearImageButton: dom.clearImageButton,
      editorHelp: dom.editorHelp
    },
    backgroundLayer,
    getViewportSize: () => ({ width: app.screen.width, height: app.screen.height }),
    isBroadcastViewEnabled: () => broadcastViewEnabled
  });

  wireStudioUiControlsController({
    controls: {
      previewToggleButton: dom.previewToggleButton,
      smoothToggleButton: dom.smoothToggleButton,
      replayToggleButton: dom.replayToggleButton,
      laneWidthInput: dom.laneWidthInput,
      laneWidthValue: dom.laneWidthValue,
      racerCountInput: dom.racerCountInput,
      racerCountValue: dom.racerCountValue,
      nameModeSelect: dom.nameModeSelect,
      trackOrientationSelect: dom.trackOrientationSelect,
      focusRacerInput: dom.focusRacerInput,
      focusRacerLabel: dom.focusRacerLabel,
      laneBoardsToggleButton: dom.laneBoardsToggleButton,
      broadcastToggleButton: dom.broadcastToggleButton,
      editorHelp: dom.editorHelp
    },
    getPlayingPreview: () => playingPreview,
    setPlayingPreview: (value) => {
      playingPreview = value;
    },
    getSmoothingEnabled: () => smoothingEnabled,
    setSmoothingEnabled: (value) => {
      smoothingEnabled = value;
    },
    onSmoothingChanged: () => {
      redrawEditor(points, pathLayer, markerLayer, smoothingEnabled, VIEW_WIDTH, VIEW_HEIGHT, {
        mode: trackEditMode,
        activeSide: boundaryEditSide,
        leftBoundaryPoints,
        rightBoundaryPoints
      });
    },
    getReplayModeEnabled: () => replayModeEnabled,
    setReplayModeEnabled: (value) => {
      replayModeEnabled = value;
    },
    onReplayModeChanged: (enabled) => {
      replayTimeMs = 0;
      singlePreviewElapsedSeconds = 0;
      if (!enabled) {
        for (const rr of replayRacers) {
          rr.labelBg.visible = false;
          rr.labelText.visible = false;
        }
        dom.leaderboardList.innerHTML = '';
      }
    },
    onLaneWidthChanged: (value) => {
      laneWidthPx = value;
    },
    onRacerCountChanged: (value) => {
      replayRacerCount = value;
      focusRacerNumber = normalizeFocusRacerNumber(focusRacerNumber, replayRacerCount);
      dom.focusRacerInput.value = String(focusRacerNumber);
      dom.focusRacerLabel.textContent = `D${focusRacerNumber}`;
      safeRebuildReplayRacers('racerCountChanged');
    },
    onNameModeChanged: (value) => {
      nameDisplayMode = toNameDisplayMode(value);
    },
    onTrackOrientationChanged: (value) => {
      const nextOrientation = normalizeTrackOrientation(value);
      if (nextOrientation !== trackOrientation) {
        const rotated = rotateStudioGeometry(
          { points, leftBoundaryPoints, rightBoundaryPoints },
          trackOrientation,
          nextOrientation
        );
        points = rotated.points;
        leftBoundaryPoints = rotated.leftBoundaryPoints;
        rightBoundaryPoints = rotated.rightBoundaryPoints;
        trackOrientation = nextOrientation;
      }
      renderPointsChanged();
    },
    onFocusRacerInput: (value) => {
      focusRacerNumber = normalizeFocusRacerNumber(value, replayRacerCount);
      return focusRacerNumber;
    },
    getLaneBoardsVisible: () => laneBoardsVisible,
    setLaneBoardsVisible: (value) => {
      laneBoardsVisible = value;
    },
    getBroadcastViewEnabled: () => broadcastViewEnabled,
    setBroadcastViewEnabled: (value) => {
      broadcastViewEnabled = value;
    },
    onBroadcastModeChanged: () => {
      applyViewMode();
    }
  });

  wireStudioBroadcastWindowEvents({
    dom,
    getBroadcastViewEnabled: () => broadcastViewEnabled,
    setBroadcastViewEnabled: (value) => {
      broadcastViewEnabled = value;
    },
    applyViewMode
  });

  dom.trackEditModeSelect.addEventListener('change', () => {
    trackEditMode = dom.trackEditModeSelect.value === 'boundaries' ? 'boundaries' : 'centerline';
    if (trackEditMode === 'boundaries') {
      ensureBoundaryPointsFromCenterline();
      points = buildCenterlineFromBoundaries(leftBoundaryPoints, rightBoundaryPoints);
      dom.editorHelp.textContent =
        'Boundary mode active: edit left/right lines; racers run between them.';
    } else {
      dom.editorHelp.textContent =
        'Centerline mode active: edit one line plus lane width as before.';
    }
    syncUiFromState();
    renderPointsChanged();
  });

  const updateEditorZoomUi = (): void => {
    const percent = Math.round(editorZoom * 100);
    dom.editorZoomInput.value = String(percent);
    dom.editorZoomValue.textContent = `${percent}%`;
  };

  const applyEditorViewTransform = (): void => {
    const transform = computeEditorWorldTransform(
      { zoom: editorZoom, centerX: editorViewCenterX, centerY: editorViewCenterY },
      app.screen.width,
      app.screen.height
    );
    world.scale.set(transform.scale);
    world.position.set(transform.x, transform.y);
  };

  const resetEditorView = (): void => {
    editorZoom = defaultEditorViewState.zoom;
    editorViewCenterX = defaultEditorViewState.centerX;
    editorViewCenterY = defaultEditorViewState.centerY;
    updateEditorZoomUi();
    if (!broadcastViewEnabled) {
      applyEditorViewTransform();
    }
  };

  const setEditorZoomAroundScreenPoint = (
    nextZoom: number,
    screenX: number,
    screenY: number
  ): void => {
    const nextState = computeZoomAroundScreenPoint({
      state: { zoom: editorZoom, centerX: editorViewCenterX, centerY: editorViewCenterY },
      nextZoom,
      minZoom: MIN_EDITOR_ZOOM,
      maxZoom: MAX_EDITOR_ZOOM,
      screenX,
      screenY,
      worldPositionX: world.position.x,
      worldPositionY: world.position.y,
      screenWidth: app.screen.width,
      screenHeight: app.screen.height
    });
    editorZoom = nextState.zoom;
    editorViewCenterX = nextState.centerX;
    editorViewCenterY = nextState.centerY;

    updateEditorZoomUi();
    if (!broadcastViewEnabled) {
      applyEditorViewTransform();
    }
  };

  const editorCanvas = app.view as HTMLCanvasElement | undefined;
  wireStudioEditorZoomEvents({
    dom,
    getBroadcastViewEnabled: () => broadcastViewEnabled,
    getScreenWidth: () => app.screen.width,
    getScreenHeight: () => app.screen.height,
    getEditorZoom: () => editorZoom,
    setEditorZoomAroundScreenPoint,
    resetEditorView,
    editorCanvas
  });

  wireStudioSecondaryControlsController({
    controls: dom,
    onTrackTemplatePointsInput: () => {
      dom.trackTemplatePointsValue.textContent = dom.trackTemplatePointsInput.value;
    },
    onSpriteFrameCountInput: () => {
      dom.spriteFrameCountValue.textContent = dom.spriteFrameCountInput.value;
      refreshGeneratorPresetHighlight();
      refreshSpriteGenerationWarning();
    },
    onTrackPreviewSizeInput: () => {
      dom.trackPreviewSizeValue.textContent = `${dom.trackPreviewSizeInput.value} px`;
      applyReplaySpriteSizeFromSlider();
    },
    onSpriteVariantCountInput: () => {
      dom.spriteVariantCountValue.textContent = dom.spriteVariantCountInput.value;
      refreshGeneratorPresetHighlight();
      refreshSpriteGenerationWarning();
    },
    onSpritePresetMinimal: () => {
      applyGeneratorPreset(8, 8, 'Minimal');
      refreshSpriteGenerationWarning();
    },
    onSpritePresetBalanced: () => {
      applyGeneratorPreset(10, 12, 'Balanced');
      refreshSpriteGenerationWarning();
    },
    onSpritePresetMaxContrast: () => {
      applyGeneratorPreset(16, 24, 'Max Contrast');
      refreshSpriteGenerationWarning();
    },
    onSpriteSourceImageChanged: async (file) => {
      if (!file) {
        spriteSourceImageDimensions = null;
        refreshSpriteGenerationWarning();
        return;
      }

      try {
        const image = await loadImageFromFile(file);
        spriteSourceImageDimensions = { width: image.naturalWidth, height: image.naturalHeight };
      } catch {
        spriteSourceImageDimensions = null;
      }

      refreshSpriteGenerationWarning();
    },
    onSurfaceRaceTypeChanged: (selectedRaceType) => {
      dom.editorHelp.textContent =
        selectedRaceType === 'auto'
          ? 'Surface race type back on Auto resolver.'
          : `Surface race type forced to "${selectedRaceType}".`;
    },
    onSurfaceCategoryChanged: (selectedCategory) => {
      dom.editorHelp.textContent =
        selectedCategory === 'auto'
          ? 'Racer category back on Auto resolver.'
          : `Racer category forced to "${selectedCategory}".`;
    },
    onSurfaceSizeClassChanged: (selectedSizeClass) => {
      dom.editorHelp.textContent =
        selectedSizeClass === 'auto'
          ? 'Effect size class back on Auto resolver.'
          : `Effect size class forced to "${selectedSizeClass}".`;
    },
    onSurfaceProfileChanged: (selectedProfile) => {
      if (selectedProfile === 'auto') {
        dom.editorHelp.textContent = 'Surface profile back on Auto resolver.';
        return;
      }
      dom.effectProfileInput.value = selectedProfile;
      refreshExport(dom, points, {
        mode: trackEditMode,
        activeSide: boundaryEditSide,
        leftBoundaryPoints,
        rightBoundaryPoints
      });
      dom.editorHelp.textContent = `Surface profile forced to "${selectedProfile}".`;
    },
    onGenerateTrackTemplate: () => {
      const kind = dom.trackTemplateSelect.value as TrackTemplateKind;
      const controlPointCount = Number(dom.trackTemplatePointsInput.value);

      let generatedPoints = generateTrackTemplate({
        kind,
        controlPointCount,
        width: VIEW_WIDTH,
        height: VIEW_HEIGHT,
        margin: 80
      });
      generatedPoints = orientCenterlinePoints(generatedPoints, trackOrientation);

      if (trackEditMode === 'boundaries') {
        const generatedBoundaryPair = buildBoundaryPairFromCenterline(
          generatedPoints,
          laneWidthPx * 8
        );
        leftBoundaryPoints = generatedBoundaryPair.leftBoundaryPoints;
        rightBoundaryPoints = generatedBoundaryPair.rightBoundaryPoints;
        points = buildCenterlineFromBoundaries(leftBoundaryPoints, rightBoundaryPoints);
      } else {
        points = generatedPoints;
      }

      resetReplayPreviewState();
      renderPointsChanged();
      dom.editorHelp.textContent = `Generated ${kind} template with ${controlPointCount} control points.`;
    },
    onGenerateSpriteSheet: async () => {
      const file = dom.spriteSourceImageInput.files?.[0] ?? null;
      if (!file) {
        dom.editorHelp.textContent = 'Select a sprite source image first.';
        return;
      }

      dom.generateSpriteSheetButton.disabled = true;
      try {
        const image = await loadImageFromFile(file);
        const frameCount = Number(dom.spriteFrameCountInput.value);
        const racerVariantCount = Number(dom.spriteVariantCountInput.value);
        const generated = generateRacerSpritePackFromImage(
          image,
          image.naturalWidth,
          image.naturalHeight,
          {
            frameCount,
            racerVariantCount,
            frameDurationMs: 90,
            outputScale: 1,
            paddingPx: 10
          }
        );

        generatedSpriteSheetDataUrl = generated.sheetDataUrl;
        generatedSpriteSheetMeta = generated.meta;
        generatedRacerPack = generated;
        spritePreviewState = createDefaultStudioSpritePreviewState();
        trackPreviewTextures = rebuildTrackPreviewTextures(generated, 0);
        dom.spriteSheetPreview.src = generated.sheetDataUrl;
        dom.downloadSpriteSheetButton.disabled = false;
        dom.downloadSpriteMetaButton.disabled = false;
        const scaleNote =
          generated.meta.appliedOutputScale < 0.999
            ? ` Auto-scaled to ${(generated.meta.appliedOutputScale * 100).toFixed(1)}% to fit canvas limits.`
            : '';
        dom.editorHelp.textContent = `Racer pack generated: ${generated.meta.racerVariantCount} variants x ${generated.meta.frameCount} frames.${scaleNote}`;
        safeRebuildReplayRacers('spritePackGenerated');
      } catch (error) {
        generatedSpriteSheetDataUrl = null;
        generatedSpriteSheetMeta = null;
        generatedRacerPack = null;
        trackPreviewTextures = [];
        dom.downloadSpriteSheetButton.disabled = true;
        dom.downloadSpriteMetaButton.disabled = true;
        dom.editorHelp.textContent =
          error instanceof Error ? error.message : 'Sprite generation failed.';
      } finally {
        dom.generateSpriteSheetButton.disabled = false;
      }
    },
    onDownloadSpriteSheet: () => {
      if (!generatedSpriteSheetDataUrl) {
        return;
      }
      downloadDataUrl('generated-racer-pack.png', generatedSpriteSheetDataUrl);
    },
    onDownloadSpriteMeta: () => {
      if (!generatedSpriteSheetMeta) {
        return;
      }
      downloadTextFile(
        'generated-racer-pack.meta.json',
        JSON.stringify(generatedSpriteSheetMeta, null, 2)
      );
    },
    onBoundaryEditSideChanged: (side) => {
      boundaryEditSide = side;
      renderPointsChanged();
    },
    onTrackMetadataInput: () => {
      refreshExport(dom, points, {
        mode: trackEditMode,
        activeSide: boundaryEditSide,
        leftBoundaryPoints,
        rightBoundaryPoints
      });
    },
    onEffectProfileInput: () => {
      syncSurfaceProfileSelectFromInput();
      refreshExport(dom, points, {
        mode: trackEditMode,
        activeSide: boundaryEditSide,
        leftBoundaryPoints,
        rightBoundaryPoints
      });
    },
    onSavePreset: saveTestPreset,
    onLoadPreset: loadTestPreset,
    onDeletePreset: deleteSelectedPreset,
    onPresetSelectChanged: (value) => {
      dom.presetNameInput.value = value;
    },
    onCopyJson: async () => {
      const payload = dom.jsonOutput.value;
      try {
        await navigator.clipboard.writeText(payload);
        dom.editorHelp.textContent = 'Track JSON copied to clipboard.';
      } catch {
        dom.editorHelp.textContent = 'Clipboard copy failed. Copy manually from the JSON area.';
      }
    },
    onDownloadJson: () => {
      const payload = dom.jsonOutput.value;
      const trackId = dom.trackIdInput.value.trim() || DEFAULT_EDITOR_TRACK_ID;
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${trackId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      dom.editorHelp.textContent = 'Track JSON downloaded.';
    },
    onLoadJson: () => {
      try {
        const loadedTrackState = parseStudioTrackJsonLoadState(dom.jsonOutput.value);
        points = loadedTrackState.points;
        trackEditMode = loadedTrackState.trackEditMode;
        trackOrientation = loadedTrackState.trackOrientation;
        leftBoundaryPoints = loadedTrackState.leftBoundaryPoints;
        rightBoundaryPoints = loadedTrackState.rightBoundaryPoints;
        if (loadedTrackState.trackId) dom.trackIdInput.value = loadedTrackState.trackId;
        if (loadedTrackState.trackName) dom.trackNameInput.value = loadedTrackState.trackName;
        resetReplayPreviewState();
        syncUiFromState();
        renderPointsChanged();
        dom.editorHelp.textContent = 'Track loaded from JSON preview.';
      } catch {
        dom.editorHelp.textContent = 'Could not parse track JSON. Check the JSON preview format.';
      }
    }
  });

  renderPointsChanged();
  syncUiFromState();
  refreshPresetSelect();
  applyViewMode();

  app.ticker.add((delta) => {
    const dt = delta / 60;
    renderGeneratedSpritePreviews(dt * 1000);
    const tickResult = tickStudioAppPlaybackFrame({
      dt,
      points,
      leftBoundaryPoints,
      rightBoundaryPoints,
      trackEditMode,
      smoothingEnabled,
      replayModeEnabled,
      playingPreview,
      laneWidthPx,
      laneBoardsVisible,
      nameDisplayMode,
      focusRacerNumber,
      replayRacers,
      replayTimeMs,
      leaderboardTickMs,
      replayData,
      replayRunId,
      previewProgress,
      singlePreviewElapsedSeconds,
      runnerSpeed: RUNNER_SPEED,
      runner,
      leaderboardList: dom.leaderboardList,
      laneBoardLayer,
      surfaceEffectLayer,
      broadcastViewEnabled,
      camera,
      world,
      backgroundSprite: backgroundController.getBackgroundSprite(),
      appScreenWidth: app.screen.width,
      appScreenHeight: app.screen.height,
      viewWidth: VIEW_WIDTH,
      viewHeight: VIEW_HEIGHT,
      generatedRacerPack,
      trackPreviewTextures,
      spritePreviewState,
      defaultRunnerTexture,
      trackPreviewSizeInputValue: Number(dom.trackPreviewSizeInput.value),
      regenerateReplayData,
      applyReplaySpriteSizeFromSlider,
      applyEditorViewTransform,
      updateStudioSurfaceEffects,
      tickReplayMode: tickStudioReplayMode,
      tickSinglePreviewMode: tickStudioSinglePreviewMode,
      resetNoTrackTransientState: () => {
        studioSurfaceParticles.length = 0;
        replayPreviousPositions.clear();
        runnerPreviousPosition = null;
      }
    });

    replayTimeMs = tickResult.replayTimeMs;
    leaderboardTickMs = tickResult.leaderboardTickMs;
    replayData = tickResult.replayData;
    previewProgress = tickResult.previewProgress;
    singlePreviewElapsedSeconds = tickResult.singlePreviewElapsedSeconds;
  });

  function applyViewMode(): void {
    const width = broadcastViewEnabled ? window.innerWidth : VIEW_WIDTH;
    const height = broadcastViewEnabled ? window.innerHeight : VIEW_HEIGHT;
    app.renderer.resize(width, height);
    app.stage.hitArea = app.screen;
    camera = new CameraController(app.screen.width, app.screen.height);

    document.body.classList.toggle('broadcast-mode', broadcastViewEnabled);
    pathLayer.visible = !broadcastViewEnabled;
    markerLayer.visible = !broadcastViewEnabled;
    backgroundController.applyLayoutForCurrentView();
    if (!broadcastViewEnabled) {
      dom.leaderboardList.innerHTML = '';
      applyEditorViewTransform();
    }
  }

  resetEditorView();
}
