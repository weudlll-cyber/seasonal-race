/**
 * File: tests/studio-surface-effects-state.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies studio surface setup resolution and emitter state transitions.
 * Usage: Runs under Vitest with the rest of the studio regression suite.
 */

import { describe, expect, it } from 'vitest';

import {
  buildSurfaceEffectSetup,
  type SurfaceParticle
} from '../apps/web-viewer/src/surface-effects';
import {
  advanceStudioSurfaceEmitter,
  resolveStudioSurfaceEffectSetupInput
} from '../apps/web-viewer/src/studio-surface-effects-state';

describe('studio surface effect state', () => {
  it('prefers explicit race type and profile selection when not auto', () => {
    const setupInput = resolveStudioSurfaceEffectSetupInput(
      {
        surfaceRaceType: 'Horse',
        surfaceCategory: 'auto',
        surfaceSizeClass: 'auto',
        surfaceProfile: 'sand-wet',
        effectProfileInput: 'water-calm',
        trackId: 'duck-track'
      },
      12
    );

    expect(setupInput.raceType).toBe('horse');
    expect(setupInput.category).toBe('hoof-animal');
    expect(setupInput.sizeClass).toBe('medium');
    expect(setupInput.effectProfileId).toBe('sand-wet');
  });

  it('infers race type/category from track and effect ids in auto mode', () => {
    const setupInput = resolveStudioSurfaceEffectSetupInput(
      {
        surfaceRaceType: 'auto',
        surfaceCategory: 'auto',
        surfaceSizeClass: 'auto',
        surfaceProfile: 'auto',
        effectProfileInput: 'space-plasma-alpha',
        trackId: 'rocket-oval'
      },
      60
    );

    expect(setupInput.raceType).toBe('rocket');
    expect(setupInput.category).toBe('rocket');
    expect(setupInput.sizeClass).toBe('huge');
    expect(setupInput.effectProfileId).toBe('space-plasma-alpha');
  });

  it('uses explicit category and size class overrides', () => {
    const setupInput = resolveStudioSurfaceEffectSetupInput(
      {
        surfaceRaceType: 'auto',
        surfaceCategory: 'ship',
        surfaceSizeClass: 'large',
        surfaceProfile: 'auto',
        effectProfileInput: '',
        trackId: 'generic-track'
      },
      2
    );

    expect(setupInput.category).toBe('ship');
    expect(setupInput.sizeClass).toBe('large');
    expect(setupInput.effectProfileId).toBeUndefined();
  });

  it('updates replay map positions and clears runner state in replay mode', () => {
    const setup = buildSurfaceEffectSetup({ raceType: 'duck', sizeClass: 'small' });
    const particles: SurfaceParticle[] = [];
    const replayPreviousPositions = new Map<string, { x: number; y: number }>();

    const state = advanceStudioSurfaceEmitter({
      dtSec: 1 / 60,
      setup,
      particles,
      replayModeEnabled: true,
      replayRacers: [
        {
          id: 'D1',
          sprite: {
            visible: true,
            position: { x: 100, y: 200 }
          }
        }
      ],
      runnerVisible: true,
      runnerX: 0,
      runnerY: 0,
      state: {
        elapsedMs: 0,
        replayPreviousPositions,
        runnerPreviousPosition: { x: 9, y: 9 }
      }
    });

    expect(state.elapsedMs).toBeGreaterThan(0);
    expect(state.runnerPreviousPosition).toBeNull();
    expect(state.replayPreviousPositions.get('D1')).toEqual({ x: 100, y: 200 });
    expect(particles.length).toBeGreaterThan(0);
  });

  it('clears replay map and tracks runner motion in single-preview mode', () => {
    const setup = buildSurfaceEffectSetup({ raceType: 'horse', sizeClass: 'small' });
    const particles: SurfaceParticle[] = [];
    const replayPreviousPositions = new Map<string, { x: number; y: number }>();
    replayPreviousPositions.set('D8', { x: 4, y: 8 });

    const state = advanceStudioSurfaceEmitter({
      dtSec: 1 / 60,
      setup,
      particles,
      replayModeEnabled: false,
      replayRacers: [],
      runnerVisible: true,
      runnerX: 220,
      runnerY: 150,
      state: {
        elapsedMs: 500,
        replayPreviousPositions,
        runnerPreviousPosition: { x: 214, y: 150 }
      }
    });

    expect(state.replayPreviousPositions.size).toBe(0);
    expect(state.runnerPreviousPosition).toEqual({ x: 220, y: 150 });
    expect(state.elapsedMs).toBeGreaterThan(500);
    expect(particles.length).toBeGreaterThan(0);
  });

  it('keeps runner state null when runner is hidden in single-preview mode', () => {
    const setup = buildSurfaceEffectSetup({ raceType: 'generic', sizeClass: 'small' });
    const particles: SurfaceParticle[] = [];

    const state = advanceStudioSurfaceEmitter({
      dtSec: 1 / 60,
      setup,
      particles,
      replayModeEnabled: false,
      replayRacers: [],
      runnerVisible: false,
      runnerX: 0,
      runnerY: 0,
      state: {
        elapsedMs: 100,
        replayPreviousPositions: new Map<string, { x: number; y: number }>(),
        runnerPreviousPosition: { x: 1, y: 1 }
      }
    });

    expect(state.runnerPreviousPosition).toBeNull();
    expect(particles.length).toBe(0);
  });
});
