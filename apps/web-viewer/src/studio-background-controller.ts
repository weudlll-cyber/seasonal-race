/**
 * File: apps/web-viewer/src/studio-background-controller.ts
 * Model: GPT-5.3-Codex
 * Purpose: Encapsulates studio background image load/clear/layout flow for editor and broadcast modes.
 * Usage: Create once in studio app, then query current sprite and re-apply layout when view mode changes.
 */

import { Sprite, type Container } from 'pixi.js';
import { computeBackgroundLayoutRect } from './track-layout-helpers';

interface StudioBackgroundControls {
  backgroundImageInput: HTMLInputElement;
  clearImageButton: HTMLButtonElement;
  editorHelp: HTMLElement;
}

export interface StudioBackgroundControllerOptions {
  controls: StudioBackgroundControls;
  backgroundLayer: Container;
  viewWidth: number;
  viewHeight: number;
  isBroadcastViewEnabled: () => boolean;
}

export interface StudioBackgroundController {
  getBackgroundSprite: () => Sprite | null;
  applyLayoutForCurrentView: () => void;
  clearBackground: () => void;
}

export function wireStudioBackgroundController(
  options: StudioBackgroundControllerOptions
): StudioBackgroundController {
  const { controls, backgroundLayer, viewWidth, viewHeight, isBroadcastViewEnabled } = options;

  let backgroundSprite: Sprite | null = null;
  let backgroundObjectUrl: string | null = null;

  const applyBackgroundLayout = (sprite: Sprite): void => {
    const w = sprite.texture.width;
    const h = sprite.texture.height;
    if (w <= 0 || h <= 0) return;

    const layout = computeBackgroundLayoutRect(
      w,
      h,
      viewWidth,
      viewHeight,
      isBroadcastViewEnabled()
    );
    sprite.scale.set(layout.w / w);
    sprite.position.set(layout.x, layout.y);
    sprite.alpha = isBroadcastViewEnabled() ? 1 : 0.95;
  };

  const clearBackground = (): void => {
    if (backgroundSprite) {
      backgroundLayer.removeChild(backgroundSprite);
      backgroundSprite.destroy();
      backgroundSprite = null;
    }

    if (backgroundObjectUrl) {
      URL.revokeObjectURL(backgroundObjectUrl);
      backgroundObjectUrl = null;
    }
  };

  controls.backgroundImageInput.addEventListener('change', async () => {
    const file = controls.backgroundImageInput.files?.[0];
    if (!file) return;

    clearBackground();
    backgroundObjectUrl = URL.createObjectURL(file);
    const sprite = Sprite.from(backgroundObjectUrl);
    backgroundLayer.addChild(sprite);
    backgroundSprite = sprite;
    sprite.alpha = 0.95;

    applyBackgroundLayout(sprite);
    if (!sprite.texture.baseTexture.valid) {
      sprite.texture.baseTexture.once('loaded', () => applyBackgroundLayout(sprite));
    }

    controls.editorHelp.textContent =
      'Background image loaded. Click to place points, drag points to edit.';
  });

  controls.clearImageButton.addEventListener('click', () => {
    clearBackground();
    controls.backgroundImageInput.value = '';
    controls.editorHelp.textContent = 'Background image removed.';
  });

  return {
    getBackgroundSprite: () => backgroundSprite,
    applyLayoutForCurrentView: () => {
      if (backgroundSprite) {
        applyBackgroundLayout(backgroundSprite);
      }
    },
    clearBackground
  };
}
