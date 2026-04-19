/**
 * File: apps/web-viewer/src/surface-effects.ts
 * Model: GPT-5.3-Codex
 * Purpose: Centralized, extensible surface-effect profile and category model for race visuals.
 * Usage: Shared by runtime/studio surfaces to resolve profile style, emission scale, and motion style.
 */

import type { Graphics } from 'pixi.js';

export type SurfaceProfileId =
  | 'water-calm'
  | 'water-choppy'
  | 'sand-dry'
  | 'sand-wet'
  | 'snow-powder'
  | 'ash-track'
  | 'space-plasma'
  | 'grass-mud'
  | 'neon-grid';

export type RacerCategory = 'bird' | 'hoof-animal' | 'heavy-animal' | 'ship' | 'rocket' | 'generic';

export type RacerSizeClass = 'small' | 'medium' | 'large' | 'huge';

export type MotionStyle = 'glide' | 'gallop' | 'stomp' | 'sail' | 'thrust' | 'generic';
export type ParticleShape = 'droplet' | 'spray' | 'dust' | 'flake' | 'ember' | 'plasma' | 'bubble';

export interface SurfaceEffectProfile {
  id: SurfaceProfileId;
  displayName: string;
  primaryColor: number;
  secondaryColor: number;
  gravityY: number;
  drag: number;
  spread: number;
  baseLifetimeMs: number;
  baseSizePx: number;
  baseEmissionRate: number;
  launchMultiplier: number;
  turbulence: number;
  verticalKick: number;
  particleShape: ParticleShape;
}

export interface SurfaceEffectSetup {
  profile: SurfaceEffectProfile;
  category: RacerCategory;
  sizeClass: RacerSizeClass;
  motionStyle: MotionStyle;
  intensityScale: number;
}

export interface SurfaceParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
  sizePx: number;
  color: number;
  shape: ParticleShape;
}

export interface EmitParticleOptions {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speedNorm: number;
  dtSec: number;
  elapsedMs?: number;
}

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

export function listSurfaceProfiles(): SurfaceEffectProfile[] {
  return Object.values(SURFACE_PROFILES);
}

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

export function resolveRacerCategory(raceType: string | undefined): RacerCategory {
  const key = (raceType ?? '').toLowerCase();
  if (key.includes('duck') || key.includes('bird')) return 'bird';
  if (key.includes('horse') || key.includes('camel')) return 'hoof-animal';
  if (key.includes('elephant') || key.includes('rhino')) return 'heavy-animal';
  if (key.includes('ship') || key.includes('boat')) return 'ship';
  if (key.includes('rocket') || key.includes('jet')) return 'rocket';
  return 'generic';
}

export function defaultSizeClassForCategory(category: RacerCategory): RacerSizeClass {
  if (category === 'bird') return 'small';
  if (category === 'hoof-animal') return 'medium';
  if (category === 'heavy-animal') return 'huge';
  if (category === 'ship') return 'large';
  if (category === 'rocket') return 'medium';
  return 'medium';
}

export function resolveMotionStyle(category: RacerCategory): MotionStyle {
  if (category === 'bird') return 'glide';
  if (category === 'hoof-animal') return 'gallop';
  if (category === 'heavy-animal') return 'stomp';
  if (category === 'ship') return 'sail';
  if (category === 'rocket') return 'thrust';
  return 'generic';
}

export function buildSurfaceEffectSetup(options: {
  effectProfileId?: string;
  raceType?: string;
  category?: RacerCategory;
  sizeClass?: RacerSizeClass;
}): SurfaceEffectSetup {
  const profile = resolveSurfaceProfile(options.effectProfileId, options.raceType);
  const category = options.category ?? resolveRacerCategory(options.raceType);
  const sizeClass = options.sizeClass ?? defaultSizeClassForCategory(category);
  const motionStyle = resolveMotionStyle(category);

  const sizeScale =
    sizeClass === 'small' ? 0.7 : sizeClass === 'medium' ? 1 : sizeClass === 'large' ? 1.35 : 1.8;
  const categoryScale =
    category === 'bird'
      ? 0.88
      : category === 'hoof-animal'
        ? 1.1
        : category === 'heavy-animal'
          ? 1.55
          : category === 'ship'
            ? 1.45
            : category === 'rocket'
              ? 1.25
              : 1;

  return {
    profile,
    category,
    sizeClass,
    motionStyle,
    intensityScale: sizeScale * categoryScale
  };
}

