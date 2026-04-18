/**
 * File: tests/replay-utils.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies replay demo data produces live placement changes instead of static index ordering.
 * Usage: Runs in Vitest as part of the regular test suite.
 */

import { describe, expect, it } from 'vitest';
import { buildDemoRecordedRaceData, sampleReplayAtTime } from '../apps/web-viewer/src/replay-utils';

describe('replay utils', () => {
  it('produces shifting top-pack placement over time in demo replay data', () => {
    const racerIds = Array.from({ length: 40 }, (_, i) => `duck-${i + 1}`);
    const data = buildDemoRecordedRaceData(racerIds, 40_000, 200);

    const at20 = sampleReplayAtTime(data, 8_000);
    const at50 = sampleReplayAtTime(data, 20_000);
    const at80 = sampleReplayAtTime(data, 32_000);

    const top8Signature = (frame: ReturnType<typeof sampleReplayAtTime>) =>
      [...frame.racers]
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 8)
        .map((r) => r.id)
        .join(',');

    const signatures = new Set([top8Signature(at20), top8Signature(at50), top8Signature(at80)]);
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('does not keep leaderboard top pack in strict descending racer-number order', () => {
    const racerIds = Array.from({ length: 30 }, (_, i) => `duck-${i + 1}`);
    const data = buildDemoRecordedRaceData(racerIds, 36_000, 200);

    const mid = sampleReplayAtTime(data, 18_000);
    const top10 = [...mid.racers]
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 10)
      .map((r) => Number(r.id.replace('duck-', '')));

    const descendingByNumber = [...top10].sort((a, b) => b - a);
    expect(top10).not.toEqual(descendingByNumber);
  });
});
