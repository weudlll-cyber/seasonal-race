/**
 * File: tests/runtime-hud.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for runtime HUD helper behavior.
 * Usage: Runs in Vitest with other runtime helper tests.
 */

import { describe, expect, it } from 'vitest';

import {
  buildRuntimeLeaderboard,
  resolveRuntimeFocusRacer,
  resolveRuntimeRacerRank
} from '../apps/web-viewer/src/runtime-hud';

describe('runtime hud helpers', () => {
  it('builds leaderboard sorted by progress then speed', () => {
    const frames = [
      { progress: 0.52, speedNorm: 0.6 },
      { progress: 0.7, speedNorm: 0.4 },
      { progress: 0.7, speedNorm: 0.9 },
      { progress: 0.1, speedNorm: 0.9 }
    ];

    const leaderboard = buildRuntimeLeaderboard(frames, 3);
    expect(leaderboard).toHaveLength(3);
    expect(leaderboard[0]?.racerIndex).toBe(2);
    expect(leaderboard[1]?.racerIndex).toBe(1);
    expect(leaderboard[2]?.racerIndex).toBe(0);
    expect(leaderboard[0]?.gapToLeader).toBe(0);
    expect(leaderboard[1]?.gapToLeader).toBe(0);
    expect(leaderboard[2]?.gapToLeader).toBeCloseTo(0.18, 5);
  });

  it('resolves racer rank for arbitrary racer index', () => {
    const frames = [
      { progress: 0.35, speedNorm: 0.7 },
      { progress: 0.42, speedNorm: 0.6 },
      { progress: 0.41, speedNorm: 0.9 }
    ];

    expect(resolveRuntimeRacerRank(frames, 1)).toBe(1);
    expect(resolveRuntimeRacerRank(frames, 2)).toBe(2);
    expect(resolveRuntimeRacerRank(frames, 0)).toBe(3);
    expect(resolveRuntimeRacerRank(frames, 4)).toBeNull();
  });

  it('parses focus racer query as one-based and clamps to racer count', () => {
    expect(resolveRuntimeFocusRacer('1', 12)).toBe(0);
    expect(resolveRuntimeFocusRacer('5', 12)).toBe(4);
    expect(resolveRuntimeFocusRacer('99', 12)).toBe(11);
    expect(resolveRuntimeFocusRacer('0', 12)).toBe(0);
    expect(resolveRuntimeFocusRacer('abc', 12)).toBeNull();
    expect(resolveRuntimeFocusRacer(null, 12)).toBeNull();
  });
});
