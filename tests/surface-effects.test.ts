/**
 * File: tests/surface-effects.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for extensible surface effect profile and category setup.
 * Usage: Runs with Vitest as part of viewer visual policy validation.
 */

import { describe, expect, it } from 'vitest';

import {
  buildSurfaceEffectSetup,
  emitSurfaceParticles,
  poseScaleByMotionStyle,
  resolveSurfaceProfile,
  tickSurfaceParticles,
  type SurfaceParticle
} from '../apps/web-viewer/src/surface-effects';

describe('surface effects profiles', () => {
  it('resolves water profile from duck/canal effect ids', () => {
    const profile = resolveSurfaceProfile('duck-canal-default', 'duck');
    expect(profile.id).toBe('water-calm');
  });

  it('scales intensity up for heavy categories and sizes', () => {
    const smallBird = buildSurfaceEffectSetup({ raceType: 'duck', sizeClass: 'small' });
    const hugeHeavy = buildSurfaceEffectSetup({
      raceType: 'elephant',
      category: 'heavy-animal',
      sizeClass: 'huge',
      effectProfileId: 'sand-arena-heavy'
    });

    expect(hugeHeavy.intensityScale).toBeGreaterThan(smallBird.intensityScale);
  });

  it('returns different pose signatures for gallop and glide motion', () => {
    const gallopPose = poseScaleByMotionStyle('gallop', 420, 0.8);
    const glidePose = poseScaleByMotionStyle('glide', 420, 0.8);

    expect(Math.abs(gallopPose.scaleX - 1)).toBeGreaterThan(Math.abs(glidePose.scaleX - 1));
  });

  it('emits clearly different particle behavior for water and sand profiles', () => {
    const waterSetup = buildSurfaceEffectSetup({ effectProfileId: 'water-choppy', raceType: 'duck' });
    const sandSetup = buildSurfaceEffectSetup({ effectProfileId: 'sand-dry', raceType: 'horse' });
    const waterParticles: SurfaceParticle[] = [];
    const sandParticles: SurfaceParticle[] = [];

    emitSurfaceParticles(waterParticles, waterSetup, {
      x: 100,
      y: 100,
      dx: 14,
      dy: 3,
      speedNorm: 0.9,
      dtSec: 1 / 60,
      elapsedMs: 500
    });
    emitSurfaceParticles(sandParticles, sandSetup, {
      x: 100,
      y: 100,
      dx: 14,
      dy: 3,
      speedNorm: 0.9,
      dtSec: 1 / 60,
      elapsedMs: 500
    });

    const waterAvgVy = waterParticles.reduce((sum, p) => sum + p.vy, 0) / waterParticles.length;
    const sandAvgVy = sandParticles.reduce((sum, p) => sum + p.vy, 0) / sandParticles.length;
    expect(waterParticles.length).toBeGreaterThan(0);
    expect(sandParticles.length).toBeGreaterThan(0);
    // Choppy water should throw particles more upward (more negative vy) than dry sand.
    expect(waterAvgVy).toBeLessThan(sandAvgVy);

    tickSurfaceParticles(waterParticles, waterSetup, 0.016);
    tickSurfaceParticles(sandParticles, sandSetup, 0.016);
  });

  it('applies hoof-animal cadence with burst then short pause', () => {
    const horseSetup = buildSurfaceEffectSetup({
      raceType: 'horse',
      category: 'hoof-animal',
      effectProfileId: 'sand-dry'
    });
    const burstParticles: SurfaceParticle[] = [];
    const pauseParticles: SurfaceParticle[] = [];

    // Early phase produces a stronger gallop burst.
    emitSurfaceParticles(burstParticles, horseSetup, {
      x: 200,
      y: 200,
      dx: 10,
      dy: 2,
      speedNorm: 0.95,
      dtSec: 1 / 60,
      elapsedMs: 80
    });

    // Later in cycle should include pause/low spray.
    emitSurfaceParticles(pauseParticles, horseSetup, {
      x: 200,
      y: 200,
      dx: 10,
      dy: 2,
      speedNorm: 0.95,
      dtSec: 1 / 60,
      elapsedMs: 300
    });

    expect(burstParticles.length).toBeGreaterThan(pauseParticles.length);
  });

  it('emits profile-specific particle shapes', () => {
    const waterSetup = buildSurfaceEffectSetup({ effectProfileId: 'water-choppy', raceType: 'duck' });
    const snowSetup = buildSurfaceEffectSetup({ effectProfileId: 'snow-powder', raceType: 'duck' });
    const waterParticles: SurfaceParticle[] = [];
    const snowParticles: SurfaceParticle[] = [];

    emitSurfaceParticles(waterParticles, waterSetup, {
      x: 80,
      y: 60,
      dx: 8,
      dy: 2,
      speedNorm: 0.8,
      dtSec: 1 / 60,
      elapsedMs: 200
    });

    emitSurfaceParticles(snowParticles, snowSetup, {
      x: 80,
      y: 60,
      dx: 8,
      dy: 2,
      speedNorm: 0.8,
      dtSec: 1 / 60,
      elapsedMs: 200
    });

    expect(waterParticles.length).toBeGreaterThan(0);
    expect(snowParticles.length).toBeGreaterThan(0);
    expect(waterParticles[0]?.shape).toBe('spray');
    expect(snowParticles[0]?.shape).toBe('flake');
  });
});
