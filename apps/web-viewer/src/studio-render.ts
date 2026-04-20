/**
 * File: apps/web-viewer/src/studio-render.ts
 * Model: GPT-5.3-Codex
 * Purpose: Shared rendering/export helpers for studio editor layers and leaderboard UI.
 * Usage: Imported by studio app orchestrator to keep drawing code isolated.
 */

import type { Graphics } from 'pixi.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { buildTrackDefinition, buildSmoothedPreviewPath } from './track-editor-utils.js';
import { buildLaneBoardBounds } from './track-layout-helpers.js';
import type { ReplayLeaderboardRow } from './replay-visual-policy.js';
import type { EditorDom } from './studio-dom.js';

export interface BoundaryEditorState {
  mode: 'centerline' | 'boundaries';
  activeSide: 'left' | 'right';
  leftBoundaryPoints: TrackPoint[];
  rightBoundaryPoints: TrackPoint[];
}

export function renderLeaderboardRows(
  leaderboardList: HTMLElement,
  rows: ReplayLeaderboardRow[]
): void {
  leaderboardList.innerHTML = rows
    .map((row) => {
      if (row.kind === 'separator') {
        return '<li>...</li>';
      }
      const focusClass = row.isFocus ? ' class="focus"' : '';
      return `<li${focusClass}>#${row.place} D${(row.racerIndex ?? 0) + 1} (${row.progressPercent ?? 0}%)</li>`;
    })
    .join('');
}

export function redrawEditor(
  points: TrackPoint[],
  pathLayer: Graphics,
  markerLayer: Graphics,
  smoothingEnabled: boolean,
  viewWidth: number,
  viewHeight: number,
  boundaryState?: BoundaryEditorState
): void {
  pathLayer.clear();
  markerLayer.clear();

  drawGrid(pathLayer, viewWidth, viewHeight);

  if (points.length === 0) {
    return;
  }

  const previewPath = smoothingEnabled ? buildSmoothedPreviewPath(points, 10) : points;
  const boundaryMode = boundaryState?.mode === 'boundaries';

  if (boundaryMode) {
    const left = boundaryState?.leftBoundaryPoints ?? [];
    const right = boundaryState?.rightBoundaryPoints ?? [];
    const activeLeft = boundaryState?.activeSide === 'left';

    drawPath(
      pathLayer,
      left,
      smoothingEnabled,
      activeLeft ? 4 : 3,
      0xffdf74,
      activeLeft ? 0.96 : 0.8
    );
    drawPath(
      pathLayer,
      right,
      smoothingEnabled,
      activeLeft ? 3 : 4,
      0xffdf74,
      activeLeft ? 0.8 : 0.96
    );
    drawPath(pathLayer, previewPath, smoothingEnabled, 2, 0x43d6d1, 0.5);
  } else {
    drawPath(pathLayer, previewPath, false, 7, 0x43d6d1, 0.88);
  }

  const markerPoints = boundaryMode
    ? boundaryState?.activeSide === 'left'
      ? (boundaryState?.leftBoundaryPoints ?? [])
      : (boundaryState?.rightBoundaryPoints ?? [])
    : points;

  for (let i = 0; i < markerPoints.length; i += 1) {
    const p = markerPoints[i]!;
    const isStart = i === 0;
    const isCoastEnd = i === markerPoints.length - 1;
    const isFinish = markerPoints.length >= 2 && i === markerPoints.length - 2;
    const color = isStart ? 0x47d147 : isCoastEnd ? 0xe85d5d : isFinish ? 0xfff2a6 : 0x7fd3ff;
    const radius = isStart || isFinish || isCoastEnd ? 9 : 6;

    markerLayer.beginFill(color);
    markerLayer.drawCircle(p.x, p.y, radius);
    markerLayer.endFill();
  }
}

export function drawReplayLaneBoards(
  points: TrackPoint[],
  layer: Graphics,
  halfWidth: number
): void {
  layer.clear();
  if (points.length < 2) return;

  const { left, right } = buildLaneBoardBounds(points, halfWidth, 140);

  layer.lineStyle(2, 0xfff26a, 0.9);
  layer.moveTo(left[0]!.x, left[0]!.y);
  for (let i = 1; i < left.length; i += 1) {
    layer.lineTo(left[i]!.x, left[i]!.y);
  }

  layer.lineStyle(2, 0xfff26a, 0.9);
  layer.moveTo(right[0]!.x, right[0]!.y);
  for (let i = 1; i < right.length; i += 1) {
    layer.lineTo(right[i]!.x, right[i]!.y);
  }
}

