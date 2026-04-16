/**
 * File: apps/web-viewer/src/studio-render.ts
 * Model: GPT-5.3-Codex
 * Purpose: Shared rendering/export helpers for studio editor layers and leaderboard UI.
 * Usage: Imported by studio app orchestrator to keep drawing code isolated.
 */

import type { Graphics } from 'pixi.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { buildTrackDefinition, buildSmoothedPreviewPath } from './track-editor-utils';
import { buildLaneBoardBounds } from './track-layout-helpers';
import type { ReplayLeaderboardRow } from './replay-visual-policy';
import type { EditorDom } from './studio-dom';

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
  viewHeight: number
): void {
  pathLayer.clear();
  markerLayer.clear();

  drawGrid(pathLayer, viewWidth, viewHeight);

  if (points.length === 0) {
    return;
  }

  const previewPath = smoothingEnabled ? buildSmoothedPreviewPath(points, 10) : points;

  pathLayer.lineStyle(7, 0x43d6d1, 0.88);
  pathLayer.moveTo(previewPath[0]!.x, previewPath[0]!.y);
  for (let i = 1; i < previewPath.length; i += 1) {
    pathLayer.lineTo(previewPath[i]!.x, previewPath[i]!.y);
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

export function refreshExport(dom: EditorDom, points: TrackPoint[]): void {
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
      ? 'Click to add points. Drag existing points to edit. Start is green, finish is red. Use replay, racer count, and lane width for fit checks (up to 100 racers).'
      : 'Add at least 2 points to make a valid race path.';

  dom.editorHelp.textContent = status;
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
