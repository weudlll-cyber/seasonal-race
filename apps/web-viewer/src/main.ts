/**
 * File: apps/web-viewer/src/main.ts
 * Purpose: Runs an interactive track editor where users click points to define
 *          race paths and export TrackDefinition JSON.
 * Usage: `pnpm --filter web-viewer dev` then open the viewer and place points.
 * Dependencies: PixiJS and local track-editor utility helpers.
 */

import { Application, Container, Graphics, Sprite } from 'pixi.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import {
  buildTrackDefinition,
  DEFAULT_EDITOR_TRACK_ID,
  DEFAULT_EDITOR_TRACK_NAME,
  interpolateTrackPosition
} from './track-editor-utils';

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

interface EditorDom {
  trackIdInput: HTMLInputElement;
  trackNameInput: HTMLInputElement;
  effectProfileInput: HTMLInputElement;
  pointCountLabel: HTMLElement;
  trackLengthLabel: HTMLElement;
  previewToggleButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  loadCurvyButton: HTMLButtonElement;
  loadStraightButton: HTMLButtonElement;
  copyJsonButton: HTMLButtonElement;
  downloadJsonButton: HTMLButtonElement;
  loadJsonButton: HTMLButtonElement;
  editorHelp: HTMLElement;
  jsonOutput: HTMLTextAreaElement;
}

async function main(): Promise<void> {
  const app = new Application({
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: 0x101923,
    antialias: true
  });

  const mount = document.getElementById('race-canvas');
  if (!mount) throw new Error('Mount element #race-canvas not found');
  mount.appendChild(app.view as HTMLCanvasElement);

  const dom = resolveDom();

  const world = new Container();
  app.stage.addChild(world);

  const pathLayer = new Graphics();
  const markerLayer = new Graphics();
  const runnerLayer = new Container();
  world.addChild(pathLayer);
  world.addChild(markerLayer);
  world.addChild(runnerLayer);

  const runner = Sprite.from('https://pixijs.io/examples/examples/assets/bunny.png');
  runner.anchor.set(0.5);
  runner.scale.set(1.35);
  runner.visible = false;
  runnerLayer.addChild(runner);

  let points: TrackPoint[] = [...SAMPLE_CURVY_POINTS];
  let playingPreview = true;
  let previewProgress = 0;

  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  app.stage.on('pointerdown', (event) => {
    const p = event.global;
    points.push({ x: round3(p.x), y: round3(p.y) });
    previewProgress = 0;
    redrawEditor(points, pathLayer, markerLayer);
    refreshExport(dom, points);
  });

  dom.clearButton.addEventListener('click', () => {
    points = [];
    previewProgress = 0;
    redrawEditor(points, pathLayer, markerLayer);
    refreshExport(dom, points);
  });

  dom.undoButton.addEventListener('click', () => {
    if (points.length === 0) return;
    points = points.slice(0, -1);
    previewProgress = 0;
    redrawEditor(points, pathLayer, markerLayer);
    refreshExport(dom, points);
  });

  dom.loadCurvyButton.addEventListener('click', () => {
    points = [...SAMPLE_CURVY_POINTS];
    previewProgress = 0;
    redrawEditor(points, pathLayer, markerLayer);
    refreshExport(dom, points);
  });

  dom.loadStraightButton.addEventListener('click', () => {
    points = [...SAMPLE_STRAIGHT_POINTS];
    previewProgress = 0;
    redrawEditor(points, pathLayer, markerLayer);
    refreshExport(dom, points);
  });

  dom.previewToggleButton.addEventListener('click', () => {
    playingPreview = !playingPreview;
    dom.previewToggleButton.textContent = playingPreview ? 'Pause Preview' : 'Play Preview';
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
      previewProgress = 0;
      redrawEditor(points, pathLayer, markerLayer);
      refreshExport(dom, points);
      dom.editorHelp.textContent = 'Track loaded from JSON preview.';
    } catch {
      dom.editorHelp.textContent = 'Could not parse track JSON. Check the JSON preview format.';
    }
  });

  redrawEditor(points, pathLayer, markerLayer);
  refreshExport(dom, points);

  app.ticker.add((delta) => {
    const dt = delta / 60;

    if (points.length < 2) {
      runner.visible = false;
      return;
    }

    runner.visible = true;
    if (playingPreview) {
      previewProgress += RUNNER_SPEED * dt;
      if (previewProgress > 1) previewProgress -= 1;
    }

    const pos = interpolateTrackPosition(points, previewProgress);
    runner.position.set(pos.x, pos.y);
  });
}

