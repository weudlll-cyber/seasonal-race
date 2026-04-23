/**
 * File: tests/studio-replay-utils.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for extracted studio replay utility helpers.
 * Usage: Runs with Vitest as part of replay behavior parity checks.
 */

import { describe, expect, it } from 'vitest';

import {
  applyReplayLabelDecisions,
  applyReplaySpriteSeparation,
  buildReplayCinematicPlan,
  buildReplayRunPathState,
  computeCoastStopProgress,
  computeLinearDecayCoast,
  resetReplayRacerTransientState,
  resolveReplayRacerProgress,
  resolveReplayZoomScale,
  selectReplayCameraInputRacers
} from '../apps/web-viewer/src/studio-replay-utils';
import type { ReplayProgressRacer } from '../apps/web-viewer/src/studio-replay-utils';

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

  it('builds forward-safe run path state for authored coast points behind finish', () => {
    const racePath = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 }
    ];
    const state = buildReplayRunPathState(
      racePath,
      { x: 200, y: 0 },
      { x: 1, y: 0 },
      { x: 150, y: 0 },
      220
    );

    expect(state.safeCoastEnd.x).toBeGreaterThan(200);
    expect(state.fullRunPath[state.fullRunPath.length - 1]).toEqual(state.safeCoastEnd);
    expect(state.finishProgressOnFullRun).toBeGreaterThan(0);
    expect(state.finishProgressOnFullRun).toBeLessThan(1);
  });

  it('selects camera racers per phase policy', () => {
    const racers = [
      { progress: 0.1, position: { x: 1, y: 0 } },
      { progress: 0.8, position: { x: 8, y: 0 } },
      { progress: 0.4, position: { x: 4, y: 0 } }
    ];

    const preStart = selectReplayCameraInputRacers(true, false, false, 0.85, racers);
    expect(preStart[0]!.progress).toBe(0.8);

    const finishFraming = selectReplayCameraInputRacers(false, true, false, 0.5, racers);
    expect(finishFraming.every((r) => r.progress < 0.5)).toBe(true);

    const spotlight = selectReplayCameraInputRacers(false, false, true, 0.9, racers);
    expect(spotlight).toHaveLength(2);
    expect(spotlight[0]!.progress).toBe(0.8);
  });

  it('resolves replay zoom scale by mode priority', () => {
    expect(resolveReplayZoomScale(true, false, false, 3)).toBe(2.15);
    expect(resolveReplayZoomScale(false, true, false, 3)).toBe(2.2);
    expect(resolveReplayZoomScale(false, false, true, 3)).toBe(4.95);
    expect(resolveReplayZoomScale(false, false, false, 1.7)).toBe(1.7);
  });

  it('separates overlapping racers and keeps offset feedback bounded', () => {
    const makePosition = (x: number, y: number) => ({
      x,
      y,
      set(nx: number, ny: number) {
        this.x = nx;
        this.y = ny;
      }
    });
    const racers = [
      {
        index: 0,
        progress: 0.35,
        sprite: { position: makePosition(40, 20) },
        freeSwimOffsetNorm: 0
      },
      {
        index: 1,
        progress: 0.36,
        sprite: { position: makePosition(40, 20) },
        freeSwimOffsetNorm: 0
      }
    ];

    applyReplaySpriteSeparation(
      racers,
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 0 }
      ],
      0.85,
      7,
      10
    );

    const dx = racers[0]!.sprite.position.x - racers[1]!.sprite.position.x;
    const dy = racers[0]!.sprite.position.y - racers[1]!.sprite.position.y;
    expect(Math.hypot(dx, dy)).toBeGreaterThan(0.01);
    expect(Math.abs(racers[0]!.freeSwimOffsetNorm ?? 0)).toBeLessThanOrEqual(0.999);
    expect(Math.abs(racers[1]!.freeSwimOffsetNorm ?? 0)).toBeLessThanOrEqual(0.999);
  });

  it('prefers lateral separation on straight track segments', () => {
    const makePosition = (x: number, y: number) => ({
      x,
      y,
      set(nx: number, ny: number) {
        this.x = nx;
        this.y = ny;
      }
    });
    const racers = [
      {
        index: 2,
        progress: 0.4,
        sprite: { position: makePosition(60, 40) },
        freeSwimOffsetNorm: -0.2
      },
      {
        index: 3,
        progress: 0.4,
        sprite: { position: makePosition(61.5, 40) },
        freeSwimOffsetNorm: 0.2
      }
    ];

    applyReplaySpriteSeparation(
      racers,
      [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 240, y: 0 }
      ],
      0.86,
      7,
      10
    );

    const deltaX = Math.abs(racers[0]!.sprite.position.x - 60);
    const deltaY = Math.abs(racers[0]!.sprite.position.y - 40);
    expect(deltaY).toBeGreaterThan(deltaX * 1.15);
    expect((racers[0]!.freeSwimOffsetNorm ?? 0) * (racers[1]!.freeSwimOffsetNorm ?? 0)).toBeLessThan(0);
  });

  it('resets replay transient racer state fields for a fresh run', () => {
    const racer = {
      progress: 0.77,
      finishTimeMs: 123,
      finishOrder: 2,
      finishApproachRatePerSec: 0.21,
      lockedTopFiveRank: 2,
      terminalCruiseRatePerSec: 0.1,
      coastEntryRatePerSec: 0.2,
      coastStartTimeMs: 444,
      coastStopProgress: 0.95,
      freeSwimOffsetNorm: 0.4,
      freeSwimVelocityNorm: 0.03,
      frozenX: 12,
      frozenY: 18
    };

    resetReplayRacerTransientState(racer);

    expect(racer.progress).toBe(0);
    expect(racer.finishTimeMs).toBeUndefined();
    expect(racer.finishOrder).toBeUndefined();
    expect(racer.finishApproachRatePerSec).toBeUndefined();
    expect(racer.lockedTopFiveRank).toBeUndefined();
    expect(racer.terminalCruiseRatePerSec).toBeUndefined();
    expect(racer.coastEntryRatePerSec).toBeUndefined();
    expect(racer.coastStartTimeMs).toBeUndefined();
    expect(racer.coastStopProgress).toBeUndefined();
    expect(racer.freeSwimOffsetNorm).toBeUndefined();
    expect(racer.freeSwimVelocityNorm).toBeUndefined();
    expect(racer.frozenX).toBeUndefined();
    expect(racer.frozenY).toBeUndefined();
  });

  it('applies label decisions and label anchor positions', () => {
    const mkPos = (x = 0, y = 0) => {
      const pos = {
        x,
        y,
        set: (nx: number, ny: number) => {
          pos.x = nx;
          pos.y = ny;
        }
      };
      return pos;
    };
    const scale = {
      y: 1,
      set: (v: number) => {
        scale.y = v;
      }
    };
    const racers = [
      {
        id: 'd1',
        marker: { alpha: 0, width: 20 },
        sprite: {
          scale,
          position: { x: 100, y: 60 },
          zIndex: 0
        },
        labelBg: { visible: false, position: mkPos(), zIndex: 0 },
        labelText: { visible: false, position: mkPos(), zIndex: 0 },
        bodySprite: { alpha: 0 }
      }
    ];

    applyReplayLabelDecisions(racers, [
      { id: 'd1', showLabel: true, scale: 1.3, markerAlpha: 0.8, zIndex: 120 }
    ]);

    expect(racers[0]!.labelBg.visible).toBe(true);
    expect(racers[0]!.labelText.visible).toBe(true);
    expect(racers[0]!.marker.alpha).toBe(0.8);
    expect(racers[0]!.bodySprite!.alpha).toBe(0.8);
    expect(racers[0]!.sprite.zIndex).toBe(2120);
    expect(racers[0]!.labelBg.zIndex).toBe(12120);
    expect(racers[0]!.labelText.zIndex).toBe(12121);
    expect(racers[0]!.labelBg.position.y).toBeLessThan(racers[0]!.sprite.position.y);
  });

  it('resolves replay racer progress in coast phase with decay and monotonic guard', () => {
    const racer: ReplayProgressRacer = {
      progress: 0.86,
      finishApproachRatePerSec: 0.2
    };

    const result = resolveReplayRacerProgress({
      racer,
      dt: 1 / 60,
      raceTimeMs: 35_000,
      replayDurationMs: 42_000,
      adjustedProgress: 0.86,
      rawProgress: 0.88,
      baseProgressSpeed: 0.02,
      localRatePerSec: 0.01,
      finishProgressOnFullRun: 0.85,
      effectiveCoastStop: 0.97,
      alreadyFinished: true,
      crossedFinishLine: true,
      clipFreezeProgress: 0.91
    });

    expect(result.raceProgress).toBeGreaterThanOrEqual(0.86);
    expect(result.shouldFreeze).toBe(false);
    expect(racer.coastEntryRatePerSec).toBeDefined();
    expect(racer.terminalCruiseRatePerSec).toBeDefined();
  });

  it('resolves replay racer progress after data end before finish', () => {
    const racer: ReplayProgressRacer = {
      progress: 0.81,
      finishApproachRatePerSec: 0.015
    };

    const result = resolveReplayRacerProgress({
      racer,
      dt: 1 / 30,
      raceTimeMs: 50_000,
      replayDurationMs: 42_000,
      adjustedProgress: 0.8,
      rawProgress: 0.8,
      baseProgressSpeed: 0.02,
      localRatePerSec: 0,
      finishProgressOnFullRun: 0.9,
      effectiveCoastStop: 0.98,
      alreadyFinished: false,
      crossedFinishLine: false,
      clipFreezeProgress: 0.91
    });

    expect(result.raceProgress).toBeGreaterThanOrEqual(0.81);
    expect(result.raceProgress).toBeLessThanOrEqual(0.9);
    expect(racer.finishApproachRatePerSec).toBeGreaterThan(0.015);
    expect(racer.terminalCruiseRatePerSec).toBeUndefined();
  });
});
