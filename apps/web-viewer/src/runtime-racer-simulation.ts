/**
 * File: apps/web-viewer/src/runtime-racer-simulation.ts
 * Model: GPT-5.3-Codex
 * Purpose: Deterministic automatic racer movement model for runtime playback.
 * Usage: Runtime surface builds racer models once and samples per-frame movement snapshots.
 */

export interface RuntimeAutoRacerModel {
  id: string;
  index: number;
  startOffset: number;
  basePace: number;
  skill: number;
  consistency: number;
  aggression: number;
  laneBias: number;
  weavePhase: number;
  sprintPhase: number;
}

export interface RuntimeAutoRacerFrame {
  id: string;
  index: number;
  progress: number;
  speedNorm: number;
  lateralOffset: number;
}

export type RuntimeRacerBehaviorPreset = 'arcade' | 'balanced' | 'chaotic';

export interface RuntimeRacerSimulationOptions {
  behaviorPreset?: RuntimeRacerBehaviorPreset;
}

interface RuntimeBehaviorPresetConfig {
  paceAmplitude: number;
  weaveAmplitude: number;
  rubberBandStrength: number;
  leaderDragStrength: number;
  overtakeKick: number;
  collisionRepel: number;
}

const MIN_RACER_COUNT = 2;
const MAX_RACER_COUNT = 100;
const TAU = Math.PI * 2;
const BEHAVIOR_PRESETS: Record<RuntimeRacerBehaviorPreset, RuntimeBehaviorPresetConfig> = {
  arcade: {
    paceAmplitude: 0.92,
    weaveAmplitude: 0.85,
    rubberBandStrength: 1.2,
    leaderDragStrength: 0.55,
    overtakeKick: 1.18,
    collisionRepel: 1.08
  },
  balanced: {
    paceAmplitude: 1,
    weaveAmplitude: 1,
    rubberBandStrength: 1,
    leaderDragStrength: 1,
    overtakeKick: 1,
    collisionRepel: 1
  },
  chaotic: {
    paceAmplitude: 1.2,
    weaveAmplitude: 1.35,
    rubberBandStrength: 0.78,
    leaderDragStrength: 0.78,
    overtakeKick: 1.38,
    collisionRepel: 1.28
  }
};

export function resolveRuntimeRacerBehaviorPreset(
  value: string | null | undefined
): RuntimeRacerBehaviorPreset {
  if (value === 'arcade' || value === 'balanced' || value === 'chaotic') {
    return value;
  }
  return 'balanced';
}

export function clampRuntimeRacerCount(racerCount: number): number {
  if (!Number.isFinite(racerCount)) return 12;
  return Math.max(MIN_RACER_COUNT, Math.min(MAX_RACER_COUNT, Math.floor(racerCount)));
}

export function createRuntimeAutoRacerModels(
  racerCount: number,
  options: RuntimeRacerSimulationOptions = {}
): RuntimeAutoRacerModel[] {
  const safeCount = clampRuntimeRacerCount(racerCount);
  const preset = BEHAVIOR_PRESETS[options.behaviorPreset ?? 'balanced'];

  return Array.from({ length: safeCount }, (_, index) => {
    const seedA = hashToUnit(index + 1, 19.17);
    const seedB = hashToUnit(index + 1, 41.93);
    const seedC = hashToUnit(index + 1, 73.07);
    const seedD = hashToUnit(index + 1, 97.41);

    return {
      id: `runtime-racer-${index + 1}`,
      index,
      startOffset: index / safeCount,
      basePace: 0.86 + seedA * 0.26 * preset.paceAmplitude,
      skill: 0.72 + seedD * 0.52,
      consistency: 0.58 + seedA * 0.35,
      aggression: 0.45 + seedB * 0.7,
      laneBias: (seedB * 2 - 1) * 0.92,
      weavePhase: seedC * TAU,
      sprintPhase: seedA * TAU
    };
  });
}

