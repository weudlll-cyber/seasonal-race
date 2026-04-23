/**
 * File: tests/runtime-track-sweep.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Diagnostics sweep across all content tracks for runtime race behavior quality.
 * Usage: Prints per-track metrics for overlap, ranking movement, and winner diversity.
 */

import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  buildRuntimeAutoRacerFrame,
  createRuntimeAutoRacerModels,
  type RuntimeAutoRacerFrame,
  type RuntimeRacerBehaviorPreset
} from '../apps/web-viewer/src/runtime-racer-simulation';
import {
  mapRuntimeTrackPointsToViewport,
  sampleRuntimeTrackPosition
} from '../apps/web-viewer/src/runtime-track';
import {
  resolveRuntimeRenderMinimumSeparation,
  resolveRuntimeSeparationDisplacementCap
} from '../apps/web-viewer/src/runtime-layout';

interface TrackPoint {
  x: number;
  y: number;
}

interface TrackManifestEntry {
  id: string;
  displayName: string;
  raceType: string;
  file: string;
}

interface TrackManifest {
  version: number;
  tracks: TrackManifestEntry[];
}

interface TrackFile {
  id: string;
  name: string;
  points: TrackPoint[];
}

interface SweepRow {
  trackId: string;
  scenarios: number;
  overlapRate: number;
  rankChangeRate: number;
  leadChangeRate: number;
  distinctWinners: number;
  score: number;
  status: 'OK' | 'WARN' | 'FAIL';
}

const VIEW_WIDTH = 1160;
const VIEW_HEIGHT = 720;

interface SweepConfig {
  profileName: string;
  durationMs: number;
  sampleStepMs: number;
  behaviors: RuntimeRacerBehaviorPreset[];
  racerCounts: number[];
  seeds: number[];
}

const QUICK_SWEEP_CONFIG: SweepConfig = {
  profileName: 'quick',
  durationMs: 42_000,
  sampleStepMs: 2_000,
  behaviors: ['balanced', 'chaotic'],
  racerCounts: [12, 24],
  seeds: [11, 29, 73]
};

const ROBUST_SWEEP_CONFIG: SweepConfig = {
  profileName: 'robust',
  durationMs: 48_000,
  sampleStepMs: 2_000,
  behaviors: ['arcade', 'balanced', 'chaotic'],
  racerCounts: [12, 24, 36],
  seeds: [11, 29, 73, 101, 211]
};

const RACER_100_SWEEP_CONFIG: SweepConfig = {
  profileName: 'racer100',
  durationMs: 42_000,
  sampleStepMs: 2_000,
  behaviors: ['balanced', 'chaotic'],
  racerCounts: [100],
  seeds: [11, 29, 73]
};

function resolveSweepConfig(): SweepConfig {
  const profile = (process.env.SEASONAL_RACE_SWEEP_PROFILE ?? '').trim().toLowerCase();
  if (profile === 'quick') {
    return QUICK_SWEEP_CONFIG;
  }
  if (profile === '100' || profile === 'racer100' || profile === 'stress100') {
    return RACER_100_SWEEP_CONFIG;
  }
  return ROBUST_SWEEP_CONFIG;
}

