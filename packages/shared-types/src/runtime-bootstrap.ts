/**
 * File: packages/shared-types/src/runtime-bootstrap.ts
 * Model: GPT-5.3-Codex
 * Purpose: Shared runtime bootstrap payload contracts for viewer initialization.
 * Usage: API responses and runtime viewer client both rely on this shape.
 * Dependencies: race-launch and track-point contracts.
 */

import type { RaceLaunchResolvedConfig } from './race-launch';
import type { TrackPoint } from './index';

export interface RuntimeBootstrapTrack {
  id: string;
  name: string;
  length: number;
  points: TrackPoint[];
  pointCount: number;
  effectProfileId?: string;
}

export interface RuntimeBootstrapRacerList {
  id: string;
  name: string;
  racerCount: number;
}

export interface RuntimeBootstrapPayload {
  raceId: string;
  raceType: string;
  launch: RaceLaunchResolvedConfig;
  track: RuntimeBootstrapTrack;
  racerList: RuntimeBootstrapRacerList;
}
