/**
 * File: tests/studio-replay-racer-lifecycle.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for studio replay-racer lifecycle helpers.
 * Usage: Runs with Vitest to ensure rebuild and scale policy remain stable.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  applyReplaySpriteSizeToRacers,
  rebuildStudioReplayRacersState
} from '../apps/web-viewer/src/studio-replay-racer-lifecycle';

describe('studio replay racer lifecycle', () => {
  it('applies target preview size scaling using base sprite scales', () => {
    const setA = vi.fn();
    const setB = vi.fn();

    applyReplaySpriteSizeToRacers({
      replayRacers: [
        {
          bodyBaseScaleX: 1.5,
          bodyBaseScaleY: 1.2,
          bodySprite: { scale: { x: 1.5, y: 1.2, set: setA } }
        },
        {
          bodySprite: { scale: { x: 0.8, y: 0.6, set: setB } }
        },
        {}
      ],
      targetSizePx: 68,
      baseSizePx: 34
    });

    expect(setA).toHaveBeenCalledWith(3, 2.4);
    expect(setB).toHaveBeenCalledWith(1.6, 1.2);
  });

  it('rebuilds replay racer state and normalizes focus racer', () => {
    const rebuiltRacers = [{ sprite: { visible: true } }] as unknown as Parameters<
      typeof rebuildStudioReplayRacersState
    >[0]['replayRacers'];
    const rebuiltCache = {
      fallbackRuntimeRacerPack: null,
      fallbackRuntimeRacerPackKey: 'cache-key'
    };

    const rebuildReplayRacerViewsFn = vi.fn(() => ({
      replayRacers: rebuiltRacers,
      runtimeRacerPackCache: rebuiltCache
    }));
    const normalizeFocusRacerNumberFn = vi.fn(() => 3);

    const result = rebuildStudioReplayRacersState(
      {
        replayRacers: [] as unknown as Parameters<
          typeof rebuildStudioReplayRacersState
        >[0]['replayRacers'],
        replayRacerCount: 12,
        runnerLayer: {} as Parameters<typeof rebuildStudioReplayRacersState>[0]['runnerLayer'],
        labelLayer: {} as Parameters<typeof rebuildStudioReplayRacersState>[0]['labelLayer'],
        generatedRacerPack: null,
        runtimeRacerPackCache: {
          fallbackRuntimeRacerPack: null,
          fallbackRuntimeRacerPackKey: ''
        },
        defaultRuntimePackFrameCount: 10,
        focusRacerNumber: 99
      },
      {
        rebuildReplayRacerViewsFn,
        normalizeFocusRacerNumberFn
      }
    );

    expect(rebuildReplayRacerViewsFn).toHaveBeenCalledTimes(1);
    expect(normalizeFocusRacerNumberFn).toHaveBeenCalledWith(99, 12);
    expect(result.replayRacers).toBe(rebuiltRacers);
    expect(result.runtimeRacerPackCache).toBe(rebuiltCache);
    expect(result.focusRacerNumber).toBe(3);
  });
});