describe('runtime track sweep diagnostics', () => {
  it('runs all manifest tracks and prints behavior metrics', async () => {
    const sweepConfig = resolveSweepConfig();
    const tracks = await loadManifestTracks();
    const rows: SweepRow[] = [];

    const scenarioCountPerTrack =
      sweepConfig.behaviors.length * sweepConfig.racerCounts.length * sweepConfig.seeds.length;
    console.log('Sweep profile configuration:');
    console.table([
      {
        profile: sweepConfig.profileName,
        durationMs: sweepConfig.durationMs,
        sampleStepMs: sweepConfig.sampleStepMs,
        behaviors: sweepConfig.behaviors.join(','),
        racerCounts: sweepConfig.racerCounts.join(','),
        seeds: sweepConfig.seeds.join(','),
        scenarioCountPerTrack
      }
    ]);

    for (const track of tracks) {
      const mappedTrack = mapRuntimeTrackPointsToViewport(track.points, VIEW_WIDTH, VIEW_HEIGHT);
      const winners = new Set<number>();
      let scenarioCount = 0;
      let overlapPairs = 0;
      let totalPairs = 0;
      let rankChangeEvents = 0;
      let totalRankChecks = 0;
      let leadChangeEvents = 0;
      let totalLeadChecks = 0;

      for (const behavior of sweepConfig.behaviors) {
        for (const racerCount of sweepConfig.racerCounts) {
          for (const seedBase of sweepConfig.seeds) {
            const raceSeed = hashStringToSeed(`${track.id}|${behavior}|${racerCount}|${seedBase}`);
            const models = createRuntimeAutoRacerModels(racerCount, {
              behaviorPreset: behavior,
              raceSeed
            });
            let previousRanks = new Map<string, number>();
            let previousLeaderId = '';

            for (
              let elapsedMs = 0;
              elapsedMs <= sweepConfig.durationMs;
              elapsedMs += sweepConfig.sampleStepMs
            ) {
              const frames = buildRuntimeAutoRacerFrame(models, elapsedMs, sweepConfig.durationMs, {
                behaviorPreset: behavior,
                raceSeed
              });
              const positions = resolveFramePositions(frames, mappedTrack);

              const sorted = [...frames].sort((a, b) => b.progress - a.progress);
              const rankMap = new Map(sorted.map((frame, rank) => [frame.id, rank]));
              if (previousRanks.size > 0) {
                for (const frame of frames) {
                  const oldRank = previousRanks.get(frame.id);
                  const newRank = rankMap.get(frame.id);
                  if (oldRank === undefined || newRank === undefined) continue;
                  totalRankChecks += 1;
                  if (Math.abs(newRank - oldRank) >= 1) {
                    rankChangeEvents += 1;
                  }
                }
              }
              previousRanks = rankMap;

              const leader = sorted[0];
              if (leader) {
                if (previousLeaderId.length > 0) {
                  totalLeadChecks += 1;
                  if (leader.id !== previousLeaderId) {
                    leadChangeEvents += 1;
                  }
                }
                previousLeaderId = leader.id;
              }

              const overlap = computeOverlapStats(positions);
              overlapPairs += overlap.overlapPairs;
              totalPairs += overlap.totalPairs;
            }

            const finalFrames = buildRuntimeAutoRacerFrame(
              models,
              sweepConfig.durationMs,
              sweepConfig.durationMs,
              {
                behaviorPreset: behavior,
                raceSeed
              }
            );
            const winner = [...finalFrames].sort((a, b) => b.progress - a.progress)[0];
            if (winner) {
              winners.add(winner.index);
            }
            scenarioCount += 1;
          }
        }
      }

      const overlapRate = totalPairs > 0 ? overlapPairs / totalPairs : 0;
      const rankChangeRate = totalRankChecks > 0 ? rankChangeEvents / totalRankChecks : 0;
      const leadChangeRate = totalLeadChecks > 0 ? leadChangeEvents / totalLeadChecks : 0;
      const distinctWinners = winners.size;
      const score = computeTrackScore({
        overlapRate,
        rankChangeRate,
        leadChangeRate,
        distinctWinners
      });
      const status = classifyTrackStatus({
        profileName: sweepConfig.profileName,
        overlapRate,
        rankChangeRate,
        leadChangeRate,
        distinctWinners
      });

      rows.push({
        trackId: track.id,
        scenarios: scenarioCount,
        overlapRate,
        rankChangeRate,
        leadChangeRate,
        distinctWinners,
        score,
        status
      });
    }

    const sortableRows = [...rows].sort((a, b) => a.score - b.score);
    const printableRows = sortableRows.map((row) => ({
      track: row.trackId,
      status: row.status,
      score: row.score.toFixed(2),
      scenarios: row.scenarios,
      overlapRate: row.overlapRate.toFixed(4),
      rankChangeRate: row.rankChangeRate.toFixed(4),
      leadChangeRate: row.leadChangeRate.toFixed(4),
      distinctWinners: row.distinctWinners
    }));

    console.table(printableRows);

    const topRows = sortableRows.slice(0, Math.min(2, sortableRows.length)).map((row) => ({
      track: row.trackId,
      status: row.status,
      score: row.score.toFixed(2)
    }));
    const flopRows = sortableRows
      .slice(Math.max(0, sortableRows.length - 2))
      .reverse()
      .map((row) => ({
        track: row.trackId,
        status: row.status,
        score: row.score.toFixed(2)
      }));

    console.log('Top tracks (lowest risk score):');
    console.table(topRows);
    console.log('Flop tracks (highest risk score):');
    console.table(flopRows);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.overlapRate).toBeLessThan(0.25);
      expect(row.rankChangeRate).toBeGreaterThan(0);
      expect(row.distinctWinners).toBeGreaterThanOrEqual(3);
    }
  }, 120_000);
});

