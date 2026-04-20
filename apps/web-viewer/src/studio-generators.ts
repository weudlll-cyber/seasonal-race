/**
 * File: apps/web-viewer/src/studio-generators.ts
 * Model: GPT-5.3-Codex
 * Purpose: Provides auto-generation helpers for track templates and sprite sheets in studio mode.
 * Usage: Imported by studio app to support one-click content generation workflows.
 */

export {
  generateTrackTemplate,
  type GenerateTrackTemplateOptions,
  type TrackTemplateKind
} from './studio-track-template-generator.js';

export interface GeneratedSpriteFrameMeta {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  durationMs: number;
}

export interface GeneratedSpriteSheetMeta {
  generator: 'studio-auto-sprite-v1';
  appliedOutputScale: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  sourceWidth: number;
  sourceHeight: number;
  frames: GeneratedSpriteFrameMeta[];
}

export interface GenerateSpriteSheetOptions {
  frameCount: number;
  frameDurationMs?: number;
  outputScale?: number;
  paddingPx?: number;
}

export type RacerPatternKind = 'stripes' | 'dots' | 'chevron' | 'split';

export interface RacerVariantDescriptor {
  racerId: string;
  label: string;
  tintHex: string;
  secondaryHex: string;
  accentHex: string;
  pattern: RacerPatternKind;
}

export interface GenerateRacerSpritePackOptions extends GenerateSpriteSheetOptions {
  racerVariantCount: number;
}

export interface GeneratedRacerSpritePackMeta {
  generator: 'studio-auto-racer-pack-v1';
  appliedOutputScale: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  racerVariantCount: number;
  sourceWidth: number;
  sourceHeight: number;
  variants: RacerVariantDescriptor[];
  frames: GeneratedSpriteFrameMeta[];
}

export interface GeneratedRacerSpritePack {
  sheetDataUrl: string;
  sheetCanvas: HTMLCanvasElement;
  meta: GeneratedRacerSpritePackMeta;
}

export interface GeneratedSpriteSheet {
  sheetDataUrl: string;
  sheetCanvas: HTMLCanvasElement;
  meta: GeneratedSpriteSheetMeta;
}

const PATTERN_SEQUENCE: RacerPatternKind[] = ['stripes', 'dots', 'chevron', 'split'];
const MAX_SHEET_DIMENSION_PX = 8192;
const MAX_SHEET_PIXELS = 67_000_000;
const MIN_EFFECTIVE_OUTPUT_SCALE = 0.05;

export function generateSpriteSheetFromImage(
  sourceImage: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: GenerateSpriteSheetOptions
): GeneratedSpriteSheet {
  const frameCount = Math.max(4, Math.min(24, Math.floor(options.frameCount)));
  const frameDurationMs = Math.max(40, Math.min(300, Math.floor(options.frameDurationMs ?? 100)));
  const padding = Math.max(2, Math.floor(options.paddingPx ?? 10));
  const requestedOutputScale = clamp(options.outputScale ?? 1, MIN_EFFECTIVE_OUTPUT_SCALE, 3);
  const outputScale = resolveSafeSpriteSheetOutputScale({
    sourceWidth,
    sourceHeight,
    requestedOutputScale,
    padding,
    frameCount,
    variantCount: 1
  });

  const baseWidth = Math.max(8, Math.floor(sourceWidth * outputScale));
  const baseHeight = Math.max(8, Math.floor(sourceHeight * outputScale));
  const frameWidth = baseWidth + padding * 2;
  const frameHeight = baseHeight + padding * 2;

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = frameWidth * frameCount;
  sheetCanvas.height = frameHeight;
  const sheetCtx = sheetCanvas.getContext('2d');
  if (!sheetCtx) {
    throw new Error('Canvas 2D context unavailable for sprite generation.');
  }

  const frames: GeneratedSpriteFrameMeta[] = [];

  for (let i = 0; i < frameCount; i += 1) {
    const phase = (i / frameCount) * Math.PI * 2;
    const bob = Math.sin(phase) * 0.06;
    const stretchY = 1 + Math.sin(phase + Math.PI * 0.4) * 0.08;
    const stretchX = 1 - Math.sin(phase + Math.PI * 0.4) * 0.05;
    const tilt = Math.sin(phase) * 0.12;

    const frameX = i * frameWidth;
    const cx = frameX + frameWidth * 0.5;
    const cy = frameHeight * 0.5;

    sheetCtx.save();

    sheetCtx.translate(cx, cy + bob * baseHeight);
    sheetCtx.rotate(tilt);
    sheetCtx.scale(stretchX, stretchY);

    sheetCtx.drawImage(sourceImage, -baseWidth * 0.5, -baseHeight * 0.5, baseWidth, baseHeight);

    sheetCtx.restore();

    frames.push({
      name: `frame_${String(i + 1).padStart(2, '0')}`,
      x: frameX,
      y: 0,
      width: frameWidth,
      height: frameHeight,
      durationMs: frameDurationMs
    });
  }

  return {
    sheetDataUrl: sheetCanvas.toDataURL('image/png'),
    sheetCanvas,
    meta: {
      generator: 'studio-auto-sprite-v1',
      appliedOutputScale: outputScale,
      frameWidth,
      frameHeight,
      frameCount,
      sourceWidth,
      sourceHeight,
      frames
    }
  };
}

