/**
 * File: tests/camera-zoom-schedule.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies runtime-based default zoom pulse bucket selection.
 * Usage: Run with the regular Vitest suite.
 * Dependencies: vitest, web-viewer camera helper export.
 */

import { describe, expect, it } from 'vitest';
import { defaultZoomPulseCountForExpectedDuration } from '../apps/web-viewer/src/camera';

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
});
