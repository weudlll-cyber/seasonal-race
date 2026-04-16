/**
 * File: apps/web-viewer/src/studio-app.ts
 * Model: GPT-5.3-Codex
 * Purpose: Runs the studio track editor and replay/broadcast authoring preview.
 * Usage: `pnpm --filter web-viewer dev` then open the viewer and place points.
 * Dependencies: PixiJS and local track-editor utility helpers.
 */

import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { CameraController } from './camera';
import { buildSmoothedPreviewPath, DEFAULT_EDITOR_TRACK_ID } from './track-editor-utils';
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
  { x: 1040, y: 360 }
];

const RUNNER_SPEED = 0.09;
const DEFAULT_REPLAY_RACER_COUNT = 12;

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
  const camera = new CameraController(app.screen.width, app.screen.height);

  const backgroundLayer = new Container();
  const pathLayer = new Graphics();
  const markerLayer = new Graphics();
  const laneBoardLayer = new Graphics();
  const runnerLayer = new Container();
  runnerLayer.sortableChildren = true;
  world.addChild(backgroundLayer);
  world.addChild(pathLayer);
  world.addChild(markerLayer);
  world.addChild(laneBoardLayer);
  world.addChild(runnerLayer);

  const runner = Sprite.from('https://pixijs.io/examples/examples/assets/bunny.png');
  runner.anchor.set(0.5);
  runner.scale.set(1.35);
  runner.visible = false;
  runnerLayer.addChild(runner);

  const replayPalette = [0xf8f08a, 0xff9b6a, 0x6ad6ff, 0xa8f58f, 0xd7a8ff, 0xffe0ff, 0xb9f6ff];
  let replayRacerCount = DEFAULT_REPLAY_RACER_COUNT;
  let replayRacers: StudioReplayRacerView[] = [];

  let points: TrackPoint[] = [...SAMPLE_CURVY_POINTS];
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
  let replayData = buildDemoRecordedRaceData(createRacerIds(replayRacerCount));

  dom.laneWidthInput.value = String(laneWidthPx);
  dom.laneWidthValue.textContent = `${laneWidthPx} px`;
  dom.racerCountInput.value = String(replayRacerCount);
  dom.racerCountValue.textContent = String(replayRacerCount);
  nameDisplayMode = toNameDisplayMode(dom.nameModeSelect.value);
  focusRacerNumber = normalizeFocusRacerNumber(Number(dom.focusRacerInput.value), replayRacerCount);
  dom.focusRacerInput.value = String(focusRacerNumber);
  dom.focusRacerLabel.textContent = `D${focusRacerNumber}`;

  function regenerateReplayData(): ReturnType<typeof buildDemoRecordedRaceData> {
    replayData = buildDemoRecordedRaceData(createRacerIds(replayRacerCount));
    replayTimeMs = 0;
    return replayData;
  }

  function rebuildReplayRacers(): void {
    for (const rr of replayRacers) {
      runnerLayer.removeChild(rr.sprite);
      rr.sprite.destroy();
    }

    const ids = createRacerIds(replayRacerCount);
    const markerRadius =
      replayRacerCount >= 90 ? 4 : replayRacerCount >= 70 ? 5 : replayRacerCount >= 45 ? 6 : 9;
    const labelFontSize =
      replayRacerCount >= 90 ? 7 : replayRacerCount >= 70 ? 8 : replayRacerCount >= 45 ? 9 : 11;

    replayRacers = ids.map((id, index) => {
      const racer = new Container();

      const marker = new Graphics();
      marker.beginFill(replayPalette[index % replayPalette.length]!);
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

      racer.addChild(labelBg);
      racer.addChild(labelText);
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
    regenerateReplayData();
  }

  rebuildReplayRacers();

  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  const renderPointsChanged = (): void => {
    redrawEditor(points, pathLayer, markerLayer, smoothingEnabled, VIEW_WIDTH, VIEW_HEIGHT);
    refreshExport(dom, points);
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
    getPoints: () => points,
    setPoints: (nextPoints) => {
      points = nextPoints;
    },
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
    viewWidth: VIEW_WIDTH,
    viewHeight: VIEW_HEIGHT,
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
      redrawEditor(points, pathLayer, markerLayer, smoothingEnabled, VIEW_WIDTH, VIEW_HEIGHT);
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
      rebuildReplayRacers();
    },
    onNameModeChanged: (value) => {
      nameDisplayMode = toNameDisplayMode(value);
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

  dom.trackIdInput.addEventListener('input', () => refreshExport(dom, points));
  dom.trackNameInput.addEventListener('input', () => refreshExport(dom, points));
  dom.effectProfileInput.addEventListener('input', () => refreshExport(dom, points));

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
      };
      if (!Array.isArray(parsed.points)) {
        throw new Error('points array missing');
      }
      points = parsed.points.map((p) => ({ x: round3(Number(p.x)), y: round3(Number(p.y)) }));
      if (parsed.id) dom.trackIdInput.value = parsed.id;
      if (parsed.name) dom.trackNameInput.value = parsed.name;
      resetReplayPreviewState();
      renderPointsChanged();
      dom.editorHelp.textContent = 'Track loaded from JSON preview.';
    } catch {
      dom.editorHelp.textContent = 'Could not parse track JSON. Check the JSON preview format.';
    }
  });

  renderPointsChanged();
  applyViewMode();

  app.ticker.add((delta) => {
    const dt = delta / 60;
    const backgroundSprite = backgroundController.getBackgroundSprite();

    if (points.length < 2) {
      runner.visible = false;
      for (const rr of replayRacers) {
        rr.sprite.visible = false;
      }
      laneBoardLayer.clear();
      resetWorldTransform(world);
      return;
    }

    const renderPoints =
      backgroundSprite && broadcastViewEnabled
        ? mapTrackPointsToCurrentLayout(
            points,
            backgroundSprite.texture.width,
            backgroundSprite.texture.height,
            VIEW_WIDTH,
            VIEW_HEIGHT,
            false,
            true
          )
        : points;
    const previewPath = smoothingEnabled
      ? buildSmoothedPreviewPath(renderPoints, 10)
      : renderPoints;

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
        previewPath,
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
        regenerateReplayData
      });
      replayTimeMs = replayTick.replayTimeMs;
      leaderboardTickMs = replayTick.leaderboardTickMs;
      replayData = replayTick.replayData;
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
      backgroundSprite
    });
    previewProgress = singleTick.previewProgress;
    singlePreviewElapsedSeconds = singleTick.singlePreviewElapsedSeconds;
  });

  function applyViewMode(): void {
    document.body.classList.toggle('broadcast-mode', broadcastViewEnabled);
    pathLayer.visible = !broadcastViewEnabled;
    markerLayer.visible = !broadcastViewEnabled;
    backgroundController.applyLayoutForCurrentView();
    if (!broadcastViewEnabled) {
      dom.leaderboardList.innerHTML = '';
      resetWorldTransform(world);
    }
  }
}
