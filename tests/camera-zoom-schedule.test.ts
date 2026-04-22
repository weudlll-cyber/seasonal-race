/**
 * File: tests/camera-zoom-schedule.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies runtime-based default zoom pulse bucket selection.
 * Usage: Run with the regular Vitest suite.
 * Dependencies: vitest, web-viewer camera helper export.
 */

import { describe, expect, it } from 'vitest';
import {
  applyFocusAwareZoom,
  defaultZoomPulseCountForExpectedDuration,
  resolveCameraAnchorPoint,
  resolveCameraFocusGap
} from '../apps/web-viewer/src/camera';

describe('camera zoom pulse defaults', () => {
  it('uses 1 pulse for short races up to 30s', () => {
    expect(defaultZoomPulseCountForExpectedDuration(20)).toBe(1);
    expect(defaultZoomPulseCountForExpectedDuration(30)).toBe(1);
  });

  it('uses 2 pulses for races up to 60s', () => {
    expect(defaultZoomPulseCountForExpectedDuration(45)).toBe(2);
    expect(defaultZoomPulseCountForExpectedDuration(60)).toBe(2);
  });

  it('uses 3 pulses for races up to 120s', () => {
    expect(defaultZoomPulseCountForExpectedDuration(90)).toBe(3);
    expect(defaultZoomPulseCountForExpectedDuration(120)).toBe(3);
  });

  it('uses 4 pulses for long races above 120s', () => {
    expect(defaultZoomPulseCountForExpectedDuration(150)).toBe(4);
  });

  it('blends the camera anchor toward a focus racer when provided', () => {
    const leader = { progress: 0.82, position: { x: 800, y: 220 } };
    const focus = { progress: 0.64, position: { x: 620, y: 310 } };

    const anchor = resolveCameraAnchorPoint(leader, focus, 0.4);
    expect(anchor.x).toBeCloseTo(728, 5);
    expect(anchor.y).toBeCloseTo(256, 5);
  });

  it('returns zero focus gap and unchanged anchor without focus racer', () => {
    const leader = { progress: 0.73, position: { x: 410, y: 280 } };

    expect(resolveCameraFocusGap(leader)).toBe(0);
    expect(resolveCameraAnchorPoint(leader)).toEqual({ x: 410, y: 280 });
  });

  it('slightly widens zoom when the focus racer trails the leader', () => {
    expect(
      resolveCameraFocusGap(
        { progress: 0.9, position: { x: 0, y: 0 } },
        { progress: 0.5, position: { x: 0, y: 0 } }
      )
    ).toBeCloseTo(0.4, 5);
    expect(applyFocusAwareZoom(1.9, 0.4)).toBeLessThan(1.9);
    expect(applyFocusAwareZoom(1.3, 0)).toBe(1.3);
  });
});