export function drawReplayBoundaryLines(
  layer: Graphics,
  leftBoundaryPoints: TrackPoint[],
  rightBoundaryPoints: TrackPoint[]
): void {
  layer.clear();
  if (leftBoundaryPoints.length < 2 || rightBoundaryPoints.length < 2) return;

  layer.lineStyle(2.2, 0xfff26a, 0.92);
  layer.moveTo(leftBoundaryPoints[0]!.x, leftBoundaryPoints[0]!.y);
  for (let i = 1; i < leftBoundaryPoints.length; i += 1) {
    layer.lineTo(leftBoundaryPoints[i]!.x, leftBoundaryPoints[i]!.y);
  }

  layer.lineStyle(2.2, 0xfff26a, 0.92);
  layer.moveTo(rightBoundaryPoints[0]!.x, rightBoundaryPoints[0]!.y);
  for (let i = 1; i < rightBoundaryPoints.length; i += 1) {
    layer.lineTo(rightBoundaryPoints[i]!.x, rightBoundaryPoints[i]!.y);
  }
}

export function drawReplayFinishGuides(
  layer: Graphics,
  finishPoint: TrackPoint,
  finishNormal: TrackPoint,
  coastEndPoint: TrackPoint,
  halfWidth: number
): void {
  const lineHalf = Math.max(18, halfWidth + 14);
  const fx1 = finishPoint.x - finishNormal.x * lineHalf;
  const fy1 = finishPoint.y - finishNormal.y * lineHalf;
  const fx2 = finishPoint.x + finishNormal.x * lineHalf;
  const fy2 = finishPoint.y + finishNormal.y * lineHalf;

  // Finish line in yellow.
  layer.lineStyle(3, 0xfff26a, 0.95);
  layer.moveTo(fx1, fy1);
  layer.lineTo(fx2, fy2);

  // Coast-zone endpoint in red.
  layer.beginFill(0xe85d5d, 0.96);
  layer.drawCircle(coastEndPoint.x, coastEndPoint.y, 7);
  layer.endFill();
}

export function refreshExport(
  dom: EditorDom,
  points: TrackPoint[],
  boundaryState?: BoundaryEditorState
): void {
  const track = buildTrackDefinition(
    {
      id: dom.trackIdInput.value,
      name: dom.trackNameInput.value,
      effectProfileId: dom.effectProfileInput.value
    },
    points
  );

  const outputPayload: Record<string, unknown> = {
    ...track
  };
  if (boundaryState?.mode === 'boundaries') {
    outputPayload.editorPathMode = 'boundaries';
    outputPayload.editorBoundaries = {
      left: boundaryState.leftBoundaryPoints.map((p) => ({ x: p.x, y: p.y })),
      right: boundaryState.rightBoundaryPoints.map((p) => ({ x: p.x, y: p.y }))
    };
  }

  const selectedOrientation =
    dom.trackOrientationSelect.value === 'top-to-bottom' ? 'top-to-bottom' : 'left-to-right';
  if (selectedOrientation !== 'left-to-right') {
    outputPayload.editorTrackOrientation = selectedOrientation;
  }

  dom.jsonOutput.value = JSON.stringify(outputPayload, null, 2);
  dom.pointCountLabel.textContent = String(track.points.length);
  dom.trackLengthLabel.textContent = `${track.length.toFixed(2)} px`;

  const status =
    track.points.length >= 3
      ? boundaryState?.mode === 'boundaries'
        ? 'Boundary mode active: edit left/right boundary lines and racers will run between them. Active side markers: start green, finish yellow, coast end red.'
        : 'Click to add points. Drag existing points to edit. Start is green, finish is yellow, coast end is red. Use replay, racer count, and lane width for fit checks (up to 100 racers).'
      : 'Add at least 3 points: start (green), finish (yellow), and coast end (red).';

  dom.editorHelp.textContent = status;
}

function drawPath(
  layer: Graphics,
  points: TrackPoint[],
  smoothingEnabled: boolean,
  width: number,
  color: number,
  alpha: number
): void {
  if (points.length < 2) return;
  const renderPath = smoothingEnabled ? buildSmoothedPreviewPath(points, 10) : points;
  layer.lineStyle(width, color, alpha);
  layer.moveTo(renderPath[0]!.x, renderPath[0]!.y);
  for (let i = 1; i < renderPath.length; i += 1) {
    layer.lineTo(renderPath[i]!.x, renderPath[i]!.y);
  }
}

function drawGrid(pathLayer: Graphics, viewWidth: number, viewHeight: number): void {
  pathLayer.lineStyle(1, 0x233241, 0.8);

  const step = 40;
  for (let x = 0; x <= viewWidth; x += step) {
    pathLayer.moveTo(x, 0);
    pathLayer.lineTo(x, viewHeight);
  }
  for (let y = 0; y <= viewHeight; y += step) {
    pathLayer.moveTo(0, y);
    pathLayer.lineTo(viewWidth, y);
  }
}
