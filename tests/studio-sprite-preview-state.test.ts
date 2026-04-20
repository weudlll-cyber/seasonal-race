/**
 * File: tests/studio-sprite-preview-state.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies pure studio sprite-preview animation state helpers.
 * Usage: Runs under Vitest to protect frame/variant stepping behavior.
 */

import { describe, expect, it } from 'vitest';

import {
  createDefaultStudioSpritePreviewState,
  normalizeSpritePreviewVariantIndex,
  tickStudioSpritePreviewState
} from '../apps/web-viewer/src/studio-sprite-preview-state';

describe('studio sprite preview state', () => {
  it('creates default state at zeroed indices and timers', () => {
    const state = createDefaultStudioSpritePreviewState();

    expect(state).toEqual({
      frameIndex: 0,
      frameElapsedMs: 0,
      variantIndex: 0,
      variantElapsedMs: 0
    });
  });

  it('normalizes variant indices for positive and negative inputs', () => {
    expect(normalizeSpritePreviewVariantIndex(0, 12)).toBe(0);
    expect(normalizeSpritePreviewVariantIndex(13, 12)).toBe(1);
    expect(normalizeSpritePreviewVariantIndex(-1, 12)).toBe(11);
    expect(normalizeSpritePreviewVariantIndex(-9, 4)).toBe(3);
  });

  it('advances frame index based on duration and delta', () => {
    const result = tickStudioSpritePreviewState({
      state: {
        frameIndex: 0,
        frameElapsedMs: 0,
        variantIndex: 0,
        variantElapsedMs: 0
      },
      deltaMs: 190,
      frameDurationMs: 90,
      frameCount: 10,
      variantCount: 12
    });

    expect(result.nextState.frameIndex).toBe(2);
    expect(result.nextState.frameElapsedMs).toBe(10);
    expect(result.variantChanged).toBe(false);
  });

  it('rotates variant index at swap interval and resets variant timer', () => {
    const result = tickStudioSpritePreviewState({
      state: {
        frameIndex: 7,
        frameElapsedMs: 20,
        variantIndex: 11,
        variantElapsedMs: 1300
      },
      deltaMs: 120,
      frameDurationMs: 90,
      frameCount: 10,
      variantCount: 12
    });

    expect(result.nextState.variantIndex).toBe(0);
    expect(result.nextState.variantElapsedMs).toBe(0);
    expect(result.variantChanged).toBe(true);
  });
});
