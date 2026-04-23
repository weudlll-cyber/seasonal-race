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
    expect(modelsA[7]?.startOffset).toBe(0);
  });

  it('emits runtime frames in normalized progress and lateral ranges', () => {
    const models = createRuntimeAutoRacerModels(24, { behaviorPreset: 'balanced' });
    const frames = buildRuntimeAutoRacerFrame(models, 37_500, 55_000, {
      behaviorPreset: 'balanced'
    });

    expect(frames).toHaveLength(24);
    for (const frame of frames) {
      expect(frame.progress).toBeGreaterThanOrEqual(0);
      expect(frame.progress).toBeLessThanOrEqual(1);
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

  it('starts racers clustered at start line and advances toward finish', () => {
    const models = createRuntimeAutoRacerModels(12, { behaviorPreset: 'balanced' });
    const atStart = buildRuntimeAutoRacerFrame(models, 0, 55_000, { behaviorPreset: 'balanced' });
    const rollout = buildRuntimeAutoRacerFrame(models, 6_000, 55_000, {
      behaviorPreset: 'balanced'
    });
    const nearFinish = buildRuntimeAutoRacerFrame(models, 52_000, 55_000, {
      behaviorPreset: 'balanced'
    });

    const maxStart = Math.max(...atStart.map((frame) => frame.progress));
    const minStart = Math.min(...atStart.map((frame) => frame.progress));
    expect(maxStart - minStart).toBeLessThan(0.03);

    const rolloutProgressSpread =
      Math.max(...rollout.map((frame) => frame.progress)) -
      Math.min(...rollout.map((frame) => frame.progress));
    const rolloutLaneSpread =
      Math.max(...rollout.map((frame) => frame.lateralOffset)) -
      Math.min(...rollout.map((frame) => frame.lateralOffset));
    expect(rolloutProgressSpread).toBeGreaterThan(0.015);
    expect(Math.max(...rollout.map((frame) => frame.progress))).toBeGreaterThan(maxStart + 0.06);
    expect(rolloutLaneSpread).toBeGreaterThan(1.1);

    const nearFinishMaxProgress = Math.max(...nearFinish.map((frame) => frame.progress));
    expect(nearFinishMaxProgress).toBeGreaterThan(0.84);
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

  it('uses available adjacent lanes for overtaking variety in dense packs', () => {
    const models = createRuntimeAutoRacerModels(36, { behaviorPreset: 'balanced' });
    const frames = buildRuntimeAutoRacerFrame(models, 20_000, 44_000, {
      behaviorPreset: 'balanced'
    });
    const sortedByProgress = [...frames].sort((a, b) => b.progress - a.progress);

    const densePack = sortedByProgress.filter((frame, index, array) => {
      const previous = array[index - 1];
      const next = array[index + 1];
      return (
        (previous !== undefined && Math.abs(previous.progress - frame.progress) < 0.04) ||
        (next !== undefined && Math.abs(next.progress - frame.progress) < 0.04)
      );
    });

    const occupiedBands = new Set(
      densePack.map((frame) => {
        if (frame.lateralOffset < -0.25) return 'left';
        if (frame.lateralOffset > 0.25) return 'right';
        return 'center';
      })
    );

    expect(densePack.length).toBeGreaterThan(5);
    expect(occupiedBands.size).toBeGreaterThanOrEqual(3);
  });

  it('does not give front start rows a built-in early progress advantage', () => {
    const models = createRuntimeAutoRacerModels(24, { behaviorPreset: 'balanced' });
    const frames = buildRuntimeAutoRacerFrame(models, 6_000, 55_000, {
      behaviorPreset: 'balanced'
    });

    const rows = new Map<number, number[]>();
    for (const frame of frames) {
      const row = Math.floor(frame.index / 4);
      const values = rows.get(row);
      if (values) {
        values.push(frame.progress);
      } else {
        rows.set(row, [frame.progress]);
      }
    }

    const row0 = rows.get(0) ?? [];
    const row5 = rows.get(5) ?? [];
    const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(row0.length).toBe(4);
    expect(row5.length).toBe(4);
    expect(Math.abs(avg(row0) - avg(row5))).toBeLessThan(0.025);
  });

  it('distributes winners across racer indices over many race seeds', () => {
    const winnerCounts = new Map<number, number>();
    const totalSeeds = 80;

    for (let seed = 1; seed <= totalSeeds; seed += 1) {
      const models = createRuntimeAutoRacerModels(24, {
        behaviorPreset: 'balanced',
        raceSeed: seed
      });
      const frames = buildRuntimeAutoRacerFrame(models, 54_000, 55_000, {
        behaviorPreset: 'balanced',
        raceSeed: seed
      });
      const winner = [...frames].sort((a, b) => b.progress - a.progress)[0];
      if (!winner) continue;
      winnerCounts.set(winner.index, (winnerCounts.get(winner.index) ?? 0) + 1);
    }

    const distinctWinners = winnerCounts.size;
    const maxWins = Math.max(...winnerCounts.values());
    const minWins = Math.min(...winnerCounts.values());

    expect(distinctWinners).toBeGreaterThanOrEqual(12);
    expect(maxWins).toBeLessThanOrEqual(14);
    expect(minWins).toBeGreaterThanOrEqual(1);
  });
});
