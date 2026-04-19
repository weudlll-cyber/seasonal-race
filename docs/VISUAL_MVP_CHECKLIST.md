# Visual MVP Checklist

This checklist defines the minimum visual scope for a good-looking race broadcast with lightweight implementation complexity.

## Primary Goal

- Keep movement readable, smooth, and lively.
- Keep art workload low enough for non-graphics-heavy workflows.
- Avoid deep gameplay mechanics; focus on visual race presentation.

## Locked View Decision

- Use top-down (bird-eye) race presentation for MVP.
- Keep frontal/side cinematic racer views out of MVP scope.

Reasoning:

- Current track authoring, runtime path mapping, and camera systems are already built around top-down geometry.
- Top-down requires less art complexity and reduces animation risk.

## Must Have (MVP Required)

1. Top-down race background aligned with authored track curves.
2. Smooth racer movement on path points from runtime bootstrap payload.
3. Runtime camera flow:
   - intro overview,
   - leader follow,
   - light zoom pulses,
   - finish overview.
4. Clear overlays:
   - leader labels,
   - top leaderboard,
   - finish readability.
5. Minimal visual polish:
   - simple racer marker/sprite,
   - finish line marker,
   - one subtle ambient motion layer (for example scrolling water/ground texture).

## Optional (Post-MVP)

1. Full multi-layer particle stacks per race type.
2. Distortion-heavy surface effects for all environments.
3. Rich per-event burst VFX and obstacle-specific animations.
4. High-detail multi-state sprite-sheet character animation sets.
5. Frontal/side cinematic camera experiments.

## Asset Starter Pack (Non-Expert Friendly)

1. One wide background image per race type (or one shared temporary fallback).
2. One simple racer visual style (marker circle or basic sprite).
3. One finish-line marker asset.
4. Optional tiny particle texture reused across effects.

This is enough to achieve animated, watchable races when movement and camera timing are strong.

## Definition Of Done For Visual MVP

1. Runtime races launch from Ops/Admin and move on payload-provided track geometry.
2. Camera transitions are smooth and stable in runtime playback.
3. Racers remain readable during dense moments (labels and leaderboard stay useful).
4. No visual jitter regressions at finish/coast phases.
5. At least one race type looks production-like in a short demo capture.
