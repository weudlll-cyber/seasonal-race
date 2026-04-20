/**
 * File: apps/web-viewer/src/studio-track-template-generator.ts
 * Model: GPT-5.3-Codex
 * Purpose: Generates track control-point templates for studio quick-start flows.
 * Usage: Imported by studio-generators and studio-app.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { round3 } from './studio-editor-helpers.js';

export type TrackTemplateKind = 's-curve' | 'oval' | 'zigzag' | 'river-bend';

export interface GenerateTrackTemplateOptions {
  kind: TrackTemplateKind;
  controlPointCount: number;
  width: number;
  height: number;
  margin?: number;
}

export function generateTrackTemplate(options: GenerateTrackTemplateOptions): TrackPoint[] {
  const width = Math.max(200, options.width);
  const height = Math.max(200, options.height);
  const margin = Math.max(20, options.margin ?? 80);
  const pointCount = Math.max(3, Math.min(40, Math.floor(options.controlPointCount)));
  const points: TrackPoint[] = [];

  for (let i = 0; i < pointCount; i += 1) {
    const t = pointCount === 1 ? 0 : i / (pointCount - 1);

    let x = margin + t * (width - margin * 2);
    let y = height * 0.5;

    if (options.kind === 's-curve') {
      const a = (height - margin * 2) * 0.28;
      y = height * 0.5 + Math.sin(t * Math.PI * 2) * a * (0.85 + 0.15 * Math.cos(t * Math.PI));
    } else if (options.kind === 'oval') {
      const angle = t * Math.PI * 2;
      const rx = (width - margin * 2) * 0.48;
      const ry = (height - margin * 2) * 0.34;
      x = width * 0.5 + Math.cos(angle) * rx;
      y = height * 0.5 + Math.sin(angle) * ry;
    } else if (options.kind === 'zigzag') {
      const steps = Math.max(2, Math.floor(pointCount / 2));
      const segmentT = t * steps;
      const wave = segmentT - Math.floor(segmentT);
      const zig = wave < 0.5 ? wave * 2 : (1 - wave) * 2;
      const range = (height - margin * 2) * 0.42;
      y = margin + zig * range;
    } else {
      const base = Math.sin(t * Math.PI * 1.5) * 0.25 + Math.sin(t * Math.PI * 4) * 0.08;
      y = height * 0.5 + base * (height - margin * 2);
      x = margin + (t + Math.sin(t * Math.PI * 2) * 0.03) * (width - margin * 2);
    }

    points.push({
      x: round3(clamp(x, margin, width - margin)),
      y: round3(clamp(y, margin, height - margin))
    });
  }

  return points;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