export function generateRacerVariantDescriptors(
  racerVariantCount: number
): RacerVariantDescriptor[] {
  const count = Math.max(2, Math.min(60, Math.floor(racerVariantCount)));
  const variants: RacerVariantDescriptor[] = [];
  const satCycle = [68, 76, 84, 72];
  const lightCycle = [52, 60, 56, 48];

  for (let i = 0; i < count; i += 1) {
    const hue = Math.round((i * 137.5 + 24) % 360);
    const sat = satCycle[i % satCycle.length]!;
    const light = lightCycle[i % lightCycle.length]!;
    const secondaryHue = (hue + (i % 2 === 0 ? 122 : 186)) % 360;
    const accentHue = (hue + (i % 3 === 0 ? 46 : 302)) % 360;
    variants.push({
      racerId: `racer-${String(i + 1).padStart(2, '0')}`,
      label: `R${i + 1}`,
      tintHex: hslToHex(hue, sat, light),
      secondaryHex: hslToHex(secondaryHue, Math.max(62, sat - 6), Math.min(66, light + 2)),
      accentHex: hslToHex(accentHue, Math.min(90, sat + 8), Math.min(70, light + 8)),
      pattern: PATTERN_SEQUENCE[i % PATTERN_SEQUENCE.length]!
    });
  }

  return variants;
}

