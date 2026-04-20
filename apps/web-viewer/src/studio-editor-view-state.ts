/**
 * File: apps/web-viewer/src/studio-editor-view-state.ts
 * Model: GPT-5.3-Codex
 * Purpose: Pure editor zoom/camera math helpers for studio view state.
 * Usage: Imported by studio-app editor zoom and transform wiring.
 */

export interface StudioEditorViewState {
  zoom: number;
  centerX: number;
  centerY: number;
}

export interface StudioEditorWorldTransform {
  scale: number;
  x: number;
  y: number;
}

export function createDefaultEditorViewState(
  viewWidth: number,
  viewHeight: number
): StudioEditorViewState {
  return {
    zoom: 1,
    centerX: viewWidth * 0.5,
    centerY: viewHeight * 0.5
  };
}

export function computeEditorWorldTransform(
  state: StudioEditorViewState,
  screenWidth: number,
  screenHeight: number
): StudioEditorWorldTransform {
  return {
    scale: state.zoom,
    x: screenWidth * 0.5 - state.centerX * state.zoom,
    y: screenHeight * 0.5 - state.centerY * state.zoom
  };
}

export interface ComputeZoomAroundScreenPointInput {
  state: StudioEditorViewState;
  nextZoom: number;
  minZoom: number;
  maxZoom: number;
  screenX: number;
  screenY: number;
  worldPositionX: number;
  worldPositionY: number;
  screenWidth: number;
  screenHeight: number;
}

export function computeZoomAroundScreenPoint(
  input: ComputeZoomAroundScreenPointInput
): StudioEditorViewState {
  const {
    state,
    nextZoom,
    minZoom,
    maxZoom,
    screenX,
    screenY,
    worldPositionX,
    worldPositionY,
    screenWidth,
    screenHeight
  } = input;

  const clampedZoom = Math.max(minZoom, Math.min(maxZoom, nextZoom));
  if (Math.abs(clampedZoom - state.zoom) < 0.0001) {
    return state;
  }

  const worldX = (screenX - worldPositionX) / state.zoom;
  const worldY = (screenY - worldPositionY) / state.zoom;

  return {
    zoom: clampedZoom,
    centerX: worldX - (screenX - screenWidth * 0.5) / clampedZoom,
    centerY: worldY - (screenY - screenHeight * 0.5) / clampedZoom
  };
}
