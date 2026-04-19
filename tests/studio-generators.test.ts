/**
 * File: tests/studio-generators.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies track template auto-generation helper behavior for studio workflows.
 * Usage: Runs in Vitest as part of editor utility coverage.
 */

import { describe, expect, it } from 'vitest';

import {
  generateRacerVariantDescriptors,
  resolveSafeSpriteSheetOutputScale,
  generateTrackTemplate
} from '../apps/web-viewer/src/studio-generators';

describe('studio generators', () => {
  it('builds bounded control points for each template kind', () => {
    const kinds = ['s-curve', 'oval', 'zigzag', 'river-bend'] as const;

    for (const kind of kinds) {
      const points = generateTrackTemplate({
        kind,
        controlPointCount: 12,
        width: 1160,
        height: 720,
        margin: 80
      });

      expect(points.length).toBe(12);
      for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(80);
        expect(point.x).toBeLessThanOrEqual(1080);
        expect(point.y).toBeGreaterThanOrEqual(80);
        expect(point.y).toBeLessThanOrEqual(640);
      }
    }
  });

  it('enforces minimum control point count', () => {
    const points = generateTrackTemplate({
      kind: 's-curve',
      controlPointCount: 1,
      width: 500,
      height: 300
    });

    expect(points.length).toBeGreaterThanOrEqual(3);
  });

  it('produces deterministic racer variants with tint + pattern diversity', () => {
    const variants = generateRacerVariantDescriptors(12);

    expect(variants.length).toBe(12);
    expect(new Set(variants.map((variant) => variant.racerId)).size).toBe(12);
    expect(new Set(variants.map((variant) => variant.tintHex)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(variants.map((variant) => variant.pattern)).size).toBeGreaterThanOrEqual(4);
  });

  it('downscales output scale to fit canvas limits for heavy max-contrast sheets', () => {
    const scale = resolveSafeSpriteSheetOutputScale({
      sourceWidth: 4096,
      sourceHeight: 4096,
      requestedOutputScale: 1,
      padding: 10,
      frameCount: 16,
      variantCount: 24
    });

    expect(scale).toBeGreaterThan(0.04);
    expect(scale).toBeLessThan(1);
  });
});
