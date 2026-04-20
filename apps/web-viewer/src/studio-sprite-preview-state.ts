/**
 * File: apps/web-viewer/src/studio-sprite-preview-state.ts
 * Model: GPT-5.3-Codex
 * Purpose: Pure state helpers for studio sprite-preview animation progression.
 * Usage: Used by studio-app to advance preview frame/variant state without UI orchestration noise.
 */

export interface StudioSpritePreviewState {
  frameIndex: number;
  frameElapsedMs: number;
  variantIndex: number;
  variantElapsedMs: number;
}

export interface TickStudioSpritePreviewStateInput {
  state: StudioSpritePreviewState;
  deltaMs: number;
  frameDurationMs: number;
  frameCount: number;
  variantCount: number;
  variantSwapIntervalMs?: number;
}

export interface TickStudioSpritePreviewStateResult {
  nextState: StudioSpritePreviewState;
  variantChanged: boolean;
}

export function createDefaultStudioSpritePreviewState(): StudioSpritePreviewState {
  return {
    frameIndex: 0,
    frameElapsedMs: 0,
    variantIndex: 0,
    variantElapsedMs: 0
  };
}

export function normalizeSpritePreviewVariantIndex(
  variantIndex: number,
  variantCount: number
): number {
  const safeVariantCount = Math.max(1, variantCount);
  return ((variantIndex % safeVariantCount) + safeVariantCount) % safeVariantCount;
}

export function tickStudioSpritePreviewState(
  input: TickStudioSpritePreviewStateInput
): TickStudioSpritePreviewStateResult {
  const safeFrameCount = Math.max(1, input.frameCount);
  const safeVariantCount = Math.max(1, input.variantCount);
  const swapIntervalMs = Math.max(1, input.variantSwapIntervalMs ?? 1400);

  let frameElapsedMs = input.state.frameElapsedMs + input.deltaMs;
  let frameIndex = input.state.frameIndex;
  const normalizedFrameDurationMs = Math.max(1, input.frameDurationMs);
  while (frameElapsedMs >= normalizedFrameDurationMs) {
    frameElapsedMs -= normalizedFrameDurationMs;
    frameIndex = (frameIndex + 1) % safeFrameCount;
  }

  let variantElapsedMs = input.state.variantElapsedMs + input.deltaMs;
  let variantIndex = normalizeSpritePreviewVariantIndex(input.state.variantIndex, safeVariantCount);
  let variantChanged = false;
  if (variantElapsedMs >= swapIntervalMs) {
    variantElapsedMs = 0;
    variantIndex = (variantIndex + 1) % safeVariantCount;
    variantChanged = true;
  }

  return {
    nextState: {
      frameIndex,
      frameElapsedMs,
      variantIndex,
      variantElapsedMs
    },
    variantChanged
  };
}