export function buildRuntimeAutoRacerFrame(
  models: RuntimeAutoRacerModel[],
  elapsedMs: number,
  lapDurationMs: number,
  options: RuntimeRacerSimulationOptions = {}
): RuntimeAutoRacerFrame[] {
  const safeLapMs = Math.max(4_000, lapDurationMs);
  const loopProgress = elapsedMs / safeLapMs;
  const preset = BEHAVIOR_PRESETS[options.behaviorPreset ?? 'balanced'];

  const entries = models.map((model) => {
    const cadenceBoost =
      Math.sin(loopProgress * TAU * 0.62 + model.sprintPhase) * 0.042 * model.consistency +
      Math.sin(loopProgress * TAU * 2.4 + model.weavePhase) * 0.016 * preset.paceAmplitude;
    const pace = clamp(0.7, 1.34, model.basePace + cadenceBoost);
    const longProgress = model.startOffset + loopProgress * pace;
    const lateralOffset = clamp(
      -1,
      1,
      model.laneBias * 0.62 +
        Math.sin(loopProgress * TAU + model.weavePhase) * 0.22 * preset.weaveAmplitude
    );

    return {
      model,
      pace,
      longProgress,
      lateralOffset
    };
  });

  const sorted = [...entries].sort((a, b) => b.longProgress - a.longProgress);
  const leaderLongProgress = sorted[0]?.longProgress ?? 0;
  const rankById = new Map(sorted.map((entry, index) => [entry.model.id, index]));

  for (const entry of entries) {
    const rank = rankById.get(entry.model.id) ?? 0;
    const gapToLeader = Math.max(0, leaderLongProgress - entry.longProgress);

    const trailingBoost =
      rank > 0
        ? clamp(0, 0.075, gapToLeader * 0.045 * entry.model.skill * preset.rubberBandStrength)
        : 0;
    const leaderDrag =
      rank === 0 ? clamp(0, 0.03, models.length * 0.00012 * preset.leaderDragStrength) : 0;
    entry.pace = clamp(0.68, 1.4, entry.pace + trailingBoost - leaderDrag);
  }

  applyOvertakeImpulse(entries, preset);
  applyLateralConflictRepel(entries, preset);

  return entries.map((entry) => {
    const progress = wrap01(
      entry.longProgress + loopProgress * (entry.pace - entry.model.basePace)
    );
    return {
      id: entry.model.id,
      index: entry.model.index,
      progress,
      speedNorm: clamp01((entry.pace - 0.68) / (1.4 - 0.68)),
      lateralOffset: entry.lateralOffset
    };
  });
}

function applyOvertakeImpulse(
  entries: Array<{
    model: RuntimeAutoRacerModel;
    pace: number;
    longProgress: number;
    lateralOffset: number;
  }>,
  preset: RuntimeBehaviorPresetConfig
): void {
  const sorted = [...entries].sort((a, b) => b.longProgress - a.longProgress);
  for (let index = 1; index < sorted.length; index += 1) {
    const chaser = sorted[index];
    const ahead = sorted[index - 1];
    if (!chaser || !ahead) continue;

    const gap = ahead.longProgress - chaser.longProgress;
    if (gap <= 0.002 || gap > 0.03) {
      continue;
    }

    const laneGap = Math.abs(chaser.lateralOffset - ahead.lateralOffset);
    const overtakeBias = (0.03 - gap) * 3.2 * chaser.model.aggression * preset.overtakeKick;
    const trafficPenalty = laneGap < 0.2 ? 0.012 * (0.2 - laneGap) : 0;

    chaser.pace = clamp(0.68, 1.42, chaser.pace + overtakeBias - trafficPenalty);

    if (laneGap < 0.18) {
      const direction = chaser.lateralOffset <= ahead.lateralOffset ? -1 : 1;
      chaser.lateralOffset = clamp(-1, 1, chaser.lateralOffset + direction * 0.06);
    }
  }
}

function applyLateralConflictRepel(
  entries: Array<{
    model: RuntimeAutoRacerModel;
    pace: number;
    longProgress: number;
    lateralOffset: number;
  }>,
  preset: RuntimeBehaviorPresetConfig
): void {
  const sorted = [...entries].sort((a, b) => b.longProgress - a.longProgress);

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = sorted[index - 1];
    if (!current || !previous) continue;

    const progressGap = Math.abs(previous.longProgress - current.longProgress);
    if (progressGap > 0.02) {
      continue;
    }

    const lateralGap = previous.lateralOffset - current.lateralOffset;
    if (Math.abs(lateralGap) > 0.16) {
      continue;
    }

    const repel =
      (0.16 - Math.abs(lateralGap)) * 0.52 * preset.collisionRepel * (1 - progressGap / 0.02);
    const direction = lateralGap >= 0 ? 1 : -1;

    current.lateralOffset = clamp(-1, 1, current.lateralOffset - direction * repel);
    previous.lateralOffset = clamp(-1, 1, previous.lateralOffset + direction * repel * 0.82);
  }
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(0, 1, value);
}

function wrap01(value: number): number {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function hashToUnit(index: number, factor: number): number {
  const value = Math.sin(index * factor + 1.217) * 43_758.5453;
  return value - Math.floor(value);
}
