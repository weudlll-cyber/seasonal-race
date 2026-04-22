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
  createRuntimeAutoRacerModels,
  resolveRuntimeRacerBehaviorPreset
} from '../apps/web-viewer/src/runtime-racer-simulation';

describe('runtime auto racer simulation', () => {
  it('clamps racer counts into supported range', () => {
    expect(clampRuntimeRacerCount(1)).toBe(2);
    expect(clampRuntimeRacerCount(250)).toBe(100);
    expect(clampRuntimeRacerCount(12.8)).toBe(12);
  });

  it('builds deterministic model seeds by racer count', () => {
    const modelsA = createRuntimeAutoRacerModels(8, { behaviorPreset: 'balanced' });
    const modelsB = createRuntimeAutoRacerModels(8, { behaviorPreset: 'balanced' });

    expect(modelsA).toEqual(modelsB);
    expect(modelsA).toHaveLength(8);
    expect(modelsA[0]?.startOffset).toBe(0);
    expect(modelsA[7]?.startOffset).toBeCloseTo(7 / 8, 6);
  });

  it('emits runtime frames in normalized progress and lateral ranges', () => {
    const models = createRuntimeAutoRacerModels(24, { behaviorPreset: 'balanced' });
    const frames = buildRuntimeAutoRacerFrame(models, 37_500, 55_000, {
      behaviorPreset: 'balanced'
    });

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
    const models = createRuntimeAutoRacerModels(12, { behaviorPreset: 'balanced' });
    const early = buildRuntimeAutoRacerFrame(models, 2_000, 30_000, {
      behaviorPreset: 'balanced'
    });
    const later = buildRuntimeAutoRacerFrame(models, 12_000, 30_000, {
      behaviorPreset: 'balanced'
    });

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

  it('resolves behavior preset safely from external input', () => {
    expect(resolveRuntimeRacerBehaviorPreset('arcade')).toBe('arcade');
    expect(resolveRuntimeRacerBehaviorPreset('chaotic')).toBe('chaotic');
    expect(resolveRuntimeRacerBehaviorPreset('invalid')).toBe('balanced');
    expect(resolveRuntimeRacerBehaviorPreset(null)).toBe('balanced');
  });

  it('produces meaningfully different speed spread by behavior preset', () => {
    const balancedModels = createRuntimeAutoRacerModels(24, { behaviorPreset: 'balanced' });
    const chaoticModels = createRuntimeAutoRacerModels(24, { behaviorPreset: 'chaotic' });

    const balancedFrames = buildRuntimeAutoRacerFrame(balancedModels, 18_000, 40_000, {
      behaviorPreset: 'balanced'
    });
    const chaoticFrames = buildRuntimeAutoRacerFrame(chaoticModels, 18_000, 40_000, {
      behaviorPreset: 'chaotic'
    });

    const balancedSpread =
      Math.max(...balancedFrames.map((frame) => frame.speedNorm)) -
      Math.min(...balancedFrames.map((frame) => frame.speedNorm));
    const chaoticSpread =
      Math.max(...chaoticFrames.map((frame) => frame.speedNorm)) -
      Math.min(...chaoticFrames.map((frame) => frame.speedNorm));

    expect(chaoticSpread).toBeGreaterThanOrEqual(balancedSpread * 0.9);
  });

  it('keeps close racers from collapsing into the same lateral slot', () => {
    const models = createRuntimeAutoRacerModels(36, { behaviorPreset: 'arcade' });
    const frames = buildRuntimeAutoRacerFrame(models, 22_000, 44_000, { behaviorPreset: 'arcade' });
    const sortedByProgress = [...frames].sort((a, b) => b.progress - a.progress);

    let closePairCount = 0;
    let separatedPairCount = 0;
    for (let index = 1; index < sortedByProgress.length; index += 1) {
      const current = sortedByProgress[index];
      const previous = sortedByProgress[index - 1];
      if (!current || !previous) continue;

      const progressGap = Math.abs(previous.progress - current.progress);
      if (progressGap > 0.03) continue;

      closePairCount += 1;
      if (Math.abs(previous.lateralOffset - current.lateralOffset) >= 0.02) {
        separatedPairCount += 1;
      }
    }

    expect(closePairCount).toBeGreaterThan(0);
    expect(separatedPairCount / closePairCount).toBeGreaterThan(0.65);
  });
});