async function loadManifestTracks(): Promise<TrackFile[]> {
  const root = process.cwd();
  const manifestPath = path.join(root, 'content', 'manifests', 'tracks.manifest.json');
  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw) as TrackManifest;

  const tracks: TrackFile[] = [];
  for (const entry of manifest.tracks) {
    const trackPath = path.join(root, 'content', 'tracks', entry.file);
    const trackRaw = await readFile(trackPath, 'utf-8');
    const track = JSON.parse(trackRaw) as TrackFile;
    tracks.push(track);
  }

  return tracks;
}

function computeTrackScore(input: {
  overlapRate: number;
  rankChangeRate: number;
  leadChangeRate: number;
  distinctWinners: number;
}): number {
  const overlapPenalty = input.overlapRate * 120;
  const rankPenalty = Math.max(0, 0.11 - input.rankChangeRate) * 80;
  const leadPenalty = Math.max(0, 0.055 - input.leadChangeRate) * 60;
  const winnerPenalty = Math.max(0, 7 - input.distinctWinners) * 6;
  return overlapPenalty + rankPenalty + leadPenalty + winnerPenalty;
}

function classifyTrackStatus(input: {
  profileName: string;
  overlapRate: number;
  rankChangeRate: number;
  leadChangeRate: number;
  distinctWinners: number;
}): 'OK' | 'WARN' | 'FAIL' {
  const thresholds = resolveSweepStatusThresholds(input.profileName);

  if (
    input.overlapRate >= thresholds.fail.overlapRate ||
    input.rankChangeRate < thresholds.fail.rankChangeRate ||
    input.leadChangeRate < thresholds.fail.leadChangeRate ||
    input.distinctWinners < thresholds.fail.distinctWinners
  ) {
    return 'FAIL';
  }
  if (
    input.overlapRate >= thresholds.warn.overlapRate ||
    input.rankChangeRate < thresholds.warn.rankChangeRate ||
    input.leadChangeRate < thresholds.warn.leadChangeRate ||
    input.distinctWinners < thresholds.warn.distinctWinners
  ) {
    return 'WARN';
  }
  return 'OK';
}

function resolveSweepStatusThresholds(profileName: string): {
  warn: {
    overlapRate: number;
    rankChangeRate: number;
    leadChangeRate: number;
    distinctWinners: number;
  };
  fail: {
    overlapRate: number;
    rankChangeRate: number;
    leadChangeRate: number;
    distinctWinners: number;
  };
} {
  if (profileName === 'racer100') {
    return {
      warn: {
        overlapRate: 0.055,
        rankChangeRate: 0.16,
        leadChangeRate: 0.08,
        distinctWinners: 5
      },
      fail: {
        overlapRate: 0.075,
        rankChangeRate: 0.12,
        leadChangeRate: 0.055,
        distinctWinners: 4
      }
    };
  }

  return {
    warn: {
      overlapRate: 0.04,
      rankChangeRate: 0.12,
      leadChangeRate: 0.06,
      distinctWinners: 7
    },
    fail: {
      overlapRate: 0.06,
      rankChangeRate: 0.09,
      leadChangeRate: 0.04,
      distinctWinners: 5
    }
  };
}

