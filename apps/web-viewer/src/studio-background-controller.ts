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
  getViewportSize: () => { width: number; height: number };
  isBroadcastViewEnabled: () => boolean;
}

export interface StudioBackgroundController {
  getBackgroundSprite: () => Sprite | null;
  getBackgroundDataUrl: () => string | null;
  loadBackgroundFromDataUrl: (dataUrl: string) => Promise<void>;
  applyLayoutForCurrentView: () => void;
  clearBackground: () => void;
}

export function wireStudioBackgroundController(
  options: StudioBackgroundControllerOptions
): StudioBackgroundController {
  const { controls, backgroundLayer, getViewportSize, isBroadcastViewEnabled } = options;

  let backgroundSprite: Sprite | null = null;
  let backgroundObjectUrl: string | null = null;
  let backgroundDataUrl: string | null = null;

  const mountBackgroundSprite = (sourceUrl: string, serializedDataUrl: string | null): Sprite => {
    const sprite = Sprite.from(sourceUrl);
    backgroundLayer.addChild(sprite);
    backgroundSprite = sprite;
    backgroundDataUrl = serializedDataUrl;
    sprite.alpha = 0.95;

    applyBackgroundLayout(sprite);
    if (!sprite.texture.baseTexture.valid) {
      sprite.texture.baseTexture.once('loaded', () => applyBackgroundLayout(sprite));
    }

    return sprite;
  };

  const applyBackgroundLayout = (sprite: Sprite): void => {
    const w = sprite.texture.width;
    const h = sprite.texture.height;
    if (w <= 0 || h <= 0) return;

    const layout = computeBackgroundLayoutRect(
      w,
      h,
      getViewportSize().width,
      getViewportSize().height,
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

    backgroundDataUrl = null;
  };

  controls.backgroundImageInput.addEventListener('change', async () => {
    const file = controls.backgroundImageInput.files?.[0];
    if (!file) return;

    clearBackground();
    backgroundObjectUrl = URL.createObjectURL(file);
    let serializedDataUrl: string | null = null;
    try {
      serializedDataUrl = await readFileAsDataUrl(file);
    } catch {
      serializedDataUrl = null;
    }

    mountBackgroundSprite(backgroundObjectUrl, serializedDataUrl);

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
    getBackgroundDataUrl: () => backgroundDataUrl,
    loadBackgroundFromDataUrl: async (dataUrl: string) => {
      clearBackground();
      mountBackgroundSprite(dataUrl, dataUrl);
      controls.backgroundImageInput.value = '';
      controls.editorHelp.textContent = 'Background image restored from saved test preset.';
    },
    applyLayoutForCurrentView: () => {
      if (backgroundSprite) {
        applyBackgroundLayout(backgroundSprite);
      }
    },
    clearBackground
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Invalid data URL result'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
