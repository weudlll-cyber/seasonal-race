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

## Low-Effort Tooling Suggestions

Use this stack to improve visual quality quickly without a heavy art pipeline:

1. Krita (open source): fast painting and texture creation for backgrounds, water, and dirt details.
2. Inkscape (open source): clean finish-line markers, icons, and vector overlays.
3. Blender (open source): optional helper for quick top-down scene drafts and lighting references.
4. GIMP (open source): fast image cleanup, color tuning, and export optimization.
5. Penpot (open source): lightweight UI mockups for overlays and leaderboard layout before coding.

Recommended minimal workflow:

1. Sketch top-down scene in Krita.
2. Build clean overlay icons in Inkscape.
3. Tune colors and export final PNG/WebP assets in GIMP.
4. Use Penpot only for quick overlay composition checks.

## Open-Source Animation Software (Security-Focused)

No software can be guaranteed perfectly secure forever, but the following tools are widely used, actively maintained, and generally considered safe choices when installed correctly from official sources.

1. Blender
   - Best for: camera path previews, simple animation tests, and rendering helper references.
   - Why it is a strong security choice: very large community, frequent updates, transparent development, and strong scrutiny.
2. Synfig Studio
   - Best for: 2D keyframe animation and lightweight motion elements.
   - Why it is useful here: can produce subtle animated overlays without complex pipelines.
3. OpenToonz
   - Best for: traditional 2D animation workflows and frame-by-frame stylized motion.
   - Why it is useful here: good for short decorative animation loops.
4. Krita (animation timeline)
   - Best for: small hand-drawn animation loops and texture motion.
   - Why it is useful here: one tool for both painting and basic animation.

## Security Rules For Tool Installation

1. Install only from official project websites or official package repositories.
2. Verify checksums/signatures when provided by the project.
3. Keep tools updated (security patches first, feature updates second).
4. Do not install random plugins from unknown publishers.
5. Run asset tools with standard user rights (not administrator).
6. Keep project dependencies and build pipeline checks active (`ci:full`) before release.

## Definition Of Done For Visual MVP

1. Runtime races launch from Ops/Admin and move on payload-provided track geometry.
2. Camera transitions are smooth and stable in runtime playback.
3. Racers remain readable during dense moments (labels and leaderboard stay useful).
4. No visual jitter regressions at finish/coast phases.
5. At least one race type looks production-like in a short demo capture.
