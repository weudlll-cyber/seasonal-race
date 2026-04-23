/**
 * File: apps/web-viewer/src/runtime-layout.ts
 * Model: GPT-5.3-Codex
 * Purpose: Resolves runtime local pack layout with stable lateral-first separation.
 * Usage: Runtime app projects racers into track-local space, then resolves overlap here.
 */

export interface RuntimeLocalPackRacer {
  id: string;
  index: number;
  progress: number;
  centerX: number;
  centerY: number;
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
  alongDistance: number;
  lateralDistance: number;
  lateralLimit: number;
  preferredLateralSign: number;
}

export interface RuntimeResolvedPackRacer extends RuntimeLocalPackRacer {
  x: number;
  y: number;
}

export interface RuntimeStableTrackLocalPoseInput {
  previousAlongDistance: number;
  previousLateralDistance: number;
  targetAlongDistance: number;
  targetLateralDistance: number;
  lateralLimit: number;
  dtSec: number;
  speedNorm: number;
  collisionOffsetPx: number;
  pairSeparationPressure?: number;
}

export interface RuntimeRenderPose {
  id: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  maxDisplacementPx: number;
}

export function resolveRuntimeLocalPackLayout(
  racers: RuntimeLocalPackRacer[],
  spriteBaseScale: number
): RuntimeResolvedPackRacer[] {
  const sorted = [...racers].sort((a, b) => {
    if (a.progress === b.progress) {
      return a.index - b.index;
    }
    return b.progress - a.progress;
  });
  const resolved: RuntimeResolvedPackRacer[] = [];
  const minSeparation = clamp(14.5, 23, 12.6 + spriteBaseScale * 8.9);
  const maxLateralCorrection = clamp(13, 31, minSeparation * 1.42);

  for (const racer of sorted) {
    const baseAlong = racer.alongDistance;
    const baseLateral = racer.lateralDistance;
    let along = baseAlong;
    let lateral = baseLateral;

    for (let iter = 0; iter < 3; iter += 1) {
      for (const other of resolved) {
        const progressGap = other.progress - racer.progress;
        if (progressGap < -0.002 || progressGap > 0.06) {
          continue;
        }

        const currentX = racer.centerX + racer.normalX * lateral + racer.tangentX * along;
        const currentY = racer.centerY + racer.normalY * lateral + racer.tangentY * along;
        const dx = currentX - other.x;
        const dy = currentY - other.y;
        const distance = Math.hypot(dx, dy);
        const effectiveMinSeparation = minSeparation * lerp(1.15, 0.92, clamp01(progressGap / 0.05));
        if (distance >= effectiveMinSeparation) {
          continue;
        }

        const overlap = effectiveMinSeparation - Math.max(0.001, distance);
        const lateralSeparation = dx * racer.normalX + dy * racer.normalY;
        const alongSeparation = dx * racer.tangentX + dy * racer.tangentY;
        const direction =
          Math.abs(lateralSeparation) > 0.01
            ? Math.sign(lateralSeparation)
            : racer.preferredLateralSign === 0
              ? racer.index % 2 === 0
                ? -1
                : 1
              : racer.preferredLateralSign;

        lateral += direction * overlap * 0.9;
        if (Math.abs(lateralSeparation) < effectiveMinSeparation * 0.58) {
          along -= Math.max(0, overlap * 0.14 - alongSeparation * 0.04);
        }

        lateral = clamp(
          Math.max(-racer.lateralLimit, baseLateral - maxLateralCorrection),
          Math.min(racer.lateralLimit, baseLateral + maxLateralCorrection),
          lateral
        );
      }
    }

    const x = racer.centerX + racer.normalX * lateral + racer.tangentX * along;
    const y = racer.centerY + racer.normalY * lateral + racer.tangentY * along;
    resolved.push({
      ...racer,
      alongDistance: along,
      lateralDistance: lateral,
      x,
      y
    });
  }

  return resolved;
}

