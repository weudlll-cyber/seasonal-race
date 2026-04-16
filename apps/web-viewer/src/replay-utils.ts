/**
 * File: apps/web-viewer/src/replay-utils.ts
 * Model: GPT-5.3-Codex
 * Purpose: Build and sample deterministic recorded-race style replay data.
 * Usage: Used by the track editor to preview how a real race might look on a custom track.
 * Dependencies: None.
 */

export interface RecordedRacerFrame {
  id: string;
  progress: number;
}

export interface RecordedRaceFrame {
  timeMs: number;
  finished: boolean;
  racers: RecordedRacerFrame[];
}

export interface RecordedRaceData {
  durationMs: number;
  frames: RecordedRaceFrame[];
}

/**
 * Creates deterministic pseudo-recorded race data with slight per-racer behavior variance.
 */
export function buildDemoRecordedRaceData(
  racerIds: string[],
  durationMs = 42_000,
  stepMs = 200
): RecordedRaceData {
  const safeDuration = Math.max(5_000, durationMs);
  const safeStep = Math.max(50, stepMs);
  const durationSec = safeDuration / 1000;

  const progressById = new Map<string, number>();
  for (const id of racerIds) progressById.set(id, 0);

  const frames: RecordedRaceFrame[] = [];
  for (let timeMs = 0; timeMs <= safeDuration; timeMs += safeStep) {
    const t = timeMs / 1000;
    const denom = Math.max(1, racerIds.length - 1);

    for (let i = 0; i < racerIds.length; i += 1) {
      const id = racerIds[i]!;
      const baseSpeed = 1 / durationSec;
      const normalizedIndex = (i / denom) * 2 - 1; // -1..1 regardless of racer count
      const indexBias = normalizedIndex * 0.12;
      const pulse = 0.22 * Math.sin(t * (1.2 + i * 0.15) + i * 0.6);
      const speed = Math.max(0.0001, baseSpeed * (1 + indexBias + pulse));
      const current = progressById.get(id) ?? 0;
      const next = Math.min(1, current + speed * (safeStep / 1000));
      progressById.set(id, next);
    }

    frames.push({
      timeMs,
      finished: timeMs >= safeDuration,
      racers: racerIds.map((id) => ({
        id,
        progress: round4(progressById.get(id) ?? 0)
      }))
    });
  }

  // Guarantee exact finish frame at duration.
  frames.push({
    timeMs: safeDuration,
    finished: true,
    racers: racerIds.map((id) => ({ id, progress: 1 }))
  });

  return {
    durationMs: safeDuration,
    frames: dedupeByTime(frames)
  };
}

/**
 * Samples replay data at arbitrary time by linear interpolation between two frames.
 */
export function sampleReplayAtTime(data: RecordedRaceData, timeMs: number): RecordedRaceFrame {
  if (data.frames.length === 0) {
    return { timeMs: 0, finished: true, racers: [] };
  }

  const clamped = Math.max(0, Math.min(data.durationMs, timeMs));
  const frames = data.frames;

  let rightIndex = frames.findIndex((f) => f.timeMs >= clamped);
  if (rightIndex === -1) rightIndex = frames.length - 1;
  const leftIndex = Math.max(0, rightIndex - 1);

  const left = frames[leftIndex]!;
  const right = frames[rightIndex]!;
  if (left.timeMs === right.timeMs) {
    return {
      timeMs: clamped,
      finished: clamped >= data.durationMs,
      racers: left.racers.map((r) => ({ id: r.id, progress: r.progress }))
    };
  }

  const alpha = (clamped - left.timeMs) / (right.timeMs - left.timeMs);
  const progressById = new Map<string, number>();

  for (const l of left.racers) {
    const r = right.racers.find((x) => x.id === l.id);
    const endProgress = r?.progress ?? l.progress;
    progressById.set(l.id, round4(lerp(l.progress, endProgress, alpha)));
  }

  return {
    timeMs: clamped,
    finished: clamped >= data.durationMs,
    racers: left.racers.map((r) => ({
      id: r.id,
      progress: progressById.get(r.id) ?? r.progress
    }))
  };
}

function dedupeByTime(frames: RecordedRaceFrame[]): RecordedRaceFrame[] {
  const byTime = new Map<number, RecordedRaceFrame>();
  for (const frame of frames) {
    byTime.set(frame.timeMs, frame);
  }

  return [...byTime.values()].sort((a, b) => a.timeMs - b.timeMs);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
