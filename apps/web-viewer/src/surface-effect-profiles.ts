/**
 * File: apps/web-viewer/src/surface-effect-profiles.ts
 * Model: GPT-5.3-Codex
 * Purpose: Encapsulates surface profile registry and profile resolution heuristics.
 * Usage: Imported by surface-effects to keep runtime simulation code focused.
 */

import type { SurfaceEffectProfile, SurfaceProfileId } from './surface-effects.js';

const SURFACE_PROFILES: Record<SurfaceProfileId, SurfaceEffectProfile> = {
  'water-calm': {
    id: 'water-calm',
    displayName: 'Calm Water',
    primaryColor: 0x8de9ff,
    secondaryColor: 0x46bfdc,
    gravityY: 28,
    drag: 0.9,
    spread: 0.72,
    baseLifetimeMs: 700,
    baseSizePx: 2.4,
    baseEmissionRate: 8,
    launchMultiplier: 0.86,
    turbulence: 0.9,
    verticalKick: -4,
    particleShape: 'bubble'
  },
  'water-choppy': {
    id: 'water-choppy',
    displayName: 'Choppy Water',
    primaryColor: 0xd8fbff,
    secondaryColor: 0x6fe7f5,
    gravityY: 34,
    drag: 0.88,
    spread: 0.92,
    baseLifetimeMs: 760,
    baseSizePx: 2.8,
    baseEmissionRate: 11,
    launchMultiplier: 1.26,
    turbulence: 1.25,
    verticalKick: -14,
    particleShape: 'spray'
  },
  'sand-dry': {
    id: 'sand-dry',
    displayName: 'Dry Sand',
    primaryColor: 0xe8c37a,
    secondaryColor: 0xca9b53,
    gravityY: 42,
    drag: 0.86,
    spread: 0.68,
    baseLifetimeMs: 900,
    baseSizePx: 2.2,
    baseEmissionRate: 10,
    launchMultiplier: 0.92,
    turbulence: 0.7,
    verticalKick: 18,
    particleShape: 'dust'
  },
  'sand-wet': {
    id: 'sand-wet',
    displayName: 'Wet Sand',
    primaryColor: 0xd3b27d,
    secondaryColor: 0x9e8158,
    gravityY: 46,
    drag: 0.84,
    spread: 0.6,
    baseLifetimeMs: 980,
    baseSizePx: 2.4,
    baseEmissionRate: 9,
    launchMultiplier: 0.78,
    turbulence: 0.58,
    verticalKick: 22,
    particleShape: 'dust'
  },
  'snow-powder': {
    id: 'snow-powder',
    displayName: 'Powder Snow',
    primaryColor: 0xf5fbff,
    secondaryColor: 0xc7e8ff,
    gravityY: 16,
    drag: 0.92,
    spread: 0.95,
    baseLifetimeMs: 1150,
    baseSizePx: 2.8,
    baseEmissionRate: 12,
    launchMultiplier: 0.75,
    turbulence: 1.12,
    verticalKick: -6,
    particleShape: 'flake'
  },
  'ash-track': {
    id: 'ash-track',
    displayName: 'Ash Track',
    primaryColor: 0xc9c8d4,
    secondaryColor: 0x8f8ca3,
    gravityY: 40,
    drag: 0.82,
    spread: 0.7,
    baseLifetimeMs: 980,
    baseSizePx: 2.6,
    baseEmissionRate: 10,
    launchMultiplier: 0.96,
    turbulence: 0.85,
    verticalKick: 10,
    particleShape: 'ember'
  },
  'space-plasma': {
    id: 'space-plasma',
    displayName: 'Space Plasma',
    primaryColor: 0x95c2ff,
    secondaryColor: 0xc78dff,
    gravityY: -8,
    drag: 0.95,
    spread: 1.12,
    baseLifetimeMs: 1200,
    baseSizePx: 2.4,
    baseEmissionRate: 9,
    launchMultiplier: 1.18,
    turbulence: 1.5,
    verticalKick: -20,
    particleShape: 'plasma'
  },
  'grass-mud': {
    id: 'grass-mud',
    displayName: 'Grass Mud',
    primaryColor: 0x8fbc63,
    secondaryColor: 0x547a39,
    gravityY: 44,
    drag: 0.82,
    spread: 0.56,
    baseLifetimeMs: 960,
    baseSizePx: 2.8,
    baseEmissionRate: 11,
    launchMultiplier: 0.9,
    turbulence: 0.66,
    verticalKick: 14,
    particleShape: 'dust'
  },
  'neon-grid': {
    id: 'neon-grid',
    displayName: 'Neon Grid',
    primaryColor: 0x7dfff3,
    secondaryColor: 0xff8be9,
    gravityY: 6,
    drag: 0.93,
    spread: 1,
    baseLifetimeMs: 860,
    baseSizePx: 2.3,
    baseEmissionRate: 10,
    launchMultiplier: 1.34,
    turbulence: 1.35,
    verticalKick: -10,
    particleShape: 'droplet'
  }
};

export function resolveSurfaceProfile(
  effectProfileId: string | undefined,
  raceType: string | undefined
): SurfaceEffectProfile {
  const normalized = (effectProfileId ?? '').toLowerCase();

  const exactProfile = SURFACE_PROFILES[normalized as SurfaceProfileId];
  if (exactProfile) {
    return exactProfile;
  }

  if (normalized.includes('water') || normalized.includes('canal') || normalized.includes('duck')) {
    return SURFACE_PROFILES['water-calm'];
  }
  if (
    normalized.includes('ship') ||
    normalized.includes('ocean') ||
    normalized.includes('harbor')
  ) {
    return SURFACE_PROFILES['water-choppy'];
  }
  if (
    normalized.includes('sand') ||
    normalized.includes('desert') ||
    normalized.includes('arena')
  ) {
    return SURFACE_PROFILES['sand-dry'];
  }
  if (normalized.includes('snow') || normalized.includes('ice') || normalized.includes('winter')) {
    return SURFACE_PROFILES['snow-powder'];
  }
  if (normalized.includes('ash') || normalized.includes('cinder') || normalized.includes('lava')) {
    return SURFACE_PROFILES['ash-track'];
  }
  if (
    normalized.includes('space') ||
    normalized.includes('plasma') ||
    normalized.includes('nebula')
  ) {
    return SURFACE_PROFILES['space-plasma'];
  }
  if (normalized.includes('neon') || normalized.includes('cyber')) {
    return SURFACE_PROFILES['neon-grid'];
  }

  const race = (raceType ?? '').toLowerCase();
  if (race.includes('duck')) return SURFACE_PROFILES['water-calm'];
  if (race.includes('horse')) return SURFACE_PROFILES['sand-dry'];
  if (race.includes('rocket')) return SURFACE_PROFILES['space-plasma'];

  return SURFACE_PROFILES['grass-mud'];
}
