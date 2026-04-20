/**
 * File: apps/web-viewer/src/studio-replay-racer-builder.ts
 * Model: GPT-5.3-Codex
 * Purpose: Builds and resets replay racer view containers for studio replay mode.
 * Usage: Imported by studio-app when replay racer count or sprite pack state changes.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { createRacerIds } from './replay-visual-policy.js';
import {
  createRacerSpriteFromPack,
  resolveRuntimeRacerPack,
  type RuntimeRacerPackCache
} from './studio-racer-pack-utils.js';
import type { GeneratedRacerSpritePack } from './studio-generators.js';
import type { StudioReplayRacerView } from './studio-replay-controller.js';

interface RebuildReplayRacerViewsInput {
  replayRacers: StudioReplayRacerView[];
  replayRacerCount: number;
  runnerLayer: Container;
  labelLayer: Container;
  generatedRacerPack: GeneratedRacerSpritePack | null;
  runtimeRacerPackCache: RuntimeRacerPackCache;
  defaultRuntimePackFrameCount: number;
}

interface RebuildReplayRacerViewsResult {
  replayRacers: StudioReplayRacerView[];
  runtimeRacerPackCache: RuntimeRacerPackCache;
}

export function rebuildReplayRacerViews(
  input: RebuildReplayRacerViewsInput
): RebuildReplayRacerViewsResult {
  const {
    replayRacers,
    replayRacerCount,
    runnerLayer,
    labelLayer,
    generatedRacerPack,
    runtimeRacerPackCache,
    defaultRuntimePackFrameCount
  } = input;

  for (const rr of replayRacers) {
    runnerLayer.removeChild(rr.sprite);
    labelLayer.removeChild(rr.labelBg);
    labelLayer.removeChild(rr.labelText);
    rr.labelBg.destroy();
    rr.labelText.destroy();
    rr.sprite.destroy();
  }

  const ids = createRacerIds(replayRacerCount);
  const runtimePackResolution = resolveRuntimeRacerPack({
    requiredRacerCount: replayRacerCount,
    generatedRacerPack,
    runtimeRacerPackCache,
    defaultRuntimePackFrameCount
  });
  const runtimeRacerPack = runtimePackResolution.runtimeRacerPack;

  const markerRadius =
    replayRacerCount >= 90 ? 4 : replayRacerCount >= 70 ? 5 : replayRacerCount >= 45 ? 6 : 9;
  const labelFontSize =
    replayRacerCount >= 90 ? 7 : replayRacerCount >= 70 ? 8 : replayRacerCount >= 45 ? 9 : 11;

  const nextReplayRacers = ids.map((id, index) => {
    const racer = new Container();
    const bodySprite = createRacerSpriteFromPack(runtimeRacerPack, index, markerRadius * 2.6);
    racer.addChild(bodySprite);

    const marker = new Graphics();
    marker.beginFill(0xffffff, 0.01);
    marker.drawCircle(0, 0, markerRadius);
    marker.endFill();
    racer.addChild(marker);

    const labelText = new Text(`D${index + 1}`, {
      fontFamily: 'Segoe UI',
      fontSize: labelFontSize,
      fill: 0xffffff,
      stroke: 0x001018,
      strokeThickness: 2
    });
    labelText.anchor.set(0.5, 1);

    const padX = 5;
    const padY = 2;
    const labelBg = new Graphics();
    labelBg.beginFill(0x0e2231, 0.88);
    labelBg.lineStyle(1, 0x8ab9ff, 0.7);
    labelBg.drawRoundedRect(
      -labelText.width / 2 - padX,
      -labelText.height - padY * 2,
      labelText.width + padX * 2,
      labelText.height + padY * 2,
      4
    );
    labelBg.endFill();
    labelBg.y = -markerRadius - 2;
    labelText.y = -markerRadius - 2;
    labelBg.visible = false;
    labelText.visible = false;

    labelLayer.addChild(labelBg);
    labelLayer.addChild(labelText);
    racer.visible = false;
    racer.eventMode = 'static';

    const view: StudioReplayRacerView = {
      id,
      index,
      sprite: racer,
      marker,
      bodySprite,
      bodyBaseScaleX: bodySprite.scale.x,
      bodyBaseScaleY: bodySprite.scale.y,
      labelBg,
      labelText,
      progress: 0,
      hovered: false
    };

    racer.on('pointerover', () => {
      view.hovered = true;
    });
    racer.on('pointerout', () => {
      view.hovered = false;
    });

    runnerLayer.addChild(racer);
    return view;
  });

  return {
    replayRacers: nextReplayRacers,
    runtimeRacerPackCache: runtimePackResolution.runtimeRacerPackCache
  };
}
