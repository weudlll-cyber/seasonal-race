/**
 * File: tests/studio-replay-utils.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for extracted studio replay utility helpers.
 * Usage: Runs with Vitest as part of replay behavior parity checks.
 */

import { describe, expect, it } from 'vitest';

import {
  buildReplayCinematicPlan,
  computeCoastStopProgress,
  computeLinearDecayCoast
} from '../apps/web-viewer/src/studio-replay-utils';

describe('studio replay utility helpers', () => {
  it('builds deterministic cinematic plans for identical run ids', () => {
    const planA = buildReplayCinematicPlan(42);
    const planB = buildReplayCinematicPlan(42);

    expect(planA).toEqual(planB);
    expect(planA.beats.length).toBeGreaterThanOrEqual(3);
    expect(planA.beats[0]!.startPhase).toBeLessThan(planA.beats[1]!.startPhase);
  });

  it('reduces coast stop progress for later finishers', () => {
    const finishProgress = 0.8;
    const firstStop = computeCoastStopProgress(finishProgress, 1, 12, 0);
    const middleStop = computeCoastStopProgress(finishProgress, 6, 12, 5);
    const lastStop = computeCoastStopProgress(finishProgress, 12, 12, 11);

    expect(firstStop).toBeGreaterThan(middleStop);
    expect(middleStop).toBeGreaterThan(lastStop);
    expect(lastStop).toBeGreaterThan(finishProgress);
  });

  it('linearly decays coast velocity over elapsed time', () => {
    const start = computeLinearDecayCoast(0.2, 0.06, 0);
    const mid = computeLinearDecayCoast(0.2, 0.06, 0.3);
    const end = computeLinearDecayCoast(0.2, 0.06, 0.8);

    expect(start.currentV).toBeGreaterThan(mid.currentV);
    expect(mid.currentV).toBeGreaterThanOrEqual(end.currentV);
    expect(end.coastFrac).toBeLessThanOrEqual(1);
  });
});