function resolveFramePositions(frames: RuntimeAutoRacerFrame[], trackPoints: TrackPoint[]) {
  const baseScale = resolveRuntimeSpriteBaseScale(frames.length);
  const laneSpread = resolveRuntimeLaneSpread(baseScale, frames.length);

  const projected = frames.map((frame) => {
    const center = sampleRuntimeTrackPosition(trackPoints, frame.progress);
    const ahead = sampleRuntimeTrackPosition(trackPoints, Math.min(1, frame.progress + 0.0025));
    const tangentXRaw = ahead.x - center.x;
    const tangentYRaw = ahead.y - center.y;
    const tangentLen = Math.hypot(tangentXRaw, tangentYRaw) || 1;
    const tangentX = tangentXRaw / tangentLen;
    const tangentY = tangentYRaw / tangentLen;
    const normalX = -tangentY;
    const normalY = tangentX;
    const laneBias = resolveRuntimeLaneBias(frame.index, frames.length);
    const lateralMix = clamp(-1, 1, frame.lateralOffset * 0.62 + laneBias * 0.38);

    return {
      id: frame.id,
      x: center.x + normalX * lateralMix * laneSpread,
      y: center.y + normalY * lateralMix * laneSpread
    };
  });

  const separated = resolveRuntimeRenderMinimumSeparation(
    projected.map((item) => ({
      ...item,
      anchorX: item.x,
      anchorY: item.y,
      maxDisplacementPx: resolveRuntimeSeparationDisplacementCap(frames.length, baseScale)
    })),
    baseScale
  );

  return projected.map((item) => {
    const pos = separated.get(item.id);
    return {
      id: item.id,
      x: pos?.x ?? item.x,
      y: pos?.y ?? item.y
    };
  });
}

function computeOverlapStats(positions: Array<{ id: string; x: number; y: number }>) {
  let overlapPairs = 0;
  let totalPairs = 0;
  const minDistance = 10;

  for (let i = 0; i < positions.length; i += 1) {
    const a = positions[i];
    if (!a) continue;
    for (let j = i + 1; j < positions.length; j += 1) {
      const b = positions[j];
      if (!b) continue;
      totalPairs += 1;
      if (Math.hypot(a.x - b.x, a.y - b.y) < minDistance) {
        overlapPairs += 1;
      }
    }
  }

  return { overlapPairs, totalPairs };
}

function resolveRuntimeSpriteBaseScale(racerCount: number): number {
  if (racerCount <= 8) return 1.28;
  if (racerCount <= 16) return 0.98;
  if (racerCount <= 28) return 0.86;
  if (racerCount <= 45) return 0.8;
  if (racerCount <= 70) return 0.68;
  if (racerCount <= 100) return 0.58;
  return 0.52;
}

function resolveRuntimeLaneBias(racerIndex: number, totalRacers: number): number {
  if (totalRacers <= 1) return 0;
  const slot = (racerIndex * 7) % totalRacers;
  return (slot / Math.max(1, totalRacers - 1)) * 2 - 1;
}

function resolveRuntimeLaneSpread(spriteBaseScale: number, racerCount: number): number {
  const baseLaneSpread = 24 + spriteBaseScale * 22;
  const densityBlend = clamp(0, 1, (racerCount - 48) / 52);
  return baseLaneSpread * (1 + densityBlend * 0.24);
}

function hashStringToSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}
