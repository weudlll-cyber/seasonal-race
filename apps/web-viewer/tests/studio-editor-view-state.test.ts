/**
 * File: apps/web-viewer/tests/studio-editor-view-state.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for pure studio editor zoom/view-state helpers.
 * Usage: Runs in Vitest as part of web-viewer tests.
 */

import { describe, expect, it } from 'vitest';
import {
  computeEditorWorldTransform,
  computeZoomAroundScreenPoint,
  createDefaultEditorViewState
} from '../src/studio-editor-view-state.js';

describe('studio-editor-view-state', () => {
  it('creates centered default view state at 100% zoom', () => {
    const state = createDefaultEditorViewState(1160, 720);

    expect(state).toEqual({ zoom: 1, centerX: 580, centerY: 360 });
  });

  it('computes world transform from editor state and screen size', () => {
    const transform = computeEditorWorldTransform(
      { zoom: 2, centerX: 580, centerY: 360 },
      1160,
      720
    );

    expect(transform.scale).toBe(2);
    expect(transform.x).toBe(-580);
    expect(transform.y).toBe(-360);
  });

  it('returns same state when zoom change is below threshold', () => {
    const state = { zoom: 1, centerX: 580, centerY: 360 };
    const next = computeZoomAroundScreenPoint({
      state,
      nextZoom: 1.00001,
      minZoom: 1,
      maxZoom: 4,
      screenX: 580,
      screenY: 360,
      worldPositionX: 0,
      worldPositionY: 0,
      screenWidth: 1160,
      screenHeight: 720
    });

    expect(next).toBe(state);
  });

  it('clamps zoom and keeps pointer-anchored world position stable', () => {
    const state = { zoom: 1, centerX: 580, centerY: 360 };
    const next = computeZoomAroundScreenPoint({
      state,
      nextZoom: 10,
      minZoom: 1,
      maxZoom: 4,
      screenX: 300,
      screenY: 240,
      worldPositionX: 0,
      worldPositionY: 0,
      screenWidth: 1160,
      screenHeight: 720
    });

    expect(next.zoom).toBe(4);

    const originalWorldX = (300 - 0) / state.zoom;
    const originalWorldY = (240 - 0) / state.zoom;
    const worldPosXAfter = 1160 * 0.5 - next.centerX * next.zoom;
    const worldPosYAfter = 720 * 0.5 - next.centerY * next.zoom;
    const anchoredWorldXAfter = (300 - worldPosXAfter) / next.zoom;
    const anchoredWorldYAfter = (240 - worldPosYAfter) / next.zoom;

    expect(anchoredWorldXAfter).toBeCloseTo(originalWorldX, 6);
    expect(anchoredWorldYAfter).toBeCloseTo(originalWorldY, 6);
  });
});