function redrawEditor(points: TrackPoint[], pathLayer: Graphics, markerLayer: Graphics): void {
  pathLayer.clear();
  markerLayer.clear();

  drawGrid(pathLayer);

  if (points.length === 0) {
    return;
  }

  pathLayer.lineStyle(7, 0x43d6d1, 0.88);
  pathLayer.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) {
    pathLayer.lineTo(points[i]!.x, points[i]!.y);
  }

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const isStart = i === 0;
    const isEnd = i === points.length - 1;
    const color = isStart ? 0x47d147 : isEnd ? 0xe85d5d : 0xfff2a6;
    const radius = isStart || isEnd ? 9 : 6;

    markerLayer.beginFill(color);
    markerLayer.drawCircle(p.x, p.y, radius);
    markerLayer.endFill();
  }
}

function drawGrid(pathLayer: Graphics): void {
  pathLayer.lineStyle(1, 0x233241, 0.8);

  const step = 40;
  for (let x = 0; x <= VIEW_WIDTH; x += step) {
    pathLayer.moveTo(x, 0);
    pathLayer.lineTo(x, VIEW_HEIGHT);
  }
  for (let y = 0; y <= VIEW_HEIGHT; y += step) {
    pathLayer.moveTo(0, y);
    pathLayer.lineTo(VIEW_WIDTH, y);
  }
}

function refreshExport(dom: EditorDom, points: TrackPoint[]): void {
  const track = buildTrackDefinition(
    {
      id: dom.trackIdInput.value,
      name: dom.trackNameInput.value,
      effectProfileId: dom.effectProfileInput.value
    },
    points
  );

  dom.jsonOutput.value = JSON.stringify(track, null, 2);
  dom.pointCountLabel.textContent = String(track.points.length);
  dom.trackLengthLabel.textContent = `${track.length.toFixed(2)} px`;

  const status =
    track.points.length >= 2
      ? 'Click to add points. Start is green, finish is red.'
      : 'Add at least 2 points to make a valid race path.';

  dom.editorHelp.textContent = status;
}

function resolveDom(): EditorDom {
  const byId = <T extends HTMLElement>(id: string): T => {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing required element #${id}`);
    return node as T;
  };

  const trackIdInput = byId<HTMLInputElement>('track-id-input');
  if (!trackIdInput.value.trim()) {
    trackIdInput.value = DEFAULT_EDITOR_TRACK_ID;
  }

  const trackNameInput = byId<HTMLInputElement>('track-name-input');
  if (!trackNameInput.value.trim()) {
    trackNameInput.value = DEFAULT_EDITOR_TRACK_NAME;
  }

  return {
    trackIdInput,
    trackNameInput,
    effectProfileInput: byId<HTMLInputElement>('effect-profile-input'),
    pointCountLabel: byId<HTMLElement>('point-count-value'),
    trackLengthLabel: byId<HTMLElement>('track-length-value'),
    previewToggleButton: byId<HTMLButtonElement>('preview-toggle-btn'),
    clearButton: byId<HTMLButtonElement>('clear-btn'),
    undoButton: byId<HTMLButtonElement>('undo-btn'),
    loadCurvyButton: byId<HTMLButtonElement>('load-curvy-btn'),
    loadStraightButton: byId<HTMLButtonElement>('load-straight-btn'),
    copyJsonButton: byId<HTMLButtonElement>('copy-json-btn'),
    downloadJsonButton: byId<HTMLButtonElement>('download-json-btn'),
    loadJsonButton: byId<HTMLButtonElement>('load-json-btn'),
    editorHelp: byId<HTMLElement>('editor-help-text'),
    jsonOutput: byId<HTMLTextAreaElement>('track-json-output')
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

main().catch(console.error);
