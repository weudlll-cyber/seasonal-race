/**
 * File: apps/web-viewer/src/studio-surface-effects-state.ts
 * Model: GPT-5.3-Codex
 * Purpose: Encapsulates studio-side surface effect setup and particle-emission state transitions.
 * Usage: Used by studio-app to keep orchestration lean while preserving particle behavior.
 */

import {
  emitSurfaceParticles,
  resolveRacerCategory,
  type RacerCategory,
  type RacerSizeClass,
  type SurfaceEffectSetup,
  type SurfaceParticle
} from './surface-effects.js';

export interface StudioSurfaceEffectSelections {
  surfaceRaceType: string;
  surfaceCategory: RacerCategory | 'auto' | string;
  surfaceSizeClass: RacerSizeClass | 'auto' | string;
  surfaceProfile: string;
  effectProfileInput: string;
  trackId: string;
}

export interface StudioSurfaceEffectSetupInput {
  raceType: string;
  category: RacerCategory;
  sizeClass: RacerSizeClass;
  effectProfileId?: string;
}

export interface StudioReplaySurfaceRacerLike {
  id: string;
  sprite: {
    visible: boolean;
    position: {
      x: number;
      y: number;
    };
  };
}

export interface StudioSurfaceEmitterState {
  elapsedMs: number;
  replayPreviousPositions: Map<string, { x: number; y: number }>;
  runnerPreviousPosition: { x: number; y: number } | null;
}

export interface AdvanceStudioSurfaceEmitterParams {
  dtSec: number;
  setup: SurfaceEffectSetup;
  particles: SurfaceParticle[];
  replayModeEnabled: boolean;
  replayRacers: StudioReplaySurfaceRacerLike[];
  runnerVisible: boolean;
  runnerX: number;
  runnerY: number;
  state: StudioSurfaceEmitterState;
}

function inferRaceType(trackId: string, effectProfileInput: string): string {
  const trackKey = trackId.trim().toLowerCase();
  const effectKey = effectProfileInput.trim().toLowerCase();
  if (trackKey.includes('duck') || effectKey.includes('duck') || effectKey.includes('water')) {
    return 'duck';
  }
  if (trackKey.includes('horse') || effectKey.includes('horse') || effectKey.includes('sand')) {
    return 'horse';
  }
  if (trackKey.includes('rocket') || effectKey.includes('rocket') || effectKey.includes('space')) {
    return 'rocket';
  }
  return 'generic';
}

function resolveStudioSizeClass(
  selectedSizeClass: string,
  replayRacerCount: number
): RacerSizeClass {
  if (selectedSizeClass === 'small' || selectedSizeClass === 'medium') {
    return selectedSizeClass;
  }
  if (selectedSizeClass === 'large' || selectedSizeClass === 'huge') {
    return selectedSizeClass;
  }

  if (replayRacerCount <= 8) return 'small';
  if (replayRacerCount <= 20) return 'medium';
  if (replayRacerCount <= 45) return 'large';
  return 'huge';
}

export function resolveStudioSurfaceEffectSetupInput(
  selections: StudioSurfaceEffectSelections,
  replayRacerCount: number
): StudioSurfaceEffectSetupInput {
  const selectedRaceType = selections.surfaceRaceType.trim().toLowerCase();
  const raceType =
    selectedRaceType && selectedRaceType !== 'auto'
      ? selectedRaceType
      : inferRaceType(selections.trackId, selections.effectProfileInput);

  const selectedCategory = selections.surfaceCategory;
  const category =
    selectedCategory !== 'auto' &&
    (selectedCategory === 'bird' ||
      selectedCategory === 'hoof-animal' ||
      selectedCategory === 'heavy-animal' ||
      selectedCategory === 'ship' ||
      selectedCategory === 'rocket' ||
      selectedCategory === 'generic')
      ? selectedCategory
      : resolveRacerCategory(raceType);

  const sizeClass = resolveStudioSizeClass(selections.surfaceSizeClass, replayRacerCount);

  const selectedProfileId = selections.surfaceProfile.trim();
  const typedEffectProfileId = selections.effectProfileInput.trim();
  const effectProfileId =
    selectedProfileId && selectedProfileId !== 'auto'
      ? selectedProfileId
      : typedEffectProfileId || undefined;

  if (!effectProfileId) {
    return { raceType, category, sizeClass };
  }

  return {
    raceType,
    category,
    sizeClass,
    effectProfileId
  };
}

export function advanceStudioSurfaceEmitter(
  params: AdvanceStudioSurfaceEmitterParams
): StudioSurfaceEmitterState {
  const nextElapsedMs = params.state.elapsedMs + params.dtSec * 1000;
  const replayPreviousPositions = params.state.replayPreviousPositions;

  if (params.replayModeEnabled) {
    for (const rr of params.replayRacers) {
      if (!rr.sprite.visible) continue;
      const prev = replayPreviousPositions.get(rr.id);
      const x = rr.sprite.position.x;
      const y = rr.sprite.position.y;
      const dx = prev ? x - prev.x : 0;
      const dy = prev ? y - prev.y : 0;
      const distance = Math.hypot(dx, dy);
      const speedNorm = Math.max(0.15, Math.min(1, distance / Math.max(8, 180 * params.dtSec)));
      emitSurfaceParticles(params.particles, params.setup, {
        x,
        y: y + 10,
        dx,
        dy,
        speedNorm,
        dtSec: params.dtSec,
        elapsedMs: nextElapsedMs
      });
      replayPreviousPositions.set(rr.id, { x, y });
    }

    return {
      elapsedMs: nextElapsedMs,
      replayPreviousPositions,
      runnerPreviousPosition: null
    };
  }

  replayPreviousPositions.clear();
  if (!params.runnerVisible) {
    return {
      elapsedMs: nextElapsedMs,
      replayPreviousPositions,
      runnerPreviousPosition: null
    };
  }

  const prev = params.state.runnerPreviousPosition;
  const dx = prev ? params.runnerX - prev.x : 0;
  const dy = prev ? params.runnerY - prev.y : 0;
  const distance = Math.hypot(dx, dy);
  const speedNorm = Math.max(0.12, Math.min(1, distance / Math.max(8, 160 * params.dtSec)));

  emitSurfaceParticles(params.particles, params.setup, {
    x: params.runnerX,
    y: params.runnerY + 10,
    dx,
    dy,
    speedNorm,
    dtSec: params.dtSec,
    elapsedMs: nextElapsedMs
  });

  return {
    elapsedMs: nextElapsedMs,
    replayPreviousPositions,
    runnerPreviousPosition: { x: params.runnerX, y: params.runnerY }
  };
}
