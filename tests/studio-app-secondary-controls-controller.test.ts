/**
 * File: tests/studio-app-secondary-controls-controller.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for extracted secondary studio controls wiring controller.
 * Usage: Runs with Vitest to ensure DOM events dispatch the expected callbacks.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  wireStudioSecondaryControlsController,
  type WireStudioSecondaryControlsOptions
} from '../apps/web-viewer/src/studio-app-secondary-controls-controller';

type Listener = (event: Event) => void;

class FakeControl {
  value = '';
  files: FileList | null = null;
  private listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: Listener): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ type } as Event);
    }
  }
}

function createOptions(): WireStudioSecondaryControlsOptions {
  const mkInput = () => new FakeControl();
  const mkSelect = () => new FakeControl();
  const mkButton = () => new FakeControl();

  const spriteSourceImageInput = mkInput();

  const controls = {
    trackTemplatePointsInput: mkInput(),
    spriteFrameCountInput: mkInput(),
    trackPreviewSizeInput: mkInput(),
    spriteVariantCountInput: mkInput(),
    spritePresetMinimalButton: mkButton(),
    spritePresetBalancedButton: mkButton(),
    spritePresetMaxContrastButton: mkButton(),
    spriteSourceImageInput,
    surfaceRaceTypeSelect: mkSelect(),
    surfaceCategorySelect: mkSelect(),
    surfaceSizeClassSelect: mkSelect(),
    surfaceProfileSelect: mkSelect(),
    generateTrackTemplateButton: mkButton(),
    generateSpriteSheetButton: mkButton(),
    downloadSpriteSheetButton: mkButton(),
    downloadSpriteMetaButton: mkButton(),
    boundaryEditSideSelect: mkSelect(),
    trackIdInput: mkInput(),
    trackNameInput: mkInput(),
    effectProfileInput: mkInput(),
    savePresetButton: mkButton(),
    loadPresetButton: mkButton(),
    deletePresetButton: mkButton(),
    presetSelect: mkSelect(),
    copyJsonButton: mkButton(),
    downloadJsonButton: mkButton(),
    loadJsonButton: mkButton()
  };

  return {
    controls: controls as unknown as WireStudioSecondaryControlsOptions['controls'],
    onTrackTemplatePointsInput: vi.fn(),
    onSpriteFrameCountInput: vi.fn(),
    onTrackPreviewSizeInput: vi.fn(),
    onSpriteVariantCountInput: vi.fn(),
    onSpritePresetMinimal: vi.fn(),
    onSpritePresetBalanced: vi.fn(),
    onSpritePresetMaxContrast: vi.fn(),
    onSpriteSourceImageChanged: vi.fn(async () => {}),
    onSurfaceRaceTypeChanged: vi.fn(),
    onSurfaceCategoryChanged: vi.fn(),
    onSurfaceSizeClassChanged: vi.fn(),
    onSurfaceProfileChanged: vi.fn(),
    onGenerateTrackTemplate: vi.fn(),
    onGenerateSpriteSheet: vi.fn(async () => {}),
    onDownloadSpriteSheet: vi.fn(),
    onDownloadSpriteMeta: vi.fn(),
    onBoundaryEditSideChanged: vi.fn(),
    onTrackMetadataInput: vi.fn(),
    onEffectProfileInput: vi.fn(),
    onSavePreset: vi.fn(async () => {}),
    onLoadPreset: vi.fn(async () => {}),
    onDeletePreset: vi.fn(async () => {}),
    onPresetSelectChanged: vi.fn(),
    onCopyJson: vi.fn(async () => {}),
    onDownloadJson: vi.fn(),
    onLoadJson: vi.fn()
  };
}

describe('studio app secondary controls controller', () => {
  it('dispatches callback set for synchronous controls', () => {
    const options = createOptions();
    wireStudioSecondaryControlsController(options);

    (options.controls.trackTemplatePointsInput as unknown as FakeControl).dispatch('input');
    (options.controls.spriteFrameCountInput as unknown as FakeControl).dispatch('input');
    (options.controls.trackPreviewSizeInput as unknown as FakeControl).dispatch('input');
    (options.controls.spriteVariantCountInput as unknown as FakeControl).dispatch('input');
    (options.controls.spritePresetMinimalButton as unknown as FakeControl).dispatch('click');
    (options.controls.spritePresetBalancedButton as unknown as FakeControl).dispatch('click');
    (options.controls.spritePresetMaxContrastButton as unknown as FakeControl).dispatch('click');

    options.controls.surfaceRaceTypeSelect.value = 'duck-race';
    (options.controls.surfaceRaceTypeSelect as unknown as FakeControl).dispatch('change');
    options.controls.surfaceCategorySelect.value = 'bird';
    (options.controls.surfaceCategorySelect as unknown as FakeControl).dispatch('change');
    options.controls.surfaceSizeClassSelect.value = 'small';
    (options.controls.surfaceSizeClassSelect as unknown as FakeControl).dispatch('change');
    options.controls.surfaceProfileSelect.value = 'water-calm';
    (options.controls.surfaceProfileSelect as unknown as FakeControl).dispatch('change');

    (options.controls.generateTrackTemplateButton as unknown as FakeControl).dispatch('click');
    (options.controls.downloadSpriteSheetButton as unknown as FakeControl).dispatch('click');
    (options.controls.downloadSpriteMetaButton as unknown as FakeControl).dispatch('click');

    options.controls.boundaryEditSideSelect.value = 'right';
    (options.controls.boundaryEditSideSelect as unknown as FakeControl).dispatch('change');

    (options.controls.trackIdInput as unknown as FakeControl).dispatch('input');
    (options.controls.trackNameInput as unknown as FakeControl).dispatch('input');
    (options.controls.effectProfileInput as unknown as FakeControl).dispatch('input');

    options.controls.presetSelect.value = 'preset-a';
    (options.controls.presetSelect as unknown as FakeControl).dispatch('change');

    (options.controls.downloadJsonButton as unknown as FakeControl).dispatch('click');
    (options.controls.loadJsonButton as unknown as FakeControl).dispatch('click');

    expect(options.onTrackTemplatePointsInput).toHaveBeenCalledTimes(1);
    expect(options.onSpriteFrameCountInput).toHaveBeenCalledTimes(1);
    expect(options.onTrackPreviewSizeInput).toHaveBeenCalledTimes(1);
    expect(options.onSpriteVariantCountInput).toHaveBeenCalledTimes(1);
    expect(options.onSpritePresetMinimal).toHaveBeenCalledTimes(1);
    expect(options.onSpritePresetBalanced).toHaveBeenCalledTimes(1);
    expect(options.onSpritePresetMaxContrast).toHaveBeenCalledTimes(1);
    expect(options.onSurfaceRaceTypeChanged).toHaveBeenCalledWith('duck-race');
    expect(options.onSurfaceCategoryChanged).toHaveBeenCalledWith('bird');
    expect(options.onSurfaceSizeClassChanged).toHaveBeenCalledWith('small');
    expect(options.onSurfaceProfileChanged).toHaveBeenCalledWith('water-calm');
    expect(options.onGenerateTrackTemplate).toHaveBeenCalledTimes(1);
    expect(options.onDownloadSpriteSheet).toHaveBeenCalledTimes(1);
    expect(options.onDownloadSpriteMeta).toHaveBeenCalledTimes(1);
    expect(options.onBoundaryEditSideChanged).toHaveBeenCalledWith('right');
    expect(options.onTrackMetadataInput).toHaveBeenCalledTimes(2);
    expect(options.onEffectProfileInput).toHaveBeenCalledTimes(1);
    expect(options.onPresetSelectChanged).toHaveBeenCalledWith('preset-a');
    expect(options.onDownloadJson).toHaveBeenCalledTimes(1);
    expect(options.onLoadJson).toHaveBeenCalledTimes(1);
  });

  it('dispatches async callbacks for async-bound controls', () => {
    const options = createOptions();
    wireStudioSecondaryControlsController(options);

    (options.controls.spriteSourceImageInput as unknown as FakeControl).dispatch('change');
    (options.controls.generateSpriteSheetButton as unknown as FakeControl).dispatch('click');
    (options.controls.savePresetButton as unknown as FakeControl).dispatch('click');
    (options.controls.loadPresetButton as unknown as FakeControl).dispatch('click');
    (options.controls.deletePresetButton as unknown as FakeControl).dispatch('click');
    (options.controls.copyJsonButton as unknown as FakeControl).dispatch('click');

    expect(options.onSpriteSourceImageChanged).toHaveBeenCalledTimes(1);
    expect(options.onSpriteSourceImageChanged).toHaveBeenCalledWith(null);
    expect(options.onGenerateSpriteSheet).toHaveBeenCalledTimes(1);
    expect(options.onSavePreset).toHaveBeenCalledTimes(1);
    expect(options.onLoadPreset).toHaveBeenCalledTimes(1);
    expect(options.onDeletePreset).toHaveBeenCalledTimes(1);
    expect(options.onCopyJson).toHaveBeenCalledTimes(1);
  });
});
