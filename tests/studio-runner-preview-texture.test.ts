/**
 * File: tests/studio-runner-preview-texture.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies runner preview texture selection and scale clamping helpers.
 * Usage: Runs under Vitest to protect studio runner preview rendering behavior.
 */

import { describe, expect, it } from 'vitest';

import {
  resolveRunnerPreviewScale,
  resolveRunnerPreviewTexture
} from '../apps/web-viewer/src/studio-runner-preview-texture';

describe('studio runner preview texture', () => {
  it('returns generated preview texture for current frame when available', () => {
    const generatedTextureA = { width: 80, height: 40 } as never;
    const generatedTextureB = { width: 96, height: 48 } as never;
    const fallbackTexture = { width: 32, height: 32 } as never;

    const resolved = resolveRunnerPreviewTexture({
      generatedPreviewTextures: [generatedTextureA, generatedTextureB],
      previewFrameIndex: 3,
      defaultTexture: fallbackTexture
    });

    expect(resolved.texture).toBe(generatedTextureB);
    expect(resolved.usesGeneratedPreview).toBe(true);
  });

  it('falls back to default texture when generated list is empty', () => {
    const fallbackTexture = { width: 32, height: 64 } as never;

    const resolved = resolveRunnerPreviewTexture({
      generatedPreviewTextures: [],
      previewFrameIndex: 5,
      defaultTexture: fallbackTexture
    });

    expect(resolved.texture).toBe(fallbackTexture);
    expect(resolved.usesGeneratedPreview).toBe(false);
  });

  it('clamps runner preview scale to expected min/max bounds', () => {
    const tinyTexture = { width: 8, height: 8 } as never;
    const hugeTexture = { width: 3000, height: 3000 } as never;

    expect(resolveRunnerPreviewScale(tinyTexture, 120)).toBe(3.4);
    expect(resolveRunnerPreviewScale(hugeTexture, 30)).toBe(0.12);
  });
});
