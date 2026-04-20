/**
 * File: apps/web-viewer/src/studio-replay-racer-lifecycle.ts
 * Model: GPT-5.3-Codex
 * Purpose: Provides shared replay-racer rebuild and size-scaling lifecycle helpers for studio mode.
 * Usage: Imported by studio-app to keep replay-racer lifecycle policy out of composition flow.
 */

import type { Container } from 'pixi.js';
import { normalizeFocusRacerNumber } from './replay-visual-policy.js';
import { rebuildReplayRacerViews } from './studio-replay-racer-builder.js';
import type { GeneratedRacerSpritePack } from './studio-generators.js';
import type { RuntimeRacerPackCache } from './studio-racer-pack-utils.js';

type RebuildReplayRacerViewsInput = Parameters<typeof rebuildReplayRacerViews>[0];
type RebuildReplayRacerViewsResult = ReturnType<typeof rebuildReplayRacerViews>;

type ReplayRacerViewLike = RebuildReplayRacerViewsInput['replayRacers'][number] &
  ReplayRacerScaleView;

interface ReplayRacerScaleView {
  bodySprite?: {
    scale: {
      x: number;
      y: number;
      set: (x: number, y: number) => void;
    };
  };
  bodyBaseScaleX?: number;
  bodyBaseScaleY?: number;
}

interface ApplyReplaySpriteSizeInput {
  replayRacers: ReplayRacerScaleView[];
  targetSizePx: number;
  baseSizePx?: number;
}

export function applyReplaySpriteSizeToRacers(input: ApplyReplaySpriteSizeInput): void {
  const baseSizePx = input.baseSizePx ?? 34;
  const sizeFactor = input.targetSizePx / baseSizePx;

  for (const racer of input.replayRacers) {
    if (!racer.bodySprite) continue;
    const baseX = racer.bodyBaseScaleX ?? racer.bodySprite.scale.x;
    const baseY = racer.bodyBaseScaleY ?? racer.bodySprite.scale.y;
    racer.bodySprite.scale.set(baseX * sizeFactor, baseY * sizeFactor);
  }
}

interface RebuildStudioReplayRacersInput {
  replayRacers: ReplayRacerViewLike[];
  replayRacerCount: number;
  runnerLayer: Container;
  labelLayer: Container;
  generatedRacerPack: GeneratedRacerSpritePack | null;
  runtimeRacerPackCache: RuntimeRacerPackCache;
  defaultRuntimePackFrameCount: number;
  focusRacerNumber: number;
}

interface RebuildStudioReplayRacersResult {
  replayRacers: ReplayRacerViewLike[];
  runtimeRacerPackCache: RuntimeRacerPackCache;
  focusRacerNumber: number;
}

interface RebuildDeps {
  rebuildReplayRacerViewsFn?: (
    input: RebuildReplayRacerViewsInput
  ) => RebuildReplayRacerViewsResult;
  normalizeFocusRacerNumberFn?: (value: number, racerCount: number) => number;
}

export function rebuildStudioReplayRacersState(
  input: RebuildStudioReplayRacersInput,
  deps: RebuildDeps = {}
): RebuildStudioReplayRacersResult {
  const rebuildReplayRacerViewsFn = deps.rebuildReplayRacerViewsFn ?? rebuildReplayRacerViews;
  const normalizeFocusRacerNumberFn = deps.normalizeFocusRacerNumberFn ?? normalizeFocusRacerNumber;

  const rebuilt = rebuildReplayRacerViewsFn({
    replayRacers: input.replayRacers,
    replayRacerCount: input.replayRacerCount,
    runnerLayer: input.runnerLayer,
    labelLayer: input.labelLayer,
    generatedRacerPack: input.generatedRacerPack,
    runtimeRacerPackCache: input.runtimeRacerPackCache,
    defaultRuntimePackFrameCount: input.defaultRuntimePackFrameCount
  });

  return {
    replayRacers: rebuilt.replayRacers,
    runtimeRacerPackCache: rebuilt.runtimeRacerPackCache,
    focusRacerNumber: normalizeFocusRacerNumberFn(input.focusRacerNumber, input.replayRacerCount)
  };
}
