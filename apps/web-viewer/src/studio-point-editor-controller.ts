/**
 * File: apps/web-viewer/src/studio-point-editor-controller.ts
 * Model: GPT-5.3-Codex
 * Purpose: Encapsulates point-edit stage interactions and preset button wiring for studio track authoring.
 * Usage: Wired by studio app to keep orchestration focused on replay/camera/background flows.
 */

import type { Application } from 'pixi.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { clampToView, findNearestPointIndex } from './studio-editor-helpers';

interface PointEditorControls {
  clearButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  loadCurvyButton: HTMLButtonElement;
  loadStraightButton: HTMLButtonElement;
}

export interface StudioPointEditorControllerOptions {
  app: Application;
  controls: PointEditorControls;
  viewWidth: number;
  viewHeight: number;
  sampleCurvyPoints: TrackPoint[];
  sampleStraightPoints: TrackPoint[];
  getPoints: () => TrackPoint[];
  setPoints: (nextPoints: TrackPoint[]) => void;
  isBroadcastViewEnabled: () => boolean;
  onResetAndRender: () => void;
  onRenderOnly: () => void;
}

export function wireStudioPointEditorController(options: StudioPointEditorControllerOptions): void {
  const {
    app,
    controls,
    viewWidth,
    viewHeight,
    sampleCurvyPoints,
    sampleStraightPoints,
    getPoints,
    setPoints,
    isBroadcastViewEnabled,
    onResetAndRender,
    onRenderOnly
  } = options;

  let draggingIndex: number | null = null;

  app.stage.on('pointerdown', (event) => {
    if (isBroadcastViewEnabled()) return;

    const p = event.global;
    const index = findNearestPointIndex(getPoints(), p.x, p.y, 14);
    if (index !== -1) {
      draggingIndex = index;
      return;
    }

    setPoints([...getPoints(), clampToView(p.x, p.y, viewWidth, viewHeight)]);
    onResetAndRender();
  });

  app.stage.on('pointermove', (event) => {
    if (isBroadcastViewEnabled()) return;
    if (draggingIndex === null) return;

    const current = getPoints();
    if (draggingIndex < 0 || draggingIndex >= current.length) return;
    const p = event.global;
    const nextPoints = [...current];
    nextPoints[draggingIndex] = clampToView(p.x, p.y, viewWidth, viewHeight);
    setPoints(nextPoints);
    onRenderOnly();
  });

  app.stage.on('pointerup', () => {
    draggingIndex = null;
  });

  app.stage.on('pointerupoutside', () => {
    draggingIndex = null;
  });

  controls.clearButton.addEventListener('click', () => {
    setPoints([]);
    onResetAndRender();
  });

  controls.undoButton.addEventListener('click', () => {
    const current = getPoints();
    if (current.length === 0) return;
    setPoints(current.slice(0, -1));
    onResetAndRender();
  });

  controls.loadCurvyButton.addEventListener('click', () => {
    setPoints(clonePoints(sampleCurvyPoints));
    onResetAndRender();
  });

  controls.loadStraightButton.addEventListener('click', () => {
    setPoints(clonePoints(sampleStraightPoints));
    onResetAndRender();
  });
}

function clonePoints(points: TrackPoint[]): TrackPoint[] {
  return points.map((point) => ({ x: point.x, y: point.y }));
}
