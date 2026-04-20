/**
 * File: tests/studio-racer-pack-utils.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for extracted studio racer pack utility helpers.
 * Usage: Runs with Vitest as part of studio refactor parity checks.
 */

import { describe, expect, it } from 'vitest';

import {
  resolveRuntimeRacerPack,
  resolveTrackPreviewSizePx
} from '../apps/web-viewer/src/studio-racer-pack-utils';

describe('studio racer pack helpers', () => {
  it('clamps preview size into supported range', () => {
    expect(resolveTrackPreviewSizePx(Number.NaN)).toBe(34);
    expect(resolveTrackPreviewSizePx(8)).toBe(16);
    expect(resolveTrackPreviewSizePx(42)).toBe(42);
    expect(resolveTrackPreviewSizePx(120)).toBe(96);
  });

  it('reuses generated pack directly without touching fallback cache', () => {
    const generatedPack = { marker: 'generated' } as unknown;

    const resolved = resolveRuntimeRacerPack({
      requiredRacerCount: 30,
      generatedRacerPack: generatedPack as never,
      runtimeRacerPackCache: {
        fallbackRuntimeRacerPack: null,
        fallbackRuntimeRacerPackKey: ''
      },
      defaultRuntimePackFrameCount: 10
    });

    expect(resolved.runtimeRacerPack).toBe(generatedPack);
    expect(resolved.runtimeRacerPackCache.fallbackRuntimeRacerPack).toBeNull();
    expect(resolved.runtimeRacerPackCache.fallbackRuntimeRacerPackKey).toBe('');
  });
});
