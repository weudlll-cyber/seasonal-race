/**
 * File: apps/web-viewer/src/studio-generator-ui-state.ts
 * Model: GPT-5.3-Codex
 * Purpose: Centralizes generator preset and warning-message state resolution for studio UI.
 * Usage: Consumed by studio-app to keep generator UI policy logic out of orchestration flow.
 */

import { resolveSafeSpriteSheetOutputScale } from './studio-generators.js';

export type GeneratorPresetLabel = 'Minimal' | 'Balanced' | 'Max Contrast';

export interface SpriteSourceImageDimensions {
  width: number;
  height: number;
}

export interface SpriteGenerationWarningInput {
  spriteSourceImageDimensions: SpriteSourceImageDimensions | null;
  frameCountInput: number;
  variantCountInput: number;
}

export function resolveGeneratorPresetLabel(
  frameCount: number,
  variantCount: number
): GeneratorPresetLabel | null {
  if (frameCount === 8 && variantCount === 8) {
    return 'Minimal';
  }
  if (frameCount === 10 && variantCount === 12) {
    return 'Balanced';
  }
  if (frameCount === 16 && variantCount === 24) {
    return 'Max Contrast';
  }
  return null;
}

export function buildSpriteGenerationWarning(input: SpriteGenerationWarningInput): string {
  if (!input.spriteSourceImageDimensions) {
    return 'Select a source image to see generation-size guidance.';
  }

  const frameCount = Math.max(4, Math.min(24, Math.floor(input.frameCountInput)));
  const variantCount = Math.max(2, Math.min(60, Math.floor(input.variantCountInput)));

  try {
    const safeScale = resolveSafeSpriteSheetOutputScale({
      sourceWidth: input.spriteSourceImageDimensions.width,
      sourceHeight: input.spriteSourceImageDimensions.height,
      requestedOutputScale: 1,
      padding: 10,
      frameCount,
      variantCount
    });

    if (safeScale < 0.999) {
      return `Large source image detected: generator will auto-scale to ${(safeScale * 100).toFixed(1)}% (${frameCount} frames x ${variantCount} variants).`;
    }

    return `Generation fits at 100% scale (${frameCount} frames x ${variantCount} variants).`;
  } catch {
    return 'Current source image/settings exceed browser canvas limits. Reduce frame/variant count or use a smaller image.';
  }
}
