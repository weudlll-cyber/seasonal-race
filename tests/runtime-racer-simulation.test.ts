/**
 * File: tests/runtime-racer-simulation.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for automatic runtime racer simulation model behavior.
 * Usage: Runs in Vitest as part of runtime visual logic coverage.
 */

import { describe, expect, it } from 'vitest';

import {
  buildRuntimeAutoRacerFrame,
  clampRuntimeRacerCount,
  createRuntimeAutoRacerModels
} from '../apps/web-viewer/src/runtime-racer-simulation';

describe('runtime auto racer simulation', () => {
  it('clamps racer counts into supported range', () => {
    expect(clampRuntimeRacerCount(1)).toBe(2);
    expect(clampRuntimeRacerCount(250)).toBe(100);
    expect(clampRuntimeRacerCount(12.8)).toBe(12);
  });

  it('builds deterministic model seeds by racer count', () => {
    const modelsA = createRuntimeAutoRacerModels(8);
    const modelsB = createRuntimeAutoRacerModels(8);

    expect(modelsA).toEqual(modelsB);
    expect(modelsA).toHaveLength(8);
    expect(modelsA[0]?.startOffset).toBe(0);
    expect(modelsA[7]?.startOffset).toBeCloseTo(7 / 8, 6);
  });

  it('emits runtime frames in normalized progress and lateral ranges', () => {
    const models = createRuntimeAutoRacerModels(24);
    const frames = buildRuntimeAutoRacerFrame(models, 37_500, 55_000);

    expect(frames).toHaveLength(24);
    for (const frame of frames) {
      expect(frame.progress).toBeGreaterThanOrEqual(0);
      expect(frame.progress).toBeLessThan(1);
      expect(frame.speedNorm).toBeGreaterThanOrEqual(0);
      expect(frame.speedNorm).toBeLessThanOrEqual(1);
      expect(frame.lateralOffset).toBeGreaterThanOrEqual(-1);
      expect(frame.lateralOffset).toBeLessThanOrEqual(1);
    }
  });

  it('changes frame values over time for visible movement', () => {
    const models = createRuntimeAutoRacerModels(12);
    const early = buildRuntimeAutoRacerFrame(models, 2_000, 30_000);
    const later = buildRuntimeAutoRacerFrame(models, 12_000, 30_000);

    const changed = early.some((frame, index) => {
      const other = later[index];
      if (!other) return false;
      return (
        Math.abs(frame.progress - other.progress) > 0.02 ||
        Math.abs(frame.lateralOffset - other.lateralOffset) > 0.02
      );
    });

    expect(changed).toBe(true);
  });
});
