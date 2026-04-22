/**
 * File: apps/web-viewer/src/runtime-hud.ts
 * Model: GPT-5.3-Codex
 * Purpose: Runtime HUD helpers for top-pack leaderboard and optional focus-racer selection.
 * Usage: Consumed by runtime-app ticker without Pixi dependencies.
 */

export interface RuntimeRacerFrameSnapshot {
  progress: number;
  speedNorm: number;
}

export interface RuntimeLeaderboardEntry {
  racerIndex: number;
  rank: number;
  progress: number;
  speedNorm: number;
  gapToLeader: number;
}

export function resolveRuntimeFocusRacer(
  queryValue: string | null,
  racerCount: number
): number | null {
  if (!queryValue) {
    return null;
  }

  const parsed = Number.parseInt(queryValue, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const racerNumber = Math.max(1, Math.min(racerCount, parsed));
  return racerNumber - 1;
}

export function buildRuntimeLeaderboard(
  frames: RuntimeRacerFrameSnapshot[],
  maxEntries = 3
): RuntimeLeaderboardEntry[] {
  if (!frames.length || maxEntries <= 0) {
    return [];
  }

  const sorted = frames
    .map((frame, racerIndex) => ({
      racerIndex,
      progress: clamp01(frame.progress),
      speedNorm: clamp01(frame.speedNorm)
    }))
    .sort((left, right) => {
      if (right.progress !== left.progress) {
        return right.progress - left.progress;
      }
      return right.speedNorm - left.speedNorm;
    });

  const leader = sorted[0];
  if (!leader) {
    return [];
  }

  const cappedCount = Math.min(maxEntries, sorted.length);
  const entries: RuntimeLeaderboardEntry[] = [];
  for (let index = 0; index < cappedCount; index += 1) {
    const racer = sorted[index];
    if (!racer) {
      continue;
    }

    entries.push({
      racerIndex: racer.racerIndex,
      rank: index + 1,
      progress: racer.progress,
      speedNorm: racer.speedNorm,
      gapToLeader: index === 0 ? 0 : Math.max(0, leader.progress - racer.progress)
    });
  }

  return entries;
}

export function resolveRuntimeRacerRank(
  frames: RuntimeRacerFrameSnapshot[],
  racerIndex: number
): number | null {
  if (!frames.length || racerIndex < 0 || racerIndex >= frames.length) {
    return null;
  }

  const sortedIndices = frames
    .map((frame, index) => ({
      index,
      progress: clamp01(frame.progress),
      speedNorm: clamp01(frame.speedNorm)
    }))
    .sort((left, right) => {
      if (right.progress !== left.progress) {
        return right.progress - left.progress;
      }
      return right.speedNorm - left.speedNorm;
    })
    .map((entry) => entry.index);

  const rank = sortedIndices.indexOf(racerIndex);
  return rank >= 0 ? rank + 1 : null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
