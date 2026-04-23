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
  raceSeed?: number;
}

interface RuntimeBehaviorPresetConfig {
  paceAmplitude: number;
  rubberBandStrength: number;
  leaderDragStrength: number;
  laneChangeRate: number;
  laneChangeCooldownMs: number;
  followGap: number;
  passGap: number;
  weaveAmplitude: number;
}

interface RuntimeTrafficState {
  model: RuntimeAutoRacerModel;
  progress: number;
  speed: number;
  lane: number;
  targetLane: number;
  lateralOffset: number;
  laneCooldownMs: number;
}

const MIN_RACER_COUNT = 2;
const MAX_RACER_COUNT = 100;
const TAU = Math.PI * 2;
const TRAFFIC_STEP_MS = 120;
const BEHAVIOR_PRESETS: Record<RuntimeRacerBehaviorPreset, RuntimeBehaviorPresetConfig> = {
  arcade: {
    paceAmplitude: 0.92,
    rubberBandStrength: 1.2,
    leaderDragStrength: 0.55,
    laneChangeRate: 4.2,
    laneChangeCooldownMs: 780,
    followGap: 0.017,
    passGap: 0.028,
    weaveAmplitude: 0.7
  },
  balanced: {
    paceAmplitude: 1,
    rubberBandStrength: 1,
    leaderDragStrength: 1,
    laneChangeRate: 3.3,
    laneChangeCooldownMs: 920,
    followGap: 0.019,
    passGap: 0.031,
    weaveAmplitude: 0.62
  },
  chaotic: {
    paceAmplitude: 1.42,
    rubberBandStrength: 0.78,
    leaderDragStrength: 0.78,
    laneChangeRate: 4.8,
    laneChangeCooldownMs: 620,
    followGap: 0.016,
    passGap: 0.026,
    weaveAmplitude: 0.82
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
  const raceSeed = Number.isFinite(options.raceSeed) ? Math.trunc(options.raceSeed ?? 0) : 0;

  return Array.from({ length: safeCount }, (_, index) => {
    const seedA = hashToUnit(index + 1, 19.17, raceSeed);
    const seedB = hashToUnit(index + 1, 41.93, raceSeed);
    const seedC = hashToUnit(index + 1, 73.07, raceSeed);
    const seedD = hashToUnit(index + 1, 97.41, raceSeed);

    return {
      id: `runtime-racer-${index + 1}`,
      index,
      startOffset: 0,
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
  const safeElapsedMs = Math.max(0, elapsedMs);
  const preset = BEHAVIOR_PRESETS[options.behaviorPreset ?? 'balanced'];
  const laneCount = resolveRuntimeTrafficLaneCount(models.length);
  const maxLane = Math.floor(laneCount / 2);
  const states = createRuntimeTrafficStates(models, laneCount);

  let simulatedMs = 0;
  while (simulatedMs < safeElapsedMs) {
    const stepMs = Math.min(TRAFFIC_STEP_MS, safeElapsedMs - simulatedMs);
    simulatedMs += stepMs;
    stepRuntimeTraffic(states, simulatedMs, stepMs, safeLapMs, preset, maxLane);
  }

  return states.map((state) => ({
    id: state.model.id,
    index: state.model.index,
    progress: clamp01(state.progress),
    speedNorm: clamp01((state.speed - 0.52) / (1.34 - 0.52)),
    lateralOffset: clamp(-1, 1, state.lateralOffset)
  }));
}

function createRuntimeTrafficStates(
  models: RuntimeAutoRacerModel[],
  laneCount: number
): RuntimeTrafficState[] {
  const maxLane = Math.floor(laneCount / 2);
  return models.map((model, index) => {
    const initialLane = clamp(-maxLane, maxLane, (index % laneCount) - maxLane);
    return {
      model,
      progress: model.startOffset,
      speed: 0,
      lane: initialLane,
      targetLane: initialLane,
      lateralOffset: laneToNormalizedOffset(initialLane, maxLane),
      laneCooldownMs: 0
    };
  });
}

function stepRuntimeTraffic(
  states: RuntimeTrafficState[],
  elapsedMs: number,
  stepMs: number,
  lapDurationMs: number,
  preset: RuntimeBehaviorPresetConfig,
  maxLane: number
): void {
  const dtSec = stepMs / 1000;
  const dtRace = stepMs / lapDurationMs;
  const raceProgress = clamp01(elapsedMs / lapDurationMs);
  const sortedStates = [...states].sort((a, b) => b.progress - a.progress);
  const leaderProgress = sortedStates[0]?.progress ?? 0;
  const rankById = new Map(sortedStates.map((state, index) => [state.model.id, index]));
  const laneTrafficByLane = buildLaneTrafficByLane(states);
  const nearestGapById = buildNearestProgressGapById(states);

  for (const state of states) {
    const rank = rankById.get(state.model.id) ?? 0;
    const launchBlend = clamp01(raceProgress / 0.085);
    const cadenceBoost =
      Math.sin(raceProgress * TAU * 0.62 + state.model.sprintPhase) *
        0.028 *
        state.model.consistency +
      Math.sin(raceProgress * TAU * 1.8 + state.model.weavePhase) * 0.012 * preset.paceAmplitude;
    const gapToLeader = Math.max(0, leaderProgress - state.progress);
    const trailingBoost =
      rank > 0
        ? clamp(0, 0.05, gapToLeader * 0.032 * state.model.skill * preset.rubberBandStrength)
        : 0;
    const leaderDrag =
      rank === 0 ? clamp(0, 0.018, states.length * 0.00008 * preset.leaderDragStrength) : 0;
    let targetSpeed = clamp(
      0,
      1.26,
      (state.model.basePace + cadenceBoost + trailingBoost - leaderDrag) * launchBlend
    );

    if (state.laneCooldownMs > 0) {
      state.laneCooldownMs = Math.max(0, state.laneCooldownMs - stepMs);
    }

    const currentAhead = laneTrafficByLane.get(state.lane)?.ahead.get(state.model.id);
    const currentGap = currentAhead ? currentAhead.progressGap : Number.POSITIVE_INFINITY;
    const overtakePressure =
      currentGap < preset.passGap * 1.2 ||
      (currentAhead !== undefined &&
        currentGap < preset.passGap * 1.45 &&
        currentAhead.speed < targetSpeed * 0.985);
    if (state.laneCooldownMs <= 0 && overtakePressure) {
      const preferredDirection =
        state.model.laneBias < -0.15 ? -1 : state.model.laneBias > 0.15 ? 1 : 0;
      const candidateOrder =
        preferredDirection < 0
          ? [state.lane - 1, state.lane + 1]
          : preferredDirection > 0
            ? [state.lane + 1, state.lane - 1]
            : [state.lane - 1, state.lane + 1];
      let bestLane: number | undefined;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (const candidateLane of candidateOrder) {
        if (candidateLane < -maxLane || candidateLane > maxLane) {
          continue;
        }
        const candidateTraffic = laneTrafficByLane.get(candidateLane);
        const candidateAhead = candidateTraffic?.ahead.get(state.model.id);
        const candidateBehind = candidateTraffic?.behind.get(state.model.id);
        const candidateAheadGap = candidateAhead
          ? candidateAhead.progressGap
          : Number.POSITIVE_INFINITY;
        const candidateBehindGap = candidateBehind
          ? candidateBehind.progressGap
          : Number.POSITIVE_INFINITY;
        const candidateAheadSpeed = candidateAhead?.speed ?? targetSpeed;
        const gainVsCurrent = candidateAheadGap - Math.min(currentGap, preset.passGap * 1.2);
        const requiredRearGap = preset.followGap * 0.62;
        const requiredAheadGap = preset.passGap * 0.8;
        if (candidateBehindGap < requiredRearGap || candidateAheadGap < requiredAheadGap) {
          continue;
        }

        const score =
          gainVsCurrent * 28 +
          (candidateAheadSpeed - (currentAhead?.speed ?? targetSpeed * 0.96)) * 8 +
          (preferredDirection !== 0 && Math.sign(candidateLane - state.lane) === preferredDirection
            ? 0.35
            : 0) +
          Math.abs(candidateLane - state.lane) * 0.08;
        if (score > bestScore) {
          bestScore = score;
          bestLane = candidateLane;
        }
      }

      if (bestLane !== undefined && bestScore > 0.18) {
        state.targetLane = bestLane;
        state.laneCooldownMs = preset.laneChangeCooldownMs;
      }
    }

    if (state.targetLane === state.lane && currentAhead) {
      const followRatio = clamp01(currentAhead.progressGap / preset.followGap);
      targetSpeed = Math.min(targetSpeed, currentAhead.speed * (0.84 + followRatio * 0.16));
    }

    state.speed += (targetSpeed - state.speed) * Math.min(1, dtSec * 4.2);
    state.progress = clamp01(state.progress + state.speed * dtRace);

    const laneTarget = laneToNormalizedOffset(state.targetLane, maxLane);
    const nearestGap = nearestGapById.get(state.model.id) ?? Number.POSITIVE_INFINITY;
    const localTrafficFactor = 1 - smoothstep(clamp01((nearestGap - 0.012) / 0.05));
    const weaveScale = 0.16 + localTrafficFactor * 0.84;
    const weave =
      Math.sin(raceProgress * TAU * 0.85 + state.model.weavePhase) *
      0.05 *
      preset.weaveAmplitude *
      weaveScale *
      (0.55 + launchBlend * 0.45);
    const lateralTarget = laneTarget + weave * (state.targetLane === state.lane ? 1 : 0.35);
    state.lateralOffset += clamp(
      -preset.laneChangeRate * dtSec,
      preset.laneChangeRate * dtSec,
      lateralTarget - state.lateralOffset
    );
    state.lateralOffset = clamp(-1, 1, state.lateralOffset);

    if (Math.abs(state.lateralOffset - laneTarget) < 0.035) {
      state.lane = state.targetLane;
    }
  }
}

function buildNearestProgressGapById(states: RuntimeTrafficState[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const state of states) {
    let minGap = Number.POSITIVE_INFINITY;
    for (const other of states) {
      if (other.model.id === state.model.id) continue;
      minGap = Math.min(minGap, Math.abs(other.progress - state.progress));
    }
    result.set(state.model.id, minGap);
  }
  return result;
}

function buildLaneTrafficByLane(
  states: RuntimeTrafficState[]
): Map<
  number,
  {
    ahead: Map<string, { progressGap: number; speed: number }>;
    behind: Map<string, { progressGap: number; speed: number }>;
  }
> {
  const lanes = new Map<number, RuntimeTrafficState[]>();
  for (const state of states) {
    const laneStates = lanes.get(state.lane);
    if (laneStates) {
      laneStates.push(state);
    } else {
      lanes.set(state.lane, [state]);
    }
  }

  const result = new Map<
    number,
    {
      ahead: Map<string, { progressGap: number; speed: number }>;
      behind: Map<string, { progressGap: number; speed: number }>;
    }
  >();
  for (const [lane, laneStates] of lanes) {
    const sorted = [...laneStates].sort((a, b) => b.progress - a.progress);
    const aheadLookup = new Map<string, { progressGap: number; speed: number }>();
    const behindLookup = new Map<string, { progressGap: number; speed: number }>();
    for (let index = 1; index < sorted.length; index += 1) {
      const current = sorted[index];
      const ahead = sorted[index - 1];
      if (!current || !ahead) continue;
      aheadLookup.set(current.model.id, {
        progressGap: Math.max(0, ahead.progress - current.progress),
        speed: ahead.speed
      });
      behindLookup.set(ahead.model.id, {
        progressGap: Math.max(0, ahead.progress - current.progress),
        speed: current.speed
      });
    }
    result.set(lane, { ahead: aheadLookup, behind: behindLookup });
  }

  return result;
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(0, 1, value);
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function resolveRuntimeGridColumns(racerCount: number): number {
  if (racerCount <= 6) return 2;
  if (racerCount <= 15) return 3;
  return 4;
}

function resolveRuntimeTrafficLaneCount(racerCount: number): number {
  if (racerCount <= 8) return 3;
  return 5;
}

function laneToNormalizedOffset(lane: number, maxLane: number): number {
  if (maxLane <= 0) return 0;
  return clamp(-1, 1, lane / maxLane);
}

function hashToUnit(index: number, factor: number, raceSeed = 0): number {
  const factorSalt = Math.floor(factor * 1_000_000) >>> 0;
  let hash = (index * 374761393) >>> 0;
  hash ^= (factorSalt * 668265263) >>> 0;
  hash ^= ((raceSeed + 1) * 2246822519) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 1274126177) >>> 0;
  hash ^= hash >>> 16;
  return hash / 4294967295;
}
