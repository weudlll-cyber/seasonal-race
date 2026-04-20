/**
 * File: apps/web-viewer/src/studio-app-secondary-controls-controller.ts
 * Model: GPT-5.3-Codex
 * Purpose: Wires secondary studio editor controls (generator/surface/preset/json) to callbacks.
 * Usage: Imported by studio-app to keep DOM listener registration out of composition flow.
 */

import type { EditorDom } from './studio-dom.js';

type BoundarySideValue = 'left' | 'right';

interface SecondaryControls {
  trackTemplatePointsInput: EditorDom['trackTemplatePointsInput'];
  spriteFrameCountInput: EditorDom['spriteFrameCountInput'];
  trackPreviewSizeInput: EditorDom['trackPreviewSizeInput'];
  spriteVariantCountInput: EditorDom['spriteVariantCountInput'];
  spritePresetMinimalButton: EditorDom['spritePresetMinimalButton'];
  spritePresetBalancedButton: EditorDom['spritePresetBalancedButton'];
  spritePresetMaxContrastButton: EditorDom['spritePresetMaxContrastButton'];
  spriteSourceImageInput: EditorDom['spriteSourceImageInput'];
  surfaceRaceTypeSelect: EditorDom['surfaceRaceTypeSelect'];
  surfaceCategorySelect: EditorDom['surfaceCategorySelect'];
  surfaceSizeClassSelect: EditorDom['surfaceSizeClassSelect'];
  surfaceProfileSelect: EditorDom['surfaceProfileSelect'];
  generateTrackTemplateButton: EditorDom['generateTrackTemplateButton'];
  generateSpriteSheetButton: EditorDom['generateSpriteSheetButton'];
  downloadSpriteSheetButton: EditorDom['downloadSpriteSheetButton'];
  downloadSpriteMetaButton: EditorDom['downloadSpriteMetaButton'];
  boundaryEditSideSelect: EditorDom['boundaryEditSideSelect'];
  trackIdInput: EditorDom['trackIdInput'];
  trackNameInput: EditorDom['trackNameInput'];
  effectProfileInput: EditorDom['effectProfileInput'];
  savePresetButton: EditorDom['savePresetButton'];
  loadPresetButton: EditorDom['loadPresetButton'];
  deletePresetButton: EditorDom['deletePresetButton'];
  presetSelect: EditorDom['presetSelect'];
  copyJsonButton: EditorDom['copyJsonButton'];
  downloadJsonButton: EditorDom['downloadJsonButton'];
  loadJsonButton: EditorDom['loadJsonButton'];
}

export interface WireStudioSecondaryControlsOptions {
  controls: SecondaryControls;
  onTrackTemplatePointsInput: () => void;
  onSpriteFrameCountInput: () => void;
  onTrackPreviewSizeInput: () => void;
  onSpriteVariantCountInput: () => void;
  onSpritePresetMinimal: () => void;
  onSpritePresetBalanced: () => void;
  onSpritePresetMaxContrast: () => void;
  onSpriteSourceImageChanged: (file: File | null) => Promise<void>;
  onSurfaceRaceTypeChanged: (value: string) => void;
  onSurfaceCategoryChanged: (value: string) => void;
  onSurfaceSizeClassChanged: (value: string) => void;
  onSurfaceProfileChanged: (value: string) => void;
  onGenerateTrackTemplate: () => void;
  onGenerateSpriteSheet: () => Promise<void>;
  onDownloadSpriteSheet: () => void;
  onDownloadSpriteMeta: () => void;
  onBoundaryEditSideChanged: (side: BoundarySideValue) => void;
  onTrackMetadataInput: () => void;
  onEffectProfileInput: () => void;
  onSavePreset: () => Promise<void>;
  onLoadPreset: () => Promise<void>;
  onDeletePreset: () => Promise<void>;
  onPresetSelectChanged: (value: string) => void;
  onCopyJson: () => Promise<void>;
  onDownloadJson: () => void;
  onLoadJson: () => void;
}

export function wireStudioSecondaryControlsController(
  options: WireStudioSecondaryControlsOptions
): void {
  const { controls } = options;

  controls.trackTemplatePointsInput.addEventListener('input', options.onTrackTemplatePointsInput);
  controls.spriteFrameCountInput.addEventListener('input', options.onSpriteFrameCountInput);
  controls.trackPreviewSizeInput.addEventListener('input', options.onTrackPreviewSizeInput);
  controls.spriteVariantCountInput.addEventListener('input', options.onSpriteVariantCountInput);

  controls.spritePresetMinimalButton?.addEventListener('click', options.onSpritePresetMinimal);
  controls.spritePresetBalancedButton?.addEventListener('click', options.onSpritePresetBalanced);
  controls.spritePresetMaxContrastButton?.addEventListener(
    'click',
    options.onSpritePresetMaxContrast
  );

  controls.spriteSourceImageInput.addEventListener('change', () => {
    void options.onSpriteSourceImageChanged(controls.spriteSourceImageInput.files?.[0] ?? null);
  });

  controls.surfaceRaceTypeSelect.addEventListener('change', () => {
    options.onSurfaceRaceTypeChanged(controls.surfaceRaceTypeSelect.value);
  });
  controls.surfaceCategorySelect.addEventListener('change', () => {
    options.onSurfaceCategoryChanged(controls.surfaceCategorySelect.value);
  });
  controls.surfaceSizeClassSelect.addEventListener('change', () => {
    options.onSurfaceSizeClassChanged(controls.surfaceSizeClassSelect.value);
  });
  controls.surfaceProfileSelect.addEventListener('change', () => {
    options.onSurfaceProfileChanged(controls.surfaceProfileSelect.value);
  });

  controls.generateTrackTemplateButton.addEventListener('click', options.onGenerateTrackTemplate);
  controls.generateSpriteSheetButton.addEventListener('click', () => {
    void options.onGenerateSpriteSheet();
  });

  controls.downloadSpriteSheetButton.addEventListener('click', options.onDownloadSpriteSheet);
  controls.downloadSpriteMetaButton.addEventListener('click', options.onDownloadSpriteMeta);

  controls.boundaryEditSideSelect.addEventListener('change', () => {
    options.onBoundaryEditSideChanged(
      controls.boundaryEditSideSelect.value === 'right' ? 'right' : 'left'
    );
  });

  controls.trackIdInput.addEventListener('input', options.onTrackMetadataInput);
  controls.trackNameInput.addEventListener('input', options.onTrackMetadataInput);
  controls.effectProfileInput.addEventListener('input', options.onEffectProfileInput);

  controls.savePresetButton.addEventListener('click', () => {
    void options.onSavePreset();
  });
  controls.loadPresetButton.addEventListener('click', () => {
    void options.onLoadPreset();
  });
  controls.deletePresetButton.addEventListener('click', () => {
    void options.onDeletePreset();
  });
  controls.presetSelect.addEventListener('change', () => {
    options.onPresetSelectChanged(controls.presetSelect.value);
  });

  controls.copyJsonButton.addEventListener('click', () => {
    void options.onCopyJson();
  });
  controls.downloadJsonButton.addEventListener('click', options.onDownloadJson);
  controls.loadJsonButton.addEventListener('click', options.onLoadJson);
}