export function emitSurfaceParticles(
  particles: SurfaceParticle[],
  setup: SurfaceEffectSetup,
  options: EmitParticleOptions
): void {
  const elapsedSec = Math.max(0, (options.elapsedMs ?? 0) / 1000);
  const speed = clamp01(options.speedNorm);
  const base = setup.profile.baseEmissionRate * setup.intensityScale;
  const cadence = resolveCategoryCadence(setup.motionStyle, elapsedSec, speed);
  const emitCount = Math.max(0, Math.round(base * speed * cadence * options.dtSec * 60));
  if (emitCount <= 0) return;

  const tailX = -options.dx;
  const tailY = -options.dy;
  const len = Math.hypot(tailX, tailY) || 1;
  const nx = tailX / len;
  const ny = tailY / len;

  for (let i = 0; i < emitCount; i += 1) {
    const spread = setup.profile.spread * (0.5 + Math.random() * 0.9);
    const jitterX = (Math.random() - 0.5) * spread * 16;
    const jitterY = (Math.random() - 0.5) * spread * 16;
    const launch =
      (25 + Math.random() * 55) *
      (0.4 + speed * 1.1) *
      setup.intensityScale *
      setup.profile.launchMultiplier;
    const turbulence = setup.profile.turbulence;

    particles.push({
      x: options.x + jitterX,
      y: options.y + jitterY,
      vx: nx * launch + (Math.random() - 0.5) * spread * 45 * turbulence,
      vy:
        ny * launch + (Math.random() - 0.5) * spread * 45 * turbulence + setup.profile.verticalKick,
      ageMs: 0,
      lifeMs: setup.profile.baseLifetimeMs * (0.75 + Math.random() * 0.5),
      sizePx: setup.profile.baseSizePx * setup.intensityScale * (0.7 + Math.random() * 0.8),
      color: Math.random() > 0.45 ? setup.profile.primaryColor : setup.profile.secondaryColor,
      shape: setup.profile.particleShape
    });
  }

  if (particles.length > 480) {
    particles.splice(0, particles.length - 480);
  }
}

export function tickSurfaceParticles(
  particles: SurfaceParticle[],
  setup: SurfaceEffectSetup,
  dtSec: number
): void {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i]!;
    p.ageMs += dtSec * 1000;
    if (p.ageMs >= p.lifeMs) {
      particles.splice(i, 1);
      continue;
    }

    p.vx *= 1 - Math.min(0.99, setup.profile.drag * dtSec);
    p.vy = p.vy * (1 - Math.min(0.99, setup.profile.drag * dtSec)) + setup.profile.gravityY * dtSec;
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
  }
}

export function drawSurfaceParticles(graphics: Graphics, particles: SurfaceParticle[]): void {
  graphics.clear();
  for (const p of particles) {
    const life = 1 - p.ageMs / p.lifeMs;
    const alpha = Math.max(0, life * 0.85);
    const r = Math.max(0.6, p.sizePx * (0.55 + life * 0.45));
    drawParticleShape(graphics, p, r, alpha);
  }
}

