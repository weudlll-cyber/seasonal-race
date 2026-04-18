/**
 * File: tests/replay-visual-policy.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies reusable replay visual policy helpers for editor and runtime race views.
 * Usage: Runs in Vitest as part of the regular test suite.
 * Dependencies: replay-visual-policy helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  buildReplayPackLayout,
  buildReplayVisualSnapshot,
  createRacerIds,
  normalizeFocusRacerNumber,
  toNameDisplayMode,
  type ReplayVisualRacerState
} from '../apps/web-viewer/src/replay-visual-policy';

describe('replay visual policy', () => {
  it('normalizes invalid name display modes', () => {
    expect(toNameDisplayMode('all')).toBe('all');
    expect(toNameDisplayMode('invalid-mode')).toBe('leaders-focus');
  });

  it('clamps focus racer to available racer count', () => {
    expect(normalizeFocusRacerNumber(0, 12)).toBe(1);
    expect(normalizeFocusRacerNumber(99, 12)).toBe(12);
    expect(normalizeFocusRacerNumber(5.9, 12)).toBe(5);
  });

  it('creates stable racer ids in configured range', () => {
    expect(createRacerIds(1)).toEqual(['duck-1', 'duck-2']);
    expect(createRacerIds(4)).toEqual(['duck-1', 'duck-2', 'duck-3', 'duck-4']);
    expect(createRacerIds(140)).toHaveLength(100);
  });

  it('builds dense replay pack layout for high racer counts', () => {
    const layout = buildReplayPackLayout(100, 6);

    expect(layout.columns).toBeGreaterThanOrEqual(4);
    expect(layout.rows).toBeGreaterThan(1);
    expect(layout.rowLagProgress).toBeGreaterThan(0);
    expect(layout.halfWidth).toBeGreaterThan(0);
  });

  it('keeps leaders-focus labels strict top-5 and appends focus row in leaderboard', () => {
    const racers: ReplayVisualRacerState[] = [
      { id: 'duck-1', index: 0, progress: 0.95, hovered: false, visible: true },
      { id: 'duck-2', index: 1, progress: 0.9, hovered: false, visible: true },
      { id: 'duck-3', index: 2, progress: 0.85, hovered: false, visible: true },
      { id: 'duck-4', index: 3, progress: 0.8, hovered: false, visible: true },
      { id: 'duck-5', index: 4, progress: 0.75, hovered: false, visible: true },
      { id: 'duck-6', index: 5, progress: 0.7, hovered: false, visible: true },
      { id: 'duck-7', index: 6, progress: 0.65, hovered: false, visible: true },
      { id: 'duck-8', index: 7, progress: 0.6, hovered: false, visible: true },
      { id: 'duck-9', index: 8, progress: 0.55, hovered: false, visible: true },
      { id: 'duck-10', index: 9, progress: 0.5, hovered: false, visible: true },
      { id: 'duck-11', index: 10, progress: 0.45, hovered: false, visible: true },
      { id: 'duck-12', index: 11, progress: 0.4, hovered: false, visible: true },
      { id: 'duck-13', index: 12, progress: 0.2, hovered: false, visible: true }
    ];

    const snapshot = buildReplayVisualSnapshot(racers, 'leaders-focus', 13, 12);
    const focusDecision = snapshot.labelDecisions.find((decision) => decision.id === 'duck-13');

    expect(focusDecision?.showLabel).toBe(false);
    expect(focusDecision?.isFocus).toBe(true);
    expect(snapshot.leaderboardRows[snapshot.leaderboardRows.length - 2]?.kind).toBe('separator');
    expect(snapshot.leaderboardRows[snapshot.leaderboardRows.length - 1]).toMatchObject({
      kind: 'racer',
      isFocus: true,
      place: 13,
      racerIndex: 12
    });
  });

  it('shows only hovered racer in hover mode when no focus match exists', () => {
    const racers: ReplayVisualRacerState[] = [
      { id: 'duck-1', index: 0, progress: 0.7, hovered: false, visible: true },
      { id: 'duck-2', index: 1, progress: 0.5, hovered: true, visible: true }
    ];

    const snapshot = buildReplayVisualSnapshot(racers, 'hover', 99, 10);
    const duck1 = snapshot.labelDecisions.find((decision) => decision.id === 'duck-1');
    const duck2 = snapshot.labelDecisions.find((decision) => decision.id === 'duck-2');

    expect(duck1?.showLabel).toBe(false);
    expect(duck2?.showLabel).toBe(true);
  });

  it('keeps leaderboard percentage clamped while rankScore controls ordering', () => {
    const racers: ReplayVisualRacerState[] = [
      {
        id: 'duck-1',
        index: 0,
        progress: 1,
        rankScore: 1.7,
        displayProgress: 1,
        hovered: false,
        visible: true
      },
      {
        id: 'duck-2',
        index: 1,
        progress: 1,
        rankScore: 1.6,
        displayProgress: 2.4,
        hovered: false,
        visible: true
      }
    ];

    const snapshot = buildReplayVisualSnapshot(racers, 'leaders-focus', 1, 2);
    expect(snapshot.leaderboardRows[0]).toMatchObject({
      kind: 'racer',
      racerIndex: 0,
      progressPercent: 100
    });
    expect(snapshot.leaderboardRows[1]).toMatchObject({
      kind: 'racer',
      racerIndex: 1,
      progressPercent: 100
    });
  });
});
