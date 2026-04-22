/**
 * File: apps/web-viewer/src/runtime-visual-quality.ts
 * Model: GPT-5.3-Codex
 * Purpose: Resolves runtime visual quality mode and adaptive rendering budgets.
 * Usage: Runtime app queries per-frame budgets to keep dense races responsive.
 */

export type RuntimeVisualQuality = 'low' | 'medium' | 'high' | 'auto';
export type RuntimeResolvedVisualQuality = 'low' | 'medium' | 'high';

export interface RuntimeVisualBudget {
  qualityResolved: RuntimeResolvedVisualQuality;
  waveSegments: number;
  foamSegments: number;
  maxWakeStreaks: number;
  maxRippleSeeds: number;
  effectIntensityScale: number;
}

export function resolveRuntimeVisualQuality(
  value: string | null | undefined
): RuntimeVisualQuality {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'auto') {
    return value;
  }
  return 'auto';
}

export function resolveRuntimeVisualBudget(options: {
  quality: RuntimeVisualQuality;
  racerCount: number;
  frameMs: number;
}): RuntimeVisualBudget {
  const safeRacers = Math.max(2, Math.min(100, Math.floor(options.racerCount)));
  const safeFrameMs = Math.max(6, Math.min(60, options.frameMs));
  const qualityResolved = resolveResolvedQuality(options.quality, safeRacers, safeFrameMs);
  const base =
    qualityResolved === 'high'
      ? {
          waveSegments: 26,
          foamSegments: 24,
          maxWakeStreaks: 960,
          maxRippleSeeds: 110,
          effectIntensityScale: 1
        }
      : qualityResolved === 'medium'
        ? {
            waveSegments: 18,
            foamSegments: 15,
            maxWakeStreaks: 620,
            maxRippleSeeds: 68,
            effectIntensityScale: 0.9
          }
        : {
            waveSegments: 10,
            foamSegments: 8,
            maxWakeStreaks: 320,
            maxRippleSeeds: 34,
            effectIntensityScale: 0.74
          };

  const framePenalty = clamp01((safeFrameMs - 16.7) / 18);
  const densityPenalty = clamp01((safeRacers - 24) / 76);
  const pressure = clamp01(framePenalty * 0.76 + densityPenalty * 0.62);
  const scale = 1 - pressure * 0.44;

  return {
    qualityResolved,
    waveSegments: Math.max(6, Math.round(base.waveSegments * scale)),
    foamSegments: Math.max(4, Math.round(base.foamSegments * scale)),
    maxWakeStreaks: Math.max(180, Math.round(base.maxWakeStreaks * scale)),
    maxRippleSeeds: Math.max(14, Math.round(base.maxRippleSeeds * scale)),
    effectIntensityScale: clamp(0.55, 1.05, base.effectIntensityScale * (1 - pressure * 0.28))
  };
}

function resolveResolvedQuality(
  quality: RuntimeVisualQuality,
  racerCount: number,
  frameMs: number
): RuntimeResolvedVisualQuality {
  if (quality !== 'auto') {
    return quality;
  }

  const highEligible = racerCount <= 24 && frameMs <= 17.8;
  if (highEligible) {
    return 'high';
  }

  const mediumEligible = racerCount <= 58 && frameMs <= 24;
  if (mediumEligible) {
    return 'medium';
  }

  return 'low';
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(0, 1, value);
}