export function generateRacerSpritePackFromImage(
  sourceImage: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: GenerateRacerSpritePackOptions
): GeneratedRacerSpritePack {
  const frameCount = Math.max(4, Math.min(24, Math.floor(options.frameCount)));
  const frameDurationMs = Math.max(40, Math.min(300, Math.floor(options.frameDurationMs ?? 100)));
  const padding = Math.max(2, Math.floor(options.paddingPx ?? 10));
  const variants = generateRacerVariantDescriptors(options.racerVariantCount);
  const requestedOutputScale = clamp(options.outputScale ?? 1, MIN_EFFECTIVE_OUTPUT_SCALE, 3);
  const outputScale = resolveSafeSpriteSheetOutputScale({
    sourceWidth,
    sourceHeight,
    requestedOutputScale,
    padding,
    frameCount,
    variantCount: variants.length
  });

  const baseWidth = Math.max(8, Math.floor(sourceWidth * outputScale));
  const baseHeight = Math.max(8, Math.floor(sourceHeight * outputScale));
  const frameWidth = baseWidth + padding * 2;
  const frameHeight = baseHeight + padding * 2;

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = frameWidth * frameCount;
  sheetCanvas.height = frameHeight * variants.length;
  const sheetCtx = sheetCanvas.getContext('2d');
  if (!sheetCtx) {
    throw new Error('Canvas 2D context unavailable for racer sprite generation.');
  }

  const frames: GeneratedSpriteFrameMeta[] = [];

  for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
    const variant = variants[variantIndex]!;
    const variantOffsetY = variantIndex * frameHeight;

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const phase = (frameIndex / frameCount) * Math.PI * 2;
      const bob = Math.sin(phase) * 0.06;
      const stretchY = 1 + Math.sin(phase + Math.PI * 0.4) * 0.08;
      const stretchX = 1 - Math.sin(phase + Math.PI * 0.4) * 0.05;
      const tilt = Math.sin(phase) * 0.12;

      const frameX = frameIndex * frameWidth;
      const frameY = variantOffsetY;
      const cx = frameX + frameWidth * 0.5;
      const cy = frameY + frameHeight * 0.5;

      sheetCtx.save();

      sheetCtx.translate(cx, cy + bob * baseHeight);
      sheetCtx.rotate(tilt);
      sheetCtx.scale(stretchX, stretchY);
      sheetCtx.drawImage(sourceImage, -baseWidth * 0.5, -baseHeight * 0.5, baseWidth, baseHeight);

      sheetCtx.globalCompositeOperation = 'source-atop';
      sheetCtx.fillStyle = hexToRgba(variant.tintHex, 0.34);
      sheetCtx.fillRect(-baseWidth * 0.5, -baseHeight * 0.5, baseWidth, baseHeight);

      drawVariantPattern(sheetCtx, variant, baseWidth, baseHeight);

      // Re-apply source detail lightly so eyes/beak/silhouette stay readable after tint/pattern.
      sheetCtx.globalCompositeOperation = 'source-atop';
      sheetCtx.globalAlpha = 0.42;
      sheetCtx.drawImage(sourceImage, -baseWidth * 0.5, -baseHeight * 0.5, baseWidth, baseHeight);
      sheetCtx.globalAlpha = 1;

      sheetCtx.restore();

      frames.push({
        name: `${variant.racerId}_frame_${String(frameIndex + 1).padStart(2, '0')}`,
        x: frameX,
        y: frameY,
        width: frameWidth,
        height: frameHeight,
        durationMs: frameDurationMs
      });
    }
  }

  return {
    sheetDataUrl: sheetCanvas.toDataURL('image/png'),
    sheetCanvas,
    meta: {
      generator: 'studio-auto-racer-pack-v1',
      appliedOutputScale: outputScale,
      frameWidth,
      frameHeight,
      frameCount,
      racerVariantCount: variants.length,
      sourceWidth,
      sourceHeight,
      variants,
      frames
    }
  };
}