export function poseScaleByMotionStyle(
  motionStyle: MotionStyle,
  elapsedMs: number,
  speedNorm: number
): { scaleX: number; scaleY: number; tiltRad: number } {
  const t = elapsedMs / 1000;
  const speed = clamp01(speedNorm);
  if (motionStyle === 'gallop') {
    const swing = Math.sin(t * (6 + speed * 8));
    return { scaleX: 1 + swing * 0.1, scaleY: 1 - swing * 0.08, tiltRad: swing * 0.08 };
  }
  if (motionStyle === 'stomp') {
    const bump = Math.sin(t * (3 + speed * 4));
    return { scaleX: 1 + bump * 0.05, scaleY: 1 - bump * 0.04, tiltRad: bump * 0.03 };
  }
  if (motionStyle === 'sail') {
    const sway = Math.sin(t * 2.6);
    return { scaleX: 1 + sway * 0.03, scaleY: 1 - sway * 0.02, tiltRad: sway * 0.05 };
  }
  if (motionStyle === 'thrust') {
    const pulse = Math.sin(t * (8 + speed * 10));
    return { scaleX: 1 - pulse * 0.05, scaleY: 1 + pulse * 0.07, tiltRad: pulse * 0.02 };
  }

  const glide = Math.sin(t * (3 + speed * 5));
  return { scaleX: 1 + glide * 0.03, scaleY: 1 - glide * 0.03, tiltRad: glide * 0.04 };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function resolveCategoryCadence(
  motionStyle: MotionStyle,
  elapsedSec: number,
  speedNorm: number
): number {
  const speed = clamp01(speedNorm);
  if (motionStyle === 'gallop') {
    // Two hoof bursts followed by a short pause, then repeat.
    const phase = (elapsedSec * (1.8 + speed * 0.95)) % 1;
    if (phase < 0.16) return 2.1;
    if (phase < 0.3) return 1.35;
    if (phase < 0.52) return 0.34;
    if (phase < 0.72) return 1.7;
    if (phase < 0.86) return 0.92;
    return 0.2;
  }
  if (motionStyle === 'stomp') {
    const beat = Math.sin(elapsedSec * (4 + speed * 2.4));
    return beat > 0.28 ? 1.85 : 0.2;
  }
  if (motionStyle === 'sail') {
    const wave = 0.55 + 0.45 * Math.sin(elapsedSec * 2.2);
    return 0.62 + wave * 0.74;
  }
  if (motionStyle === 'thrust') {
    const pulse = 0.6 + 0.4 * Math.sin(elapsedSec * (9 + speed * 5));
    return 0.95 + pulse * 0.85;
  }
  if (motionStyle === 'glide') {
    return 0.72 + Math.sin(elapsedSec * (2.6 + speed * 1.8)) * 0.12;
  }
  return 1;
}

function drawParticleShape(
  graphics: Graphics,
  particle: SurfaceParticle,
  radius: number,
  alpha: number
): void {
  graphics.beginFill(particle.color, alpha);

  if (particle.shape === 'dust') {
    graphics.drawEllipse(particle.x, particle.y, radius * 1.35, radius * 0.85);
    graphics.endFill();
    return;
  }

  if (particle.shape === 'spray') {
    graphics.drawEllipse(particle.x, particle.y, radius * 0.78, radius * 1.5);
    graphics.endFill();
    return;
  }

  if (particle.shape === 'flake') {
    graphics.drawRoundedRect(
      particle.x - radius * 0.65,
      particle.y - radius * 0.65,
      radius * 1.3,
      radius * 1.3,
      Math.max(0.4, radius * 0.22)
    );
    graphics.endFill();
    return;
  }

  if (particle.shape === 'ember') {
    graphics.drawPolygon([
      particle.x,
      particle.y - radius * 1.15,
      particle.x + radius * 0.95,
      particle.y,
      particle.x,
      particle.y + radius * 1.15,
      particle.x - radius * 0.95,
      particle.y
    ]);
    graphics.endFill();
    return;
  }

  if (particle.shape === 'plasma') {
    graphics.drawEllipse(particle.x, particle.y, radius * 1.55, radius * 0.72);
    graphics.endFill();
    return;
  }

  if (particle.shape === 'bubble') {
    graphics.drawCircle(particle.x, particle.y, radius * 0.92);
    graphics.endFill();
    graphics.lineStyle(Math.max(0.8, radius * 0.24), 0xffffff, alpha * 0.28);
    graphics.drawCircle(particle.x, particle.y, radius * 0.92);
    graphics.lineStyle(0, 0, 0);
    return;
  }

  graphics.drawCircle(particle.x, particle.y, radius);
  graphics.endFill();
}
