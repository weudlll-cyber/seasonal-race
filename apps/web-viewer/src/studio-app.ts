/**
 * File: apps/web-viewer/src/studio-app.ts
 * Model: GPT-5.3-Codex
 * Purpose: Runs the studio track editor and replay/broadcast authoring preview.
 * Usage: `pnpm --filter web-viewer dev` then open the viewer and place points.
 * Dependencies: PixiJS and local track-editor utility helpers.
 */

import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { CameraController } from './camera';
import {
  buildSmoothedPreviewPath,
  DEFAULT_EDITOR_TRACK_ID,
  interpolateTrackPosition
} from './track-editor-utils';
import { buildDemoRecordedRaceData } from './replay-utils';
import {
  createRacerIds,
  normalizeFocusRacerNumber,
  toNameDisplayMode,
  type NameDisplayMode
} from './replay-visual-policy';
import { computeTrackNormal, mapTrackPointsToCurrentLayout } from './track-layout-helpers';
import { resetWorldTransform } from './world-transform-utils';
import { resolveStudioDom } from './studio-dom';
import { redrawEditor, refreshExport } from './studio-render';
import { round3 } from './studio-editor-helpers';
import { wireStudioPointEditorController } from './studio-point-editor-controller';
import { tickStudioReplayMode, type StudioReplayRacerView } from './studio-replay-controller';
import { tickStudioSinglePreviewMode } from './studio-single-preview-controller';
import { wireStudioBackgroundController } from './studio-background-controller';
import { wireStudioUiControlsController } from './studio-ui-controls-controller';
import {
  computeTrackOrientationCenter,
  normalizeTrackOrientation,
  rotateTrackPointsBetweenOrientations,
  type TrackOrientation
} from './track-orientation.js';
import {
  generateRacerSpritePackFromImage,
  resolveSafeSpriteSheetOutputScale,
  generateTrackTemplate,
  type GeneratedRacerSpritePack,
  type GeneratedRacerSpritePackMeta,
  type TrackTemplateKind
} from './studio-generators';
import {
  buildSurfaceEffectSetup,
  drawSurfaceParticles,
  emitSurfaceParticles,
  type RacerCategory,
  resolveRacerCategory,
  tickSurfaceParticles,
  type RacerSizeClass,
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
const STUDIO_TEST_PRESET_STORAGE_KEY = 'seasonal-race:studio-test-presets:v2';
const STUDIO_PRESET_BACKGROUND_DB = 'seasonal-race-studio-preset-assets';
const STUDIO_PRESET_BACKGROUND_STORE = 'backgrounds';
const MIN_EDITOR_ZOOM = 1;
const MAX_EDITOR_ZOOM = 4;
const DEFAULT_RUNTIME_PACK_FRAME_COUNT = 10;

type TrackEditMode = 'centerline' | 'boundaries';
type BoundarySide = 'left' | 'right';

interface StudioTestPreset {
  version: 1;
  trackId: string;
  trackName: string;
  effectProfileId: string;
  points: TrackPoint[];
  trackEditMode?: TrackEditMode;
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

interface StudioTestPresetStore {
  version: 2;
  lastUsedPresetName?: string;
  presets: Record<string, StudioTestPreset>;
}

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
  let fallbackRuntimeRacerPack: GeneratedRacerSpritePack | null = null;
  let fallbackRuntimeRacerPackKey = '';
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
  let editorZoom = 1;
  let editorViewCenterX = VIEW_WIDTH * 0.5;
  let editorViewCenterY = VIEW_HEIGHT * 0.5;
  dom.editorZoomInput.value = String(Math.round(editorZoom * 100));
  dom.editorZoomValue.textContent = `${Math.round(editorZoom * 100)}%`;
  dom.trackTemplatePointsValue.textContent = dom.trackTemplatePointsInput.value;
  dom.trackPreviewSizeValue.textContent = `${dom.trackPreviewSizeInput.value} px`;
  dom.spriteFrameCountValue.textContent = dom.spriteFrameCountInput.value;
  dom.spriteVariantCountValue.textContent = dom.spriteVariantCountInput.value;
  dom.downloadSpriteSheetButton.disabled = true;
  dom.downloadSpriteMetaButton.disabled = true;

  let spritePreviewFrameIndex = 0;
  let spritePreviewFrameElapsedMs = 0;
  let spritePreviewVariantIndex = 0;
  let spritePreviewVariantElapsedMs = 0;
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
    if (frameCount === 8 && variantCount === 8) {
      setGeneratorPresetActive('Minimal');
      return;
    }
    if (frameCount === 10 && variantCount === 12) {
      setGeneratorPresetActive('Balanced');
      return;
    }
    if (frameCount === 16 && variantCount === 24) {
      setGeneratorPresetActive('Max Contrast');
      return;
    }
    setGeneratorPresetActive(null);
  };

  refreshGeneratorPresetHighlight();

  const refreshSpriteGenerationWarning = (): void => {
    if (!spriteSourceImageDimensions) {
      dom.spriteGenerationWarning.textContent =
        'Select a source image to see generation-size guidance.';
      return;
    }

    const frameCount = Math.max(
      4,
      Math.min(24, Math.floor(Number(dom.spriteFrameCountInput.value)))
    );
    const variantCount = Math.max(
      2,
      Math.min(60, Math.floor(Number(dom.spriteVariantCountInput.value)))
    );

    try {
      const safeScale = resolveSafeSpriteSheetOutputScale({
        sourceWidth: spriteSourceImageDimensions.width,
        sourceHeight: spriteSourceImageDimensions.height,
        requestedOutputScale: 1,
        padding: 10,
        frameCount,
        variantCount
      });

      if (safeScale < 0.999) {
        dom.spriteGenerationWarning.textContent = `Large source image detected: generator will auto-scale to ${(safeScale * 100).toFixed(1)}% (${frameCount} frames x ${variantCount} variants).`;
      } else {
        dom.spriteGenerationWarning.textContent = `Generation fits at 100% scale (${frameCount} frames x ${variantCount} variants).`;
      }
    } catch {
      dom.spriteGenerationWarning.textContent =
        'Current source image/settings exceed browser canvas limits. Reduce frame/variant count or use a smaller image.';
    }
  };

  refreshSpriteGenerationWarning();

  const rebuildTrackPreviewTextures = (
    pack: GeneratedRacerSpritePack,
    variantIndex: number
  ): void => {
    const variantCount = Math.max(1, pack.meta.racerVariantCount);
    const normalizedVariantIndex = ((variantIndex % variantCount) + variantCount) % variantCount;
    const textures: Texture[] = [];
    for (let frameIndex = 0; frameIndex < pack.meta.frameCount; frameIndex += 1) {
      const frameMetaIndex = normalizedVariantIndex * pack.meta.frameCount + frameIndex;
      const frame = pack.meta.frames[frameMetaIndex];
      if (!frame) continue;

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = frame.width;
      frameCanvas.height = frame.height;
      const frameCtx = frameCanvas.getContext('2d');
      if (!frameCtx) continue;

      frameCtx.drawImage(
        pack.sheetCanvas,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        0,
        0,
        frame.width,
        frame.height
      );
      textures.push(Texture.from(frameCanvas));
    }

    trackPreviewTextures = textures;
  };

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

  const resolveStudioRaceType = (): string => {
    const selectedRaceType = dom.surfaceRaceTypeSelect.value.trim().toLowerCase();
    if (selectedRaceType && selectedRaceType !== 'auto') {
      return selectedRaceType;
    }

    const trackKey = dom.trackIdInput.value.trim().toLowerCase();
    const effectKey = dom.effectProfileInput.value.trim().toLowerCase();
    if (trackKey.includes('duck') || effectKey.includes('duck') || effectKey.includes('water')) {
      return 'duck';
    }
    if (trackKey.includes('horse') || effectKey.includes('horse') || effectKey.includes('sand')) {
      return 'horse';
    }
    if (
      trackKey.includes('rocket') ||
      effectKey.includes('rocket') ||
      effectKey.includes('space')
    ) {
      return 'rocket';
    }
    return 'generic';
  };

  const resolveStudioCategory = (raceType: string): RacerCategory => {
    const selectedCategory = dom.surfaceCategorySelect.value as RacerCategory | 'auto';
    if (selectedCategory !== 'auto') {
      return selectedCategory;
    }
    return resolveRacerCategory(raceType);
  };

  const resolveStudioSizeClass = (): RacerSizeClass => {
    const selectedSizeClass = dom.surfaceSizeClassSelect.value as RacerSizeClass | 'auto';
    if (selectedSizeClass !== 'auto') {
      return selectedSizeClass;
    }

    if (replayRacerCount <= 8) return 'small';
    if (replayRacerCount <= 20) return 'medium';
    if (replayRacerCount <= 45) return 'large';
    return 'huge';
  };

  const resolveStudioEffectProfileId = (): string | undefined => {
    const selectedProfileId = dom.surfaceProfileSelect.value.trim();
    if (selectedProfileId && selectedProfileId !== 'auto') {
      return selectedProfileId;
    }

    const typedEffectProfileId = dom.effectProfileInput.value.trim();
    return typedEffectProfileId || undefined;
  };

  const updateStudioSurfaceEffects = (dtSec: number): void => {
    studioSurfaceElapsedMs += dtSec * 1000;
    const raceType = resolveStudioRaceType();
    const category = resolveStudioCategory(raceType);
    const effectProfileId = resolveStudioEffectProfileId();
    const setup = buildSurfaceEffectSetup({
      raceType,
      category,
      sizeClass: resolveStudioSizeClass(),
      ...(effectProfileId ? { effectProfileId } : {})
    });

    if (replayModeEnabled) {
      for (const rr of replayRacers) {
        if (!rr.sprite.visible) continue;
        const prev = replayPreviousPositions.get(rr.id);
        const x = rr.sprite.position.x;
        const y = rr.sprite.position.y;
        const dx = prev ? x - prev.x : 0;
        const dy = prev ? y - prev.y : 0;
        const distance = Math.hypot(dx, dy);
        const speedNorm = Math.max(0.15, Math.min(1, distance / Math.max(8, 180 * dtSec)));
        emitSurfaceParticles(studioSurfaceParticles, setup, {
          x,
          y: y + 10,
          dx,
          dy,
          speedNorm,
          dtSec,
          elapsedMs: studioSurfaceElapsedMs
        });
        replayPreviousPositions.set(rr.id, { x, y });
      }
      runnerPreviousPosition = null;
    } else {
      replayPreviousPositions.clear();
      if (runner.visible) {
        const x = runner.position.x;
        const y = runner.position.y;
        const dx = runnerPreviousPosition ? x - runnerPreviousPosition.x : 0;
        const dy = runnerPreviousPosition ? y - runnerPreviousPosition.y : 0;
        const distance = Math.hypot(dx, dy);
        const speedNorm = Math.max(0.12, Math.min(1, distance / Math.max(8, 160 * dtSec)));
        emitSurfaceParticles(studioSurfaceParticles, setup, {
          x,
          y: y + 10,
          dx,
          dy,
          speedNorm,
          dtSec,
          elapsedMs: studioSurfaceElapsedMs
        });
        runnerPreviousPosition = { x, y };
      } else {
        runnerPreviousPosition = null;
      }
    }

    tickSurfaceParticles(studioSurfaceParticles, setup, dtSec);
    drawSurfaceParticles(surfaceEffectLayer, studioSurfaceParticles);
  };

  const drawSpritePreviewPlaceholder = (
    canvas: HTMLCanvasElement,
    message: string,
    isLarge: boolean
  ): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#071522';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(131, 165, 199, 0.22)';
    for (let x = 0; x < canvas.width; x += isLarge ? 36 : 28) {
      ctx.fillRect(x, 0, 1, canvas.height);
    }
    for (let y = 0; y < canvas.height; y += isLarge ? 36 : 28) {
      ctx.fillRect(0, y, canvas.width, 1);
    }

    ctx.fillStyle = '#b7d5ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = isLarge ? '18px Segoe UI' : '13px Segoe UI';
    ctx.fillText(message, canvas.width * 0.5, canvas.height * 0.5);
  };

  const drawSpritePreviewSingle = (
    canvas: HTMLCanvasElement,
    pack: GeneratedRacerSpritePack,
    frameIndex: number,
    variantIndex: number,
    isLarge: boolean
  ): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#071522';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const variantCount = pack.meta.racerVariantCount;
    if (variantCount <= 0) {
      drawSpritePreviewPlaceholder(canvas, 'No variants available.', isLarge);
      return;
    }

    const normalizedVariantIndex = ((variantIndex % variantCount) + variantCount) % variantCount;
    const frameMetaIndex = normalizedVariantIndex * pack.meta.frameCount + frameIndex;
    const frame = pack.meta.frames[frameMetaIndex];
    if (!frame) {
      drawSpritePreviewPlaceholder(canvas, 'Preview frame missing.', isLarge);
      return;
    }

    const targetW = Math.min(
      canvas.width * (isLarge ? 0.78 : 0.72),
      frame.width * (isLarge ? 4.4 : 3)
    );
    const targetH = (frame.height / frame.width) * targetW;
    const dx = (canvas.width - targetW) * 0.5;
    const dy = (canvas.height - targetH) * 0.55;

    ctx.fillStyle = 'rgba(8, 16, 24, 0.28)';
    ctx.fillRect(2, 2, canvas.width - 4, canvas.height - 4);
    ctx.drawImage(
      pack.sheetCanvas,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      dx,
      dy,
      targetW,
      targetH
    );

    const variant = pack.meta.variants[normalizedVariantIndex];
    if (variant) {
      const chipWidth = isLarge ? 200 : 160;
      const chipHeight = isLarge ? 30 : 24;
      ctx.fillStyle = 'rgba(5, 16, 28, 0.8)';
      ctx.fillRect(10, 10, chipWidth, chipHeight);
      ctx.fillStyle = '#cfe5ff';
      ctx.font = isLarge ? '14px Segoe UI' : '12px Segoe UI';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Preview ${variant.label} - ${variant.pattern}`, 18, 10 + chipHeight * 0.52);
    }
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
    spritePreviewFrameElapsedMs += deltaMs;
    while (spritePreviewFrameElapsedMs >= frameDurationMs) {
      spritePreviewFrameElapsedMs -= frameDurationMs;
      spritePreviewFrameIndex = (spritePreviewFrameIndex + 1) % generatedRacerPack.meta.frameCount;
    }

    spritePreviewVariantElapsedMs += deltaMs;
    if (spritePreviewVariantElapsedMs >= 1400) {
      spritePreviewVariantElapsedMs = 0;
      spritePreviewVariantIndex =
        (spritePreviewVariantIndex + 1) % Math.max(1, generatedRacerPack.meta.racerVariantCount);
      rebuildTrackPreviewTextures(generatedRacerPack, spritePreviewVariantIndex);
    }

    drawSpritePreviewSingle(
      dom.spritePackAnimPreviewCanvas,
      generatedRacerPack,
      spritePreviewFrameIndex,
      spritePreviewVariantIndex,
      false
    );
  };

  function getCenterlinePoints(): TrackPoint[] {
    if (
      trackEditMode === 'boundaries' &&
      leftBoundaryPoints.length >= 3 &&
      rightBoundaryPoints.length >= 3
    ) {
      return buildCenterlineFromBoundaries(leftBoundaryPoints, rightBoundaryPoints);
    }
    return points;
  }

  function ensureBoundaryPointsFromCenterline(): void {
    if (leftBoundaryPoints.length >= 3 && rightBoundaryPoints.length >= 3) return;
    const source = points.length >= 3 ? points : SAMPLE_CURVY_POINTS;
    const generated = buildBoundaryPairFromCenterline(source, laneWidthPx * 8);
    leftBoundaryPoints = generated.left;
    rightBoundaryPoints = generated.right;
  }

  function getEditablePoints(): TrackPoint[] {
    if (trackEditMode !== 'boundaries') return points;
    return boundaryEditSide === 'left' ? leftBoundaryPoints : rightBoundaryPoints;
  }

  function setEditablePoints(nextPoints: TrackPoint[]): void {
    if (trackEditMode !== 'boundaries') {
      points = nextPoints;
      return;
    }

    if (boundaryEditSide === 'left') {
      leftBoundaryPoints = nextPoints;
    } else {
      rightBoundaryPoints = nextPoints;
    }

    const other = boundaryEditSide === 'left' ? rightBoundaryPoints : leftBoundaryPoints;
    if (other.length >= 3 && nextPoints.length >= 3) {
      points = buildCenterlineFromBoundaries(
        boundaryEditSide === 'left' ? nextPoints : leftBoundaryPoints,
        boundaryEditSide === 'right' ? nextPoints : rightBoundaryPoints
      );
    }
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
    dom.trackEditModeSelect.value = trackEditMode;
    dom.trackOrientationSelect.value = trackOrientation;
    dom.boundaryEditSideSelect.value = boundaryEditSide;
    dom.boundaryEditSideSelect.disabled = trackEditMode !== 'boundaries';

    dom.laneWidthInput.value = String(laneWidthPx);
    dom.laneWidthValue.textContent = `${laneWidthPx} px`;

    dom.racerCountInput.value = String(replayRacerCount);
    dom.racerCountValue.textContent = String(replayRacerCount);

    dom.nameModeSelect.value = nameDisplayMode;
    dom.focusRacerInput.value = String(focusRacerNumber);
    dom.focusRacerLabel.textContent = `D${focusRacerNumber}`;

    dom.previewToggleButton.textContent = playingPreview ? 'Pause Preview' : 'Play Preview';
    dom.smoothToggleButton.textContent = `Smoothing: ${smoothingEnabled ? 'On' : 'Off'}`;
    dom.replayToggleButton.textContent = `Replay Test: ${replayModeEnabled ? 'On' : 'Off'}`;
    dom.laneBoardsToggleButton.textContent = `Lane Boards: ${laneBoardsVisible ? 'On' : 'Off'}`;
    dom.broadcastToggleButton.textContent = `Broadcast View: ${broadcastViewEnabled ? 'On' : 'Off'}`;
  };

  const buildCurrentTestPreset = (): StudioTestPreset => {
    const preset: StudioTestPreset = {
      version: 1,
      trackId: dom.trackIdInput.value.trim() || DEFAULT_EDITOR_TRACK_ID,
      trackName: dom.trackNameInput.value.trim() || 'Custom Track',
      effectProfileId: dom.effectProfileInput.value.trim(),
      points: points.map((p) => ({ x: round3(p.x), y: round3(p.y) })),
      trackEditMode,
      trackOrientation,
      boundaryEditSide,
      leftBoundaryPoints: leftBoundaryPoints.map((p) => ({ x: round3(p.x), y: round3(p.y) })),
      rightBoundaryPoints: rightBoundaryPoints.map((p) => ({ x: round3(p.x), y: round3(p.y) })),
      laneWidthPx,
      replayRacerCount,
      nameDisplayMode,
      focusRacerNumber,
      playingPreview,
      smoothingEnabled,
      replayModeEnabled,
      laneBoardsVisible,
      editorGeometryMode: 'geometry-rotated-v1'
    };
    const backgroundDataUrl = backgroundController.getBackgroundDataUrl();
    if (backgroundDataUrl) {
      preset.backgroundImageDataUrl = backgroundDataUrl;
    }
    return preset;
  };

  const saveTestPreset = async (): Promise<void> => {
    const presetName = dom.presetNameInput.value.trim();
    if (!presetName) {
      dom.editorHelp.textContent = 'Enter a preset name first, then click Save.';
      return;
    }

    const store = loadPresetStore();
    const preset = buildCurrentTestPreset();
    const backgroundDataUrl = preset.backgroundImageDataUrl;
    delete preset.backgroundImageDataUrl;
    preset.hasBackgroundImage = Boolean(backgroundDataUrl);
    store.presets[presetName] = preset;
    store.lastUsedPresetName = presetName;

    if (backgroundDataUrl) {
      try {
        await savePresetBackground(presetName, backgroundDataUrl);
      } catch {
        // Keep backward-compatible fallback for environments without IndexedDB.
        preset.backgroundImageDataUrl = backgroundDataUrl;
        delete preset.hasBackgroundImage;
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
      refreshPresetSelect(presetName);
      dom.editorHelp.textContent = `Preset "${presetName}" saved.`;
      return;
    } catch {
      // If quota is exceeded by image-heavy preset, retry once without background data.
    }

    if (backgroundDataUrl) {
      const lightweightPreset = { ...preset };
      delete lightweightPreset.backgroundImageDataUrl;
      delete lightweightPreset.hasBackgroundImage;
      store.presets[presetName] = lightweightPreset;
      try {
        savePresetStore(store);
        refreshPresetSelect(presetName);
        dom.editorHelp.textContent = `Preset "${presetName}" saved, but background image could not be stored due to browser storage limits.`;
        return;
      } catch {
        // Continue to generic error message below.
      }
    }

    dom.editorHelp.textContent =
      'Could not save test preset (browser storage may be full or blocked).';
  };

  const loadTestPreset = async (): Promise<void> => {
    const presetName = dom.presetSelect.value;
    if (!presetName) {
      dom.editorHelp.textContent = 'No preset selected. Choose one first.';
      return;
    }

    try {
      const store = loadPresetStore();
      const parsed = store.presets[presetName] as Partial<StudioTestPreset> | undefined;
      if (!parsed) {
        dom.editorHelp.textContent = `Preset "${presetName}" was not found.`;
        refreshPresetSelect();
        return;
      }

      if (!Array.isArray(parsed.points) || parsed.points.length < 3) {
        throw new Error('Invalid preset points');
      }

      points = parsed.points.map((p) => ({ x: round3(Number(p.x)), y: round3(Number(p.y)) }));
      trackEditMode = parsed.trackEditMode === 'boundaries' ? 'boundaries' : 'centerline';
      const nextOrientation = normalizeTrackOrientation(parsed.trackOrientation);
      trackOrientation = nextOrientation;
      boundaryEditSide = parsed.boundaryEditSide === 'right' ? 'right' : 'left';
      leftBoundaryPoints = Array.isArray(parsed.leftBoundaryPoints)
        ? parsed.leftBoundaryPoints.map((p) => ({ x: round3(Number(p.x)), y: round3(Number(p.y)) }))
        : [];
      rightBoundaryPoints = Array.isArray(parsed.rightBoundaryPoints)
        ? parsed.rightBoundaryPoints.map((p) => ({
            x: round3(Number(p.x)),
            y: round3(Number(p.y))
          }))
        : [];
      if (trackEditMode === 'boundaries') {
        ensureBoundaryPointsFromCenterline();
        points = buildCenterlineFromBoundaries(leftBoundaryPoints, rightBoundaryPoints);
      }

      if (
        nextOrientation === 'top-to-bottom' &&
        parsed.editorGeometryMode !== 'geometry-rotated-v1'
      ) {
        const orientationCenter = computeTrackOrientationCenter(points);
        points = rotateTrackPointsBetweenOrientations(
          points,
          'left-to-right',
          'top-to-bottom',
          orientationCenter
        );
        if (leftBoundaryPoints.length >= 3) {
          leftBoundaryPoints = rotateTrackPointsBetweenOrientations(
            leftBoundaryPoints,
            'left-to-right',
            'top-to-bottom',
            orientationCenter
          );
        }
        if (rightBoundaryPoints.length >= 3) {
          rightBoundaryPoints = rotateTrackPointsBetweenOrientations(
            rightBoundaryPoints,
            'left-to-right',
            'top-to-bottom',
            orientationCenter
          );
        }
      }
      dom.trackIdInput.value =
        (parsed.trackId ?? DEFAULT_EDITOR_TRACK_ID).trim() || DEFAULT_EDITOR_TRACK_ID;
      dom.trackNameInput.value = (parsed.trackName ?? 'Custom Track').trim() || 'Custom Track';
      dom.effectProfileInput.value = (parsed.effectProfileId ?? '').trim();

      laneWidthPx = clampInteger(Number(parsed.laneWidthPx), 1, 24, laneWidthPx);
      replayRacerCount = clampInteger(Number(parsed.replayRacerCount), 2, 100, replayRacerCount);
      nameDisplayMode = toNameDisplayMode(String(parsed.nameDisplayMode ?? nameDisplayMode));
      focusRacerNumber = normalizeFocusRacerNumber(
        Number(parsed.focusRacerNumber ?? focusRacerNumber),
        replayRacerCount
      );
      playingPreview = parsed.playingPreview !== false;
      smoothingEnabled = parsed.smoothingEnabled !== false;
      replayModeEnabled = parsed.replayModeEnabled === true;
      laneBoardsVisible = parsed.laneBoardsVisible === true;
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

      const inlineBackground =
        typeof parsed.backgroundImageDataUrl === 'string' ? parsed.backgroundImageDataUrl : null;
      if (inlineBackground) {
        await backgroundController.loadBackgroundFromDataUrl(inlineBackground);
      } else if (parsed.hasBackgroundImage) {
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
      store.lastUsedPresetName = presetName;
      savePresetStore(store);
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

    const store = loadPresetStore();
    if (!store.presets[presetName]) {
      dom.editorHelp.textContent = `Preset "${presetName}" does not exist anymore.`;
      refreshPresetSelect();
      return;
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
    refreshPresetSelect();
    dom.editorHelp.textContent = `Preset "${presetName}" deleted.`;
  };

  const refreshPresetSelect = (preferredName?: string): void => {
    const store = loadPresetStore();
    const names = Object.keys(store.presets).sort((a, b) => a.localeCompare(b));
    const currentValue = dom.presetSelect.value;
    const nextSelected =
      (preferredName && names.includes(preferredName) && preferredName) ||
      (currentValue && names.includes(currentValue) && currentValue) ||
      (store.lastUsedPresetName && names.includes(store.lastUsedPresetName)
        ? store.lastUsedPresetName
        : (names[0] ?? ''));

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
    for (const rr of replayRacers) {
      runnerLayer.removeChild(rr.sprite);
      labelLayer.removeChild(rr.labelBg);
      labelLayer.removeChild(rr.labelText);
      rr.labelBg.destroy();
      rr.labelText.destroy();
      rr.sprite.destroy();
    }

    const ids = createRacerIds(replayRacerCount);
    const runtimeRacerPack = getRuntimeRacerPack(replayRacerCount);
    const markerRadius =
      replayRacerCount >= 90 ? 4 : replayRacerCount >= 70 ? 5 : replayRacerCount >= 45 ? 6 : 9;
    const labelFontSize =
      replayRacerCount >= 90 ? 7 : replayRacerCount >= 70 ? 8 : replayRacerCount >= 45 ? 9 : 11;

    replayRacers = ids.map((id, index) => {
      const racer = new Container();
      const bodySprite = createRacerSpriteFromPack(runtimeRacerPack, index, markerRadius * 2.6);
      racer.addChild(bodySprite);

      const marker = new Graphics();
      marker.beginFill(0xffffff, 0.01);
      marker.drawCircle(0, 0, markerRadius);
      marker.endFill();
      racer.addChild(marker);

      const labelText = new Text(`D${index + 1}`, {
        fontFamily: 'Segoe UI',
        fontSize: labelFontSize,
        fill: 0xffffff,
        stroke: 0x001018,
        strokeThickness: 2
      });
      labelText.anchor.set(0.5, 1);

      const padX = 5;
      const padY = 2;
      const labelBg = new Graphics();
      labelBg.beginFill(0x0e2231, 0.88);
      labelBg.lineStyle(1, 0x8ab9ff, 0.7);
      labelBg.drawRoundedRect(
        -labelText.width / 2 - padX,
        -labelText.height - padY * 2,
        labelText.width + padX * 2,
        labelText.height + padY * 2,
        4
      );
      labelBg.endFill();
      labelBg.y = -markerRadius - 2;
      labelText.y = -markerRadius - 2;
      labelBg.visible = false;
      labelText.visible = false;

      labelLayer.addChild(labelBg);
      labelLayer.addChild(labelText);
      racer.visible = false;
      racer.eventMode = 'static';
      racer.on('pointerover', () => {
        const target = replayRacers.find((entry) => entry.id === id);
        if (target) target.hovered = true;
      });
      racer.on('pointerout', () => {
        const target = replayRacers.find((entry) => entry.id === id);
        if (target) target.hovered = false;
      });
      runnerLayer.addChild(racer);
      return {
        id,
        index,
        sprite: racer,
        marker,
        bodySprite,
        bodyBaseScaleX: bodySprite.scale.x,
        bodyBaseScaleY: bodySprite.scale.y,
        labelBg,
        labelText,
        progress: 0,
        hovered: false
      };
    });

    focusRacerNumber = normalizeFocusRacerNumber(focusRacerNumber, replayRacerCount);
    dom.focusRacerInput.value = String(focusRacerNumber);
    dom.focusRacerLabel.textContent = `D${focusRacerNumber}`;
    dom.leaderboardList.innerHTML = '';
    applyReplaySpriteSizeFromSlider();
    regenerateReplayData();
  }

  const applyReplaySpriteSizeFromSlider = (): void => {
    const sizeFactor = resolveTrackPreviewSizePx() / 34;
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

  const downloadTextFile = (filename: string, content: string): void => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadDataUrl = (filename: string, dataUrl: string): void => {
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.click();
  };

  const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not load selected image.'));
      };
      image.src = url;
    });

  const buildDefaultRacerSourceImage = (): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable for default racer source.');
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(32, 35, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(41, 29, 9, 8, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#eaf3ff';
    ctx.fillRect(22, 23, 12, 6);

    ctx.fillStyle = '#111d2b';
    ctx.beginPath();
    ctx.arc(45, 27, 1.9, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
  };

  const getRuntimeRacerPack = (requiredRacerCount: number): GeneratedRacerSpritePack => {
    if (generatedRacerPack) {
      return generatedRacerPack;
    }

    const key = `${requiredRacerCount}`;
    if (fallbackRuntimeRacerPack && fallbackRuntimeRacerPackKey === key) {
      return fallbackRuntimeRacerPack;
    }

    const defaultSourceImage = buildDefaultRacerSourceImage();
    fallbackRuntimeRacerPack = generateRacerSpritePackFromImage(
      defaultSourceImage,
      defaultSourceImage.width,
      defaultSourceImage.height,
      {
        frameCount: DEFAULT_RUNTIME_PACK_FRAME_COUNT,
        racerVariantCount: requiredRacerCount,
        frameDurationMs: 90,
        outputScale: 1,
        paddingPx: 6
      }
    );
    fallbackRuntimeRacerPackKey = key;
    return fallbackRuntimeRacerPack;
  };

  const createRacerSpriteFromPack = (
    pack: GeneratedRacerSpritePack,
    racerIndex: number,
    desiredSize: number
  ): Sprite => {
    const variantCount = Math.max(1, pack.meta.racerVariantCount);
    const variantIndex = racerIndex % variantCount;
    const frameMetaIndex = variantIndex * pack.meta.frameCount;
    const frame = pack.meta.frames[frameMetaIndex]!;

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = frame.width;
    frameCanvas.height = frame.height;
    const frameCtx = frameCanvas.getContext('2d');
    if (!frameCtx) {
      throw new Error('Canvas 2D context unavailable for runtime racer sprite extraction.');
    }

    frameCtx.drawImage(
      pack.sheetCanvas,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      frame.width,
      frame.height
    );

    const sprite = Sprite.from(frameCanvas);
    sprite.anchor.set(0.5);
    const scale = desiredSize / Math.max(frame.width, frame.height);
    sprite.scale.set(Math.max(0.2, scale));
    return sprite;
  };

  const resolveTrackPreviewSizePx = (): number => {
    const rawValue = Number(dom.trackPreviewSizeInput.value);
    if (!Number.isFinite(rawValue)) return 34;
    return Math.max(16, Math.min(96, rawValue));
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
        const orientationCenter = computeTrackOrientationCenter(points);
        points = rotateTrackPointsBetweenOrientations(
          points,
          trackOrientation,
          nextOrientation,
          orientationCenter
        );
        if (leftBoundaryPoints.length >= 3) {
          leftBoundaryPoints = rotateTrackPointsBetweenOrientations(
            leftBoundaryPoints,
            trackOrientation,
            nextOrientation,
            orientationCenter
          );
        }
        if (rightBoundaryPoints.length >= 3) {
          rightBoundaryPoints = rotateTrackPointsBetweenOrientations(
            rightBoundaryPoints,
            trackOrientation,
            nextOrientation,
            orientationCenter
          );
        }
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

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !broadcastViewEnabled) return;

    broadcastViewEnabled = false;
    dom.broadcastToggleButton.textContent = 'Broadcast View: Off';
    dom.editorHelp.textContent = 'Editor view active: full track + points for editing.';
    applyViewMode();
  });

  window.addEventListener('resize', () => {
    if (!broadcastViewEnabled) return;
    applyViewMode();
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
    world.scale.set(editorZoom);
    world.position.set(
      app.screen.width * 0.5 - editorViewCenterX * editorZoom,
      app.screen.height * 0.5 - editorViewCenterY * editorZoom
    );
  };

  const resetEditorView = (): void => {
    editorZoom = 1;
    editorViewCenterX = VIEW_WIDTH * 0.5;
    editorViewCenterY = VIEW_HEIGHT * 0.5;
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
    const clampedZoom = Math.max(MIN_EDITOR_ZOOM, Math.min(MAX_EDITOR_ZOOM, nextZoom));
    if (Math.abs(clampedZoom - editorZoom) < 0.0001) {
      return;
    }

    const worldX = (screenX - world.position.x) / editorZoom;
    const worldY = (screenY - world.position.y) / editorZoom;

    editorZoom = clampedZoom;
    editorViewCenterX = worldX - (screenX - app.screen.width * 0.5) / editorZoom;
    editorViewCenterY = worldY - (screenY - app.screen.height * 0.5) / editorZoom;

    updateEditorZoomUi();
    if (!broadcastViewEnabled) {
      applyEditorViewTransform();
    }
  };

  dom.editorZoomInput.addEventListener('input', () => {
    const nextZoom = Number(dom.editorZoomInput.value) / 100;
    setEditorZoomAroundScreenPoint(nextZoom, app.screen.width * 0.5, app.screen.height * 0.5);
  });

  dom.zoomResetButton.addEventListener('click', () => {
    resetEditorView();
    dom.editorHelp.textContent = 'Editor zoom reset to 100%.';
  });

  const editorCanvas = app.view as HTMLCanvasElement | undefined;
  if (editorCanvas) {
    editorCanvas.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        if (broadcastViewEnabled) {
          return;
        }

        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
        setEditorZoomAroundScreenPoint(editorZoom * zoomFactor, event.offsetX, event.offsetY);
      },
      { passive: false }
    );
  }

  dom.trackTemplatePointsInput.addEventListener('input', () => {
    dom.trackTemplatePointsValue.textContent = dom.trackTemplatePointsInput.value;
  });

  dom.spriteFrameCountInput.addEventListener('input', () => {
    dom.spriteFrameCountValue.textContent = dom.spriteFrameCountInput.value;
    refreshGeneratorPresetHighlight();
    refreshSpriteGenerationWarning();
  });

  dom.trackPreviewSizeInput.addEventListener('input', () => {
    dom.trackPreviewSizeValue.textContent = `${dom.trackPreviewSizeInput.value} px`;
    applyReplaySpriteSizeFromSlider();
  });

  dom.spriteVariantCountInput.addEventListener('input', () => {
    dom.spriteVariantCountValue.textContent = dom.spriteVariantCountInput.value;
    refreshGeneratorPresetHighlight();
    refreshSpriteGenerationWarning();
  });

  dom.spritePresetMinimalButton?.addEventListener('click', () => {
    applyGeneratorPreset(8, 8, 'Minimal');
    refreshSpriteGenerationWarning();
  });

  dom.spritePresetBalancedButton?.addEventListener('click', () => {
    applyGeneratorPreset(10, 12, 'Balanced');
    refreshSpriteGenerationWarning();
  });

  dom.spritePresetMaxContrastButton?.addEventListener('click', () => {
    applyGeneratorPreset(16, 24, 'Max Contrast');
    refreshSpriteGenerationWarning();
  });

  dom.spriteSourceImageInput.addEventListener('change', async () => {
    const file = dom.spriteSourceImageInput.files?.[0] ?? null;
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
  });

  dom.surfaceRaceTypeSelect.addEventListener('change', () => {
    const selectedRaceType = dom.surfaceRaceTypeSelect.value;
    dom.editorHelp.textContent =
      selectedRaceType === 'auto'
        ? 'Surface race type back on Auto resolver.'
        : `Surface race type forced to "${selectedRaceType}".`;
  });

  dom.surfaceCategorySelect.addEventListener('change', () => {
    const selectedCategory = dom.surfaceCategorySelect.value;
    dom.editorHelp.textContent =
      selectedCategory === 'auto'
        ? 'Racer category back on Auto resolver.'
        : `Racer category forced to "${selectedCategory}".`;
  });

  dom.surfaceSizeClassSelect.addEventListener('change', () => {
    const selectedSizeClass = dom.surfaceSizeClassSelect.value;
    dom.editorHelp.textContent =
      selectedSizeClass === 'auto'
        ? 'Effect size class back on Auto resolver.'
        : `Effect size class forced to "${selectedSizeClass}".`;
  });

  dom.surfaceProfileSelect.addEventListener('change', () => {
    const selectedProfile = dom.surfaceProfileSelect.value;
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
  });

  dom.generateTrackTemplateButton.addEventListener('click', () => {
    const kind = dom.trackTemplateSelect.value as TrackTemplateKind;
    const controlPointCount = Number(dom.trackTemplatePointsInput.value);

    let generatedPoints = generateTrackTemplate({
      kind,
      controlPointCount,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      margin: 80
    });

    if (trackOrientation === 'top-to-bottom') {
      const center = computeTrackOrientationCenter(generatedPoints);
      generatedPoints = rotateTrackPointsBetweenOrientations(
        generatedPoints,
        'left-to-right',
        'top-to-bottom',
        center
      );
    }

    if (trackEditMode === 'boundaries') {
      const generatedBoundaryPair = buildBoundaryPairFromCenterline(
        generatedPoints,
        laneWidthPx * 8
      );
      leftBoundaryPoints = generatedBoundaryPair.left;
      rightBoundaryPoints = generatedBoundaryPair.right;
      points = buildCenterlineFromBoundaries(leftBoundaryPoints, rightBoundaryPoints);
    } else {
      points = generatedPoints;
    }

    resetReplayPreviewState();
    renderPointsChanged();
    dom.editorHelp.textContent = `Generated ${kind} template with ${controlPointCount} control points.`;
  });

  dom.generateSpriteSheetButton.addEventListener('click', async () => {
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
      spritePreviewFrameIndex = 0;
      spritePreviewFrameElapsedMs = 0;
      spritePreviewVariantIndex = 0;
      spritePreviewVariantElapsedMs = 0;
      rebuildTrackPreviewTextures(generated, 0);
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
  });

  dom.downloadSpriteSheetButton.addEventListener('click', () => {
    if (!generatedSpriteSheetDataUrl) {
      return;
    }
    downloadDataUrl('generated-racer-pack.png', generatedSpriteSheetDataUrl);
  });

  dom.downloadSpriteMetaButton.addEventListener('click', () => {
    if (!generatedSpriteSheetMeta) {
      return;
    }
    downloadTextFile(
      'generated-racer-pack.meta.json',
      JSON.stringify(generatedSpriteSheetMeta, null, 2)
    );
  });

  dom.boundaryEditSideSelect.addEventListener('change', () => {
    boundaryEditSide = dom.boundaryEditSideSelect.value === 'right' ? 'right' : 'left';
    renderPointsChanged();
  });

  dom.trackIdInput.addEventListener('input', () =>
    refreshExport(dom, points, {
      mode: trackEditMode,
      activeSide: boundaryEditSide,
      leftBoundaryPoints,
      rightBoundaryPoints
    })
  );
  dom.trackNameInput.addEventListener('input', () =>
    refreshExport(dom, points, {
      mode: trackEditMode,
      activeSide: boundaryEditSide,
      leftBoundaryPoints,
      rightBoundaryPoints
    })
  );
  dom.effectProfileInput.addEventListener('input', () => {
    syncSurfaceProfileSelectFromInput();
    refreshExport(dom, points, {
      mode: trackEditMode,
      activeSide: boundaryEditSide,
      leftBoundaryPoints,
      rightBoundaryPoints
    });
  });
  dom.savePresetButton.addEventListener('click', () => {
    void saveTestPreset();
  });
  dom.loadPresetButton.addEventListener('click', () => {
    void loadTestPreset();
  });
  dom.deletePresetButton.addEventListener('click', () => {
    void deleteSelectedPreset();
  });
  dom.presetSelect.addEventListener('change', () => {
    dom.presetNameInput.value = dom.presetSelect.value;
  });

  dom.copyJsonButton.addEventListener('click', async () => {
    const payload = dom.jsonOutput.value;
    try {
      await navigator.clipboard.writeText(payload);
      dom.editorHelp.textContent = 'Track JSON copied to clipboard.';
    } catch {
      dom.editorHelp.textContent = 'Clipboard copy failed. Copy manually from the JSON area.';
    }
  });

  dom.downloadJsonButton.addEventListener('click', () => {
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
  });

  dom.loadJsonButton.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(dom.jsonOutput.value) as {
        points?: TrackPoint[];
        id?: string;
        name?: string;
        editorPathMode?: string;
        editorBoundaries?: {
          left?: TrackPoint[];
          right?: TrackPoint[];
        };
        editorTrackOrientation?: string;
      };
      if (!Array.isArray(parsed.points) || parsed.points.length < 3) {
        throw new Error('points array missing');
      }
      points = parsed.points.map((p) => ({ x: round3(Number(p.x)), y: round3(Number(p.y)) }));

      if (
        parsed.editorPathMode === 'boundaries' &&
        Array.isArray(parsed.editorBoundaries?.left) &&
        Array.isArray(parsed.editorBoundaries?.right) &&
        parsed.editorBoundaries.left.length >= 3 &&
        parsed.editorBoundaries.right.length >= 3
      ) {
        trackEditMode = 'boundaries';
        leftBoundaryPoints = parsed.editorBoundaries.left.map((p) => ({
          x: round3(Number(p.x)),
          y: round3(Number(p.y))
        }));
        rightBoundaryPoints = parsed.editorBoundaries.right.map((p) => ({
          x: round3(Number(p.x)),
          y: round3(Number(p.y))
        }));
        points = buildCenterlineFromBoundaries(leftBoundaryPoints, rightBoundaryPoints);
      } else {
        trackEditMode = 'centerline';
      }

      trackOrientation = normalizeTrackOrientation(parsed.editorTrackOrientation);

      if (trackOrientation === 'top-to-bottom') {
        const orientationCenter = computeTrackOrientationCenter(points);
        points = rotateTrackPointsBetweenOrientations(
          points,
          'left-to-right',
          'top-to-bottom',
          orientationCenter
        );
        if (leftBoundaryPoints.length >= 3) {
          leftBoundaryPoints = rotateTrackPointsBetweenOrientations(
            leftBoundaryPoints,
            'left-to-right',
            'top-to-bottom',
            orientationCenter
          );
        }
        if (rightBoundaryPoints.length >= 3) {
          rightBoundaryPoints = rotateTrackPointsBetweenOrientations(
            rightBoundaryPoints,
            'left-to-right',
            'top-to-bottom',
            orientationCenter
          );
        }
      }

      if (parsed.id) dom.trackIdInput.value = parsed.id;
      if (parsed.name) dom.trackNameInput.value = parsed.name;
      resetReplayPreviewState();
      syncUiFromState();
      renderPointsChanged();
      dom.editorHelp.textContent = 'Track loaded from JSON preview.';
    } catch {
      dom.editorHelp.textContent = 'Could not parse track JSON. Check the JSON preview format.';
    }
  });

  renderPointsChanged();
  syncUiFromState();
  refreshPresetSelect();
  applyViewMode();

  app.ticker.add((delta) => {
    const dt = delta / 60;
    renderGeneratedSpritePreviews(dt * 1000);
    const backgroundSprite = backgroundController.getBackgroundSprite();

    if (points.length < 3) {
      runner.visible = false;
      for (const rr of replayRacers) {
        rr.sprite.visible = false;
      }
      laneBoardLayer.clear();
      surfaceEffectLayer.clear();
      studioSurfaceParticles.length = 0;
      replayPreviousPositions.clear();
      runnerPreviousPosition = null;
      if (broadcastViewEnabled) {
        resetWorldTransform(world);
      } else {
        applyEditorViewTransform();
      }
      return;
    }

    let renderPoints =
      backgroundSprite && broadcastViewEnabled
        ? mapTrackPointsToCurrentLayout(
            points,
            backgroundSprite.texture.width,
            backgroundSprite.texture.height,
            VIEW_WIDTH,
            VIEW_HEIGHT,
            app.screen.width,
            app.screen.height,
            false,
            true
          )
        : points;

    let renderLeftBoundaryPoints: TrackPoint[] | null = null;
    let renderRightBoundaryPoints: TrackPoint[] | null = null;
    let boundaryFinishPoint: TrackPoint | null = null;
    let boundaryCoastPoint: TrackPoint | null = null;
    let raceCenterline: TrackPoint[] | null = null;

    if (
      trackEditMode === 'boundaries' &&
      leftBoundaryPoints.length >= 3 &&
      rightBoundaryPoints.length >= 3
    ) {
      const mappedLeft =
        backgroundSprite && broadcastViewEnabled
          ? mapTrackPointsToCurrentLayout(
              leftBoundaryPoints,
              backgroundSprite.texture.width,
              backgroundSprite.texture.height,
              VIEW_WIDTH,
              VIEW_HEIGHT,
              app.screen.width,
              app.screen.height,
              false,
              true
            )
          : leftBoundaryPoints;
      const mappedRight =
        backgroundSprite && broadcastViewEnabled
          ? mapTrackPointsToCurrentLayout(
              rightBoundaryPoints,
              backgroundSprite.texture.width,
              backgroundSprite.texture.height,
              VIEW_WIDTH,
              VIEW_HEIGHT,
              app.screen.width,
              app.screen.height,
              false,
              true
            )
          : rightBoundaryPoints;

      const leftFinishControl = mappedLeft[mappedLeft.length - 2]!;
      const rightFinishControl = mappedRight[mappedRight.length - 2]!;
      const leftCoastControl = mappedLeft[mappedLeft.length - 1]!;
      const rightCoastControl = mappedRight[mappedRight.length - 1]!;

      // Convention: first point = start, penultimate = finish line, last = coast-zone end.
      // Build race centerline from boundaries WITHOUT the last (coast) point,
      // so the centerline naturally ends at the finish line.
      const raceLeft = mappedLeft.slice(0, -1);
      const raceRight = mappedRight.slice(0, -1);

      boundaryFinishPoint = {
        x: round3((leftFinishControl.x + rightFinishControl.x) * 0.5),
        y: round3((leftFinishControl.y + rightFinishControl.y) * 0.5)
      };
      boundaryCoastPoint = {
        x: round3((leftCoastControl.x + rightCoastControl.x) * 0.5),
        y: round3((leftCoastControl.y + rightCoastControl.y) * 0.5)
      };

      renderLeftBoundaryPoints = smoothingEnabled
        ? buildSmoothedPreviewPath(mappedLeft, 10)
        : mappedLeft;
      renderRightBoundaryPoints = smoothingEnabled
        ? buildSmoothedPreviewPath(mappedRight, 10)
        : mappedRight;
      // Full centerline (including coast zone) for preview/editor display.
      renderPoints = buildCenterlineFromBoundaries(
        renderLeftBoundaryPoints,
        renderRightBoundaryPoints
      );
      // Race-only centerline (up to finish line) from boundaries without coast point.
      const raceLeftSmoothed = smoothingEnabled ? buildSmoothedPreviewPath(raceLeft, 10) : raceLeft;
      const raceRightSmoothed = smoothingEnabled
        ? buildSmoothedPreviewPath(raceRight, 10)
        : raceRight;
      raceCenterline = buildCenterlineFromBoundaries(raceLeftSmoothed, raceRightSmoothed);
    }

    const previewPath = smoothingEnabled
      ? buildSmoothedPreviewPath(renderPoints, 10)
      : renderPoints;

    // In boundary mode, use the race-only centerline (ends at finish line).
    // In centerline mode, use all points except the last (coast end) as before.
    let replayRacePath: TrackPoint[];
    if (trackEditMode === 'boundaries' && raceCenterline) {
      replayRacePath = smoothingEnabled
        ? buildSmoothedPreviewPath(raceCenterline, 10)
        : raceCenterline;
    } else {
      const replayRaceControlPoints = renderPoints.slice(0, -1);
      replayRacePath = smoothingEnabled
        ? buildSmoothedPreviewPath(replayRaceControlPoints, 10)
        : replayRaceControlPoints;
    }
    const coastEndPoint = boundaryCoastPoint ?? renderPoints[renderPoints.length - 1] ?? null;

    if (replayModeEnabled) {
      runner.visible = false;
      const replayTick = tickStudioReplayMode({
        dt,
        playingPreview,
        replayTimeMs,
        leaderboardTickMs,
        replayData,
        replayRacers,
        laneWidthPx,
        laneBoardsVisible,
        racePath: replayRacePath,
        coastEndPoint,
        previewPath,
        leftBoundaryPath: renderLeftBoundaryPoints,
        rightBoundaryPath: renderRightBoundaryPoints,
        laneBoardLayer,
        nameDisplayMode,
        focusRacerNumber,
        leaderboardList: dom.leaderboardList,
        broadcastViewEnabled,
        camera,
        world,
        appScreenWidth: app.screen.width,
        appScreenHeight: app.screen.height,
        backgroundSprite,
        regenerateReplayData,
        replayRunId
      });
      replayTimeMs = replayTick.replayTimeMs;
      leaderboardTickMs = replayTick.leaderboardTickMs;
      replayData = replayTick.replayData;
      applyReplaySpriteSizeFromSlider();
      updateStudioSurfaceEffects(dt);
      return;
    }

    const singleTick = tickStudioSinglePreviewMode({
      dt,
      playingPreview,
      previewProgress,
      singlePreviewElapsedSeconds,
      runnerSpeed: RUNNER_SPEED,
      previewPath,
      runner,
      replayRacers,
      leaderboardList: dom.leaderboardList,
      laneBoardLayer,
      broadcastViewEnabled,
      camera,
      world,
      appScreenWidth: app.screen.width,
      appScreenHeight: app.screen.height,
      backgroundSprite,
      applyEditorViewTransform
    });
    previewProgress = singleTick.previewProgress;
    singlePreviewElapsedSeconds = singleTick.singlePreviewElapsedSeconds;

    if (generatedRacerPack && trackPreviewTextures.length > 0) {
      const texture = trackPreviewTextures[spritePreviewFrameIndex % trackPreviewTextures.length]!;
      runner.texture = texture;
      const maxTextureEdge = Math.max(texture.width, texture.height) || 1;
      const targetRunnerSizePx = resolveTrackPreviewSizePx();
      const scale = targetRunnerSizePx / maxTextureEdge;
      runner.scale.set(Math.max(0.12, Math.min(3.4, scale)));
    } else {
      runner.texture = defaultRunnerTexture;
      const maxTextureEdge = Math.max(defaultRunnerTexture.width, defaultRunnerTexture.height) || 1;
      const targetRunnerSizePx = resolveTrackPreviewSizePx();
      const scale = targetRunnerSizePx / maxTextureEdge;
      runner.scale.set(Math.max(0.12, Math.min(3.4, scale)));
    }

    updateStudioSurfaceEffects(dt);
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

function loadPresetStore(): StudioTestPresetStore {
  try {
    const raw = localStorage.getItem(STUDIO_TEST_PRESET_STORAGE_KEY);
    if (!raw) {
      return { version: 2, presets: {} };
    }

    const parsed = JSON.parse(raw) as Partial<StudioTestPresetStore>;
    if (parsed.version !== 2 || typeof parsed.presets !== 'object' || parsed.presets === null) {
      return { version: 2, presets: {} };
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
    return { version: 2, presets: {} };
  }
}

function savePresetStore(store: StudioTestPresetStore): void {
  localStorage.setItem(STUDIO_TEST_PRESET_STORAGE_KEY, JSON.stringify(store));
}

async function savePresetBackground(presetName: string, dataUrl: string): Promise<void> {
  const db = await openPresetBackgroundDb();
  await runBackgroundStoreRequest(db, 'readwrite', (store) => store.put(dataUrl, presetName));
}

async function loadPresetBackground(presetName: string): Promise<string | null> {
  const db = await openPresetBackgroundDb();
  const value = await runBackgroundStoreRequest(db, 'readonly', (store) => store.get(presetName));
  return typeof value === 'string' ? value : null;
}

async function deletePresetBackground(presetName: string): Promise<void> {
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

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function buildCenterlineFromBoundaries(left: TrackPoint[], right: TrackPoint[]): TrackPoint[] {
  const samples = Math.max(24, Math.min(220, Math.max(left.length, right.length) * 6));
  const centerline: TrackPoint[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const progress = i / samples;
    const l = interpolateTrackPosition(left, progress);
    const r = interpolateTrackPosition(right, progress);
    centerline.push({
      x: round3((l.x + r.x) * 0.5),
      y: round3((l.y + r.y) * 0.5)
    });
  }

  // Keep export/editor manageable while preserving curve fidelity.
  return centerline.filter((_, index) => index % 2 === 0 || index === centerline.length - 1);
}

function buildBoundaryPairFromCenterline(
  centerline: TrackPoint[],
  halfWidth: number
): { left: TrackPoint[]; right: TrackPoint[] } {
  const left: TrackPoint[] = [];
  const right: TrackPoint[] = [];
  for (let i = 0; i < centerline.length; i += 1) {
    const progress = centerline.length <= 1 ? 0 : i / (centerline.length - 1);
    const p = centerline[i]!;
    const n = computeTrackNormal(centerline, progress);
    left.push({ x: round3(p.x + n.x * halfWidth), y: round3(p.y + n.y * halfWidth) });
    right.push({ x: round3(p.x - n.x * halfWidth), y: round3(p.y - n.y * halfWidth) });
  }
  return { left, right };
}
