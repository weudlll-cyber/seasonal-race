/**
 * File: apps/web-viewer/src/world-transform-utils.ts
 * Model: GPT-5.3-Codex
 * Purpose: Shared Pixi world transform helpers for reset and background-bound clamping.
 * Usage: Used by both editor preview and runtime playback cameras.
 */

import type { Container, Sprite } from 'pixi.js';

export function resetWorldTransform(world: Container): void {
  world.scale.set(1);
  world.position.set(0, 0);
}

export function clampWorldToBackground(
  world: Container,
  backgroundSprite: Sprite,
  viewportWidth: number,
  viewportHeight: number
): void {
  const worldScale = world.scale.x;
  const bgWidth = backgroundSprite.texture.width * backgroundSprite.scale.x;
  const bgHeight = backgroundSprite.texture.height * backgroundSprite.scale.y;

  const minX = viewportWidth - (backgroundSprite.x + bgWidth) * worldScale;
  const maxX = -backgroundSprite.x * worldScale;
  const minY = viewportHeight - (backgroundSprite.y + bgHeight) * worldScale;
  const maxY = -backgroundSprite.y * worldScale;

  world.position.set(
    clampAxis(world.position.x, minX, maxX),
    clampAxis(world.position.y, minY, maxY)
  );
}

function clampAxis(value: number, minValue: number, maxValue: number): number {
  if (minValue > maxValue) return (minValue + maxValue) / 2;
  return Math.max(minValue, Math.min(maxValue, value));
}
