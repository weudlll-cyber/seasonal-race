/**
 * File: apps/web-viewer/src/viewer-model.ts
 * Purpose: Drives the race simulation loop and maps engine state to viewer state.
 *          Decouples the race engine tick from the PixiJS render tick.
 * Usage:
 *   const model = createViewerModel(session, track)
 *   model.start()
 *   // In your animation loop: const state = model.getState()
 * Dependencies: race-engine session contracts, shared-types.
 * Edge cases:
 *   - Simulation ticks at a fixed 100ms step regardless of render frame rate.
 *   - After finalize() is called the model freezes — getState() keeps returning
 *     the last state so the camera can animate to overview smoothly.
 */

import type { RaceSession } from '@sr/race-engine';
import type { Participant, TrackDefinition } from '@sr/shared-types';
import { interpolatePosition } from '@sr/race-engine';
import type { CameraState, CameraRacerState } from './camera';

/** Fixed simulation step in milliseconds. */
const SIM_STEP_MS = 100;

export interface ViewerRacerState {
  participantId: string;
  progress: number;
  finished: boolean;
  rank: number | null;
}

export interface ViewerRaceState {
  racers: ViewerRacerState[];
  finished: boolean;
  elapsedMs: number;
  /** Camera-ready state derived from racers array. */
  camera: CameraState;
}

export interface ViewerModel {
  /** Start the simulation clock. */
  start(): void;
  /** Stop the simulation clock (e.g. when tab is hidden). */
  stop(): void;
  /** Advance simulation by realDeltaMs milliseconds of real time. */
  tick(realDeltaMs: number): void;
  /** Current viewer state — safe to call every render frame. */
  getState(): ViewerRaceState;
}

/**
 * Creates a ViewerModel that wraps a RaceSession.
 * The model accumulates real elapsed time and fires fixed 100ms engine ticks.
 */
export function createViewerModel(session: RaceSession, track: TrackDefinition): ViewerModel {
  let accumulated = 0;
  let running = false;
  let finished = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  // Racer progress map — updated on every engine tick
  const progressMap = new Map<string, number>();
  const finishedMap = new Map<string, boolean>();
  const rankMap = new Map<string, number>();

  // Initialise all racers at progress 0
  for (const p of session.config.participants) {
    progressMap.set(p.id, 0);
    finishedMap.set(p.id, false);
  }

  function advanceSim(): void {
    if (finished) return;

    accumulated += SIM_STEP_MS;
    const result = session.advanceTick(SIM_STEP_MS);

    // Extract duck.tick event positions if present
    for (const event of result.events) {
      if (event.type === 'duck.tick') {
        const positions = (event.payload as { positions?: unknown[] }).positions;
        if (Array.isArray(positions)) {
          for (const entry of positions) {
            const e = entry as { participantId: string; progress: number; finished: boolean };
            progressMap.set(e.participantId, e.progress);
            finishedMap.set(e.participantId, e.finished);
          }
        }
      }
    }

    if (result.finished) {
      finished = true;
      const raceResult = session.finalize();
      for (const placement of raceResult.placements) {
        rankMap.set(placement.participantId, placement.rank);
      }
      stop();
    }
  }

  function start(): void {
    if (running) return;
    running = true;
    intervalId = setInterval(advanceSim, SIM_STEP_MS);
  }

  function stop(): void {
    running = false;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function tick(_realDeltaMs: number): void {
    // tick() is available for manual advance (e.g. tests or step-through mode)
    // In auto mode the setInterval drives advanceSim; this is a no-op
  }

  function getState(): ViewerRaceState {
    const racerStates: ViewerRacerState[] = session.config.participants.map((p: Participant) => ({
      participantId: p.id,
      progress: progressMap.get(p.id) ?? 0,
      finished: finishedMap.get(p.id) ?? false,
      rank: rankMap.get(p.id) ?? null
    }));

    const cameraRacers: CameraRacerState[] = racerStates.map((r) => ({
      progress: r.progress,
      position: interpolatePosition(track.points, r.progress)
    }));

    return {
      racers: racerStates,
      finished,
      elapsedMs: accumulated,
      camera: {
        racers: cameraRacers,
        finished,
        elapsedSeconds: accumulated / 1000,
        ...(session.config.cameraSettings
          ? { cameraSettings: session.config.cameraSettings }
          : {})
      }
    };
  }

  return { start, stop, tick, getState };
}
