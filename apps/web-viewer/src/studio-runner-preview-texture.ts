/**
 * File: apps/web-viewer/src/studio-runner-preview-texture.ts
 * Model: GPT-5.3-Codex
 * Purpose: Resolves runner preview texture choice and scale policy in studio mode.
 * Usage: Used by studio-app ticker to keep runner texture policy out of app orchestration.
 */

import type { Texture } from 'pixi.js';

export interface ResolveRunnerPreviewTextureInput {
  generatedPreviewTextures: Texture[];
  previewFrameIndex: number;
  defaultTexture: Texture;
}

export interface ResolvedRunnerPreviewTexture {
  texture: Texture;
  usesGeneratedPreview: boolean;
}

export function resolveRunnerPreviewTexture(
  input: ResolveRunnerPreviewTextureInput
): ResolvedRunnerPreviewTexture {
  if (input.generatedPreviewTextures.length > 0) {
    return {
      texture:
        input.generatedPreviewTextures[
          input.previewFrameIndex % input.generatedPreviewTextures.length
        ]!,
      usesGeneratedPreview: true
    };
  }

  return {
    texture: input.defaultTexture,
    usesGeneratedPreview: false
  };
}

export function resolveRunnerPreviewScale(texture: Texture, targetRunnerSizePx: number): number {
  const maxTextureEdge = Math.max(texture.width, texture.height) || 1;
  const scale = targetRunnerSizePx / maxTextureEdge;
  return Math.max(0.12, Math.min(3.4, scale));
}
