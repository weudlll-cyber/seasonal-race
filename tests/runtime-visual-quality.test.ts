/**
 * File: tests/runtime-visual-quality.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for runtime visual quality and adaptive budget resolution.
 * Usage: Runs in Vitest as part of runtime performance-policy coverage.
 */

import { describe, expect, it } from 'vitest';

import {
  resolveRuntimeVisualBudget,
  resolveRuntimeVisualQuality
} from '../apps/web-viewer/src/runtime-visual-quality';

describe('runtime visual quality', () => {
  it('resolves explicit quality values and defaults unknown to auto', () => {
    expect(resolveRuntimeVisualQuality('low')).toBe('low');
    expect(resolveRuntimeVisualQuality('medium')).toBe('medium');
    expect(resolveRuntimeVisualQuality('high')).toBe('high');
    expect(resolveRuntimeVisualQuality('auto')).toBe('auto');
    expect(resolveRuntimeVisualQuality('invalid')).toBe('auto');
    expect(resolveRuntimeVisualQuality(null)).toBe('auto');
  });

  it('uses high-quality budget when auto has low load', () => {
    const budget = resolveRuntimeVisualBudget({ quality: 'auto', racerCount: 12, frameMs: 16.5 });

    expect(budget.qualityResolved).toBe('high');
    expect(budget.waveSegments).toBeGreaterThanOrEqual(20);
    expect(budget.effectIntensityScale).toBeGreaterThan(0.85);
  });

  it('degrades auto budget under heavy load and high racer count', () => {
    const budget = resolveRuntimeVisualBudget({ quality: 'auto', racerCount: 96, frameMs: 33 });

    expect(budget.qualityResolved).toBe('low');
    expect(budget.waveSegments).toBeLessThanOrEqual(10);
    expect(budget.maxWakeStreaks).toBeLessThan(400);
    expect(budget.effectIntensityScale).toBeLessThan(0.8);
  });

  it('keeps low quality budgets below high quality for same load', () => {
    const low = resolveRuntimeVisualBudget({ quality: 'low', racerCount: 36, frameMs: 18 });
    const high = resolveRuntimeVisualBudget({ quality: 'high', racerCount: 36, frameMs: 18 });

    expect(low.qualityResolved).toBe('low');
    expect(high.qualityResolved).toBe('high');
    expect(low.waveSegments).toBeLessThan(high.waveSegments);
    expect(low.maxRippleSeeds).toBeLessThan(high.maxRippleSeeds);
    expect(low.maxWakeStreaks).toBeLessThan(high.maxWakeStreaks);
  });
});