export function resolveRuntimeStableTrackLocalPose(
  input: RuntimeStableTrackLocalPoseInput
): { alongDistance: number; lateralDistance: number } {
  const safeDt = clamp(1 / 240, 1 / 20, input.dtSec);
  let targetLateralDistance = clamp(
    -input.lateralLimit,
    input.lateralLimit,
    input.targetLateralDistance
  );
  const previousSign = Math.sign(input.previousLateralDistance);
  const targetSign = Math.sign(targetLateralDistance);
  const signFlip = previousSign !== 0 && targetSign !== 0 && previousSign !== targetSign;
  const weakCrossing =
    signFlip &&
    Math.abs(targetLateralDistance) < Math.max(8, input.lateralLimit * 0.28) &&
    input.collisionOffsetPx < 10;

  if (weakCrossing) {
    targetLateralDistance = lerp(targetLateralDistance, input.previousLateralDistance * 0.82, 0.88);
  }

  const centerDeadzone = Math.max(4, input.lateralLimit * 0.08);
  if (
    Math.abs(targetLateralDistance) < centerDeadzone &&
    Math.abs(input.previousLateralDistance) < Math.max(12, input.lateralLimit * 0.32)
  ) {
    targetLateralDistance = lerp(targetLateralDistance, input.previousLateralDistance * 0.9, 0.84);
  }

  const pairSeparationPressure = input.pairSeparationPressure ?? 0;
  const alongResponse = lerp(0.24, 0.38, input.speedNorm);
  const lateralResponse =
    lerp(0.12, 0.2, input.speedNorm) *
    lerp(0.92, 1.18, clamp01(Math.max(input.collisionOffsetPx, pairSeparationPressure) / 18));
  const maxAlongStep = (80 + input.speedNorm * 70) * safeDt;
  const maxLateralStep =
    (30 +
      input.speedNorm * 20 +
      input.collisionOffsetPx * 0.7 +
      pairSeparationPressure * 0.45) *
    safeDt;

  const alongDistance = input.previousAlongDistance + clamp(
    -maxAlongStep,
    maxAlongStep,
    (input.targetAlongDistance - input.previousAlongDistance) * alongResponse
  );
  let lateralDistance = input.previousLateralDistance + clamp(
    -maxLateralStep,
    maxLateralStep,
    (targetLateralDistance - input.previousLateralDistance) * lateralResponse
  );

  if (weakCrossing && Math.sign(lateralDistance) !== previousSign && Math.abs(lateralDistance) < centerDeadzone * 1.25) {
    lateralDistance = previousSign * Math.min(centerDeadzone * 1.25, Math.abs(input.previousLateralDistance) * 0.72 + 1.5);
  }

  return {
    alongDistance,
    lateralDistance: clamp(-input.lateralLimit, input.lateralLimit, lateralDistance)
  };
}

export function resolveRuntimeRenderMinimumSeparation(
  poses: RuntimeRenderPose[],
  spriteBaseScale: number
): Map<string, { x: number; y: number }> {
  const densityBlend = clamp01((poses.length - 36) / 64);
  const minSeparation = clamp(12.5, 24, 11 + spriteBaseScale * 7.1 + densityBlend * 4.8);
  const maxPairPush = clamp(1.2, 5, minSeparation * lerp(0.24, 0.36, densityBlend));
  const iterationCount = Math.round(lerp(3, 6, densityBlend));
  const resolved = poses.map((pose) => ({
    ...pose,
    x: pose.x,
    y: pose.y
  }));

  for (let iter = 0; iter < iterationCount; iter += 1) {
    for (let i = 0; i < resolved.length; i += 1) {
      const a = resolved[i];
      if (!a) continue;
      for (let j = i + 1; j < resolved.length; j += 1) {
        const b = resolved[j];
        if (!b) continue;

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= minSeparation) continue;

        const overlap = minSeparation - Math.max(0.001, distance);
        const push = Math.min(maxPairPush, overlap * 0.5);
        let nx: number;
        let ny: number;
        if (distance < 0.0001) {
          const angle = (hashStringToUnit(`${a.id}|${b.id}`) * Math.PI * 2) % (Math.PI * 2);
          nx = Math.cos(angle);
          ny = Math.sin(angle);
        } else {
          nx = dx / distance;
          ny = dy / distance;
        }

        a.x += nx * push;
        a.y += ny * push;
        b.x -= nx * push;
        b.y -= ny * push;

        clampPoseDisplacement(a);
        clampPoseDisplacement(b);
      }
    }
  }

  return new Map(resolved.map((pose) => [pose.id, { x: pose.x, y: pose.y }]));
}

export function resolveRuntimeSeparationDisplacementCap(
  racerCount: number,
  spriteBaseScale: number
): number {
  const densityBlend = clamp01((racerCount - 28) / 72);
  return clamp(3.8, 10, 3.8 + spriteBaseScale * 0.9 + densityBlend * 5.2);
}

function clampPoseDisplacement(pose: RuntimeRenderPose & { x: number; y: number }): void {
  if (pose.maxDisplacementPx <= 0) {
    pose.x = pose.anchorX;
    pose.y = pose.anchorY;
    return;
  }
  const dx = pose.x - pose.anchorX;
  const dy = pose.y - pose.anchorY;
  const distance = Math.hypot(dx, dy);
  if (distance <= pose.maxDisplacementPx || distance === 0) {
    return;
  }
  const scale = pose.maxDisplacementPx / distance;
  pose.x = pose.anchorX + dx * scale;
  pose.y = pose.anchorY + dy * scale;
}

function hashStringToUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(0, 1, value);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}
