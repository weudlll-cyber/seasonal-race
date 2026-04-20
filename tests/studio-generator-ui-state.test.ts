/**
 * File: tests/studio-generator-ui-state.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies studio generator UI preset and warning-resolution helper behavior.
 * Usage: Runs in Vitest as part of studio UI state regression coverage.
 */

import { describe, expect, it } from 'vitest';

import {
  buildSpriteGenerationWarning,
  resolveGeneratorPresetLabel
} from '../apps/web-viewer/src/studio-generator-ui-state';

describe('studio generator ui state', () => {
  it('resolves known generator preset labels from frame/variant pairs', () => {
    expect(resolveGeneratorPresetLabel(8, 8)).toBe('Minimal');
    expect(resolveGeneratorPresetLabel(10, 12)).toBe('Balanced');
    expect(resolveGeneratorPresetLabel(16, 24)).toBe('Max Contrast');
    expect(resolveGeneratorPresetLabel(9, 8)).toBeNull();
  });

  it('returns guidance text when no source image is loaded', () => {
    const message = buildSpriteGenerationWarning({
      spriteSourceImageDimensions: null,
      frameCountInput: 10,
      variantCountInput: 12
    });

    expect(message).toBe('Select a source image to see generation-size guidance.');
  });

  it('returns fit message for moderate image dimensions', () => {
    const message = buildSpriteGenerationWarning({
      spriteSourceImageDimensions: { width: 512, height: 512 },
      frameCountInput: 10,
      variantCountInput: 12
    });

    expect(message).toContain('Generation fits at 100% scale');
    expect(message).toContain('10 frames x 12 variants');
  });

  it('returns auto-scale message for very large image dimensions', () => {
    const message = buildSpriteGenerationWarning({
      spriteSourceImageDimensions: { width: 4096, height: 4096 },
      frameCountInput: 16,
      variantCountInput: 24
    });

    expect(message).toContain('Large source image detected');
    expect(message).toContain('16 frames x 24 variants');
  });
});
