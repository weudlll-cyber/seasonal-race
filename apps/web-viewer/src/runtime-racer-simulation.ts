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

const MIN_RACER_COUNT = 2;
const MAX_RACER_COUNT = 100;
const TAU = Math.PI * 2;

export function clampRuntimeRacerCount(racerCount: number): number {
  if (!Number.isFinite(racerCount)) return 12;
  return Math.max(MIN_RACER_COUNT, Math.min(MAX_RACER_COUNT, Math.floor(racerCount)));
}

export function createRuntimeAutoRacerModels(racerCount: number): RuntimeAutoRacerModel[] {
  const safeCount = clampRuntimeRacerCount(racerCount);
  return Array.from({ length: safeCount }, (_, index) => {
    const seedA = hashToUnit(index + 1, 19.17);
    const seedB = hashToUnit(index + 1, 41.93);
    const seedC = hashToUnit(index + 1, 73.07);

    return {
      id: `runtime-racer-${index + 1}`,
      index,
      startOffset: index / safeCount,
      basePace: 0.88 + seedA * 0.24,
      laneBias: (seedB * 2 - 1) * 0.92,
      weavePhase: seedC * TAU,
      sprintPhase: seedA * TAU
    };
  });
}

export function buildRuntimeAutoRacerFrame(
  models: RuntimeAutoRacerModel[],
  elapsedMs: number,
  lapDurationMs: number
): RuntimeAutoRacerFrame[] {
  const safeLapMs = Math.max(4_000, lapDurationMs);
  const loopProgress = elapsedMs / safeLapMs;

  return models.map((model) => {
    const cadenceBoost =
      Math.sin(loopProgress * TAU * 0.62 + model.sprintPhase) * 0.042 +
      Math.sin(loopProgress * TAU * 2.4 + model.weavePhase) * 0.016;
    const pace = clamp(0.72, 1.28, model.basePace + cadenceBoost);
    const progress = wrap01(model.startOffset + loopProgress * pace);
    const lateralOffset = clamp(
      -1,
      1,
      model.laneBias * 0.7 + Math.sin(loopProgress * TAU + model.weavePhase) * 0.3
    );

    return {
      id: model.id,
      index: model.index,
      progress,
      speedNorm: clamp01((pace - 0.72) / (1.28 - 0.72)),
      lateralOffset
    };
  });
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