function drawVariantPattern(
  ctx: CanvasRenderingContext2D,
  variant: RacerVariantDescriptor,
  width: number,
  height: number
): void {
  ctx.globalCompositeOperation = 'source-atop';
  const darkColor = shiftHexLightness(variant.tintHex, -24);
  const midColor = variant.secondaryHex;
  const accentColor = variant.accentHex;

  if (variant.pattern === 'stripes') {
    ctx.strokeStyle = hexToRgba(darkColor, 0.46);
    ctx.lineWidth = Math.max(2, width * 0.06);
    for (let x = -width; x < width * 1.2; x += Math.max(5, width * 0.18)) {
      ctx.beginPath();
      ctx.moveTo(x, -height * 0.55);
      ctx.lineTo(x + width * 0.45, height * 0.55);
      ctx.stroke();
    }

    ctx.strokeStyle = hexToRgba(accentColor, 0.38);
    ctx.lineWidth = Math.max(1.2, width * 0.03);
    for (let x = -width * 0.7; x < width; x += Math.max(7, width * 0.27)) {
      ctx.beginPath();
      ctx.moveTo(x, -height * 0.55);
      ctx.lineTo(x + width * 0.4, height * 0.52);
      ctx.stroke();
    }
    return;
  }

  if (variant.pattern === 'dots') {
    ctx.fillStyle = hexToRgba(midColor, 0.36);
    const step = Math.max(5, width * 0.16);
    const radius = Math.max(1.3, width * 0.05);
    for (let y = -height * 0.42; y <= height * 0.42; y += step) {
      for (let x = -width * 0.42; x <= width * 0.42; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = hexToRgba(accentColor, 0.48);
    const innerRadius = Math.max(0.8, radius * 0.45);
    for (let y = -height * 0.42; y <= height * 0.42; y += step) {
      for (let x = -width * 0.42; x <= width * 0.42; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  if (variant.pattern === 'chevron') {
    ctx.strokeStyle = hexToRgba(darkColor, 0.42);
    ctx.lineWidth = Math.max(2, width * 0.05);
    const step = Math.max(7, width * 0.2);
    for (let y = -height * 0.45; y < height * 0.45; y += step) {
      ctx.beginPath();
      ctx.moveTo(-width * 0.45, y);
      ctx.lineTo(0, y + step * 0.5);
      ctx.lineTo(width * 0.45, y);
      ctx.stroke();
    }

    ctx.strokeStyle = hexToRgba(accentColor, 0.36);
    ctx.lineWidth = Math.max(1, width * 0.025);
    for (let y = -height * 0.35; y < height * 0.35; y += step) {
      ctx.beginPath();
      ctx.moveTo(-width * 0.33, y);
      ctx.lineTo(0, y + step * 0.38);
      ctx.lineTo(width * 0.33, y);
      ctx.stroke();
    }
    return;
  }

  ctx.fillStyle = hexToRgba(darkColor, 0.28);
  ctx.fillRect(-width * 0.5, -height * 0.5, width * 0.5, height);
  ctx.fillStyle = hexToRgba(midColor, 0.24);
  ctx.fillRect(0, -height * 0.5, width * 0.5, height);
  ctx.strokeStyle = hexToRgba(accentColor, 0.46);
  ctx.lineWidth = Math.max(1.6, width * 0.035);
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.5);
  ctx.lineTo(0, height * 0.5);
  ctx.stroke();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveSafeSpriteSheetOutputScale(options: {
  sourceWidth: number;
  sourceHeight: number;
  requestedOutputScale: number;
  padding: number;
  frameCount: number;
  variantCount: number;
}): number {
  const sourceWidth = Math.max(1, Math.floor(options.sourceWidth));
  const sourceHeight = Math.max(1, Math.floor(options.sourceHeight));
  const padding = Math.max(2, Math.floor(options.padding));
  const frameCount = Math.max(1, Math.floor(options.frameCount));
  const variantCount = Math.max(1, Math.floor(options.variantCount));
  const requested = clamp(options.requestedOutputScale, MIN_EFFECTIVE_OUTPUT_SCALE, 3);

  const fitsLimits = (scale: number): boolean => {
    const baseWidth = Math.max(8, Math.floor(sourceWidth * scale));
    const baseHeight = Math.max(8, Math.floor(sourceHeight * scale));
    const frameWidth = baseWidth + padding * 2;
    const frameHeight = baseHeight + padding * 2;
    const sheetWidth = frameWidth * frameCount;
    const sheetHeight = frameHeight * variantCount;
    return (
      sheetWidth <= MAX_SHEET_DIMENSION_PX &&
      sheetHeight <= MAX_SHEET_DIMENSION_PX &&
      sheetWidth * sheetHeight <= MAX_SHEET_PIXELS
    );
  };

  if (fitsLimits(requested)) {
    return requested;
  }

  const minScale = MIN_EFFECTIVE_OUTPUT_SCALE;
  if (!fitsLimits(minScale)) {
    throw new Error(
      'Sprite generation exceeds canvas limits for this source image. Use fewer frames/variants or a smaller image.'
    );
  }

  let low = minScale;
  let high = requested;
  for (let i = 0; i < 18; i += 1) {
    const mid = (low + high) * 0.5;
    if (fitsLimits(mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((hp % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;

  if (hp >= 0 && hp < 1) {
    r = chroma;
    g = x;
  } else if (hp >= 1 && hp < 2) {
    r = x;
    g = chroma;
  } else if (hp >= 2 && hp < 3) {
    g = chroma;
    b = x;
  } else if (hp >= 3 && hp < 4) {
    g = x;
    b = chroma;
  } else if (hp >= 4 && hp < 5) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  const m = light - chroma / 2;
  const toByte = (channel: number): string =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

function shiftHexLightness(hex: string, delta: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }

  const shifted = {
    r: clamp(rgb.r + delta, 0, 255),
    g: clamp(rgb.g + delta, 0, 255),
    b: clamp(rgb.b + delta, 0, 255)
  };
  return rgbToHex(shifted.r, shifted.g, shifted.b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number): string =>
    Math.round(clamp(v, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) ?? { r: 255, g: 255, b: 255 };
  const a = clamp(alpha, 0, 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}
