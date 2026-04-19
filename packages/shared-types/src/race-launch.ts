/**
 * File: packages/shared-types/src/race-launch.ts
 * Model: GPT-5.3-Codex
 * Purpose: Central launch-request contracts for extensible race-start configuration.
 * Usage: Shared by admin model builders, API validation, and future runtime launch wiring.
 * Dependencies: TypeScript only.
 */

export type LaunchOptionPrimitive = string | number | boolean;

export type LaunchFeatureMap = Record<string, LaunchOptionPrimitive>;

export interface RaceLaunchRequest {
  trackId: string;
  racerListId: string;
  seed?: string;
  durationMs?: number;
  winnerCount?: number;
  brandingProfileId?: string;
  options?: LaunchFeatureMap;
}

export interface RaceLaunchResolvedConfig {
  raceId: string;
  raceType: string;
  trackId: string;
  racerListId: string;
  seed: string;
  durationMs: number;
  winnerCount: number;
  brandingProfileId?: string;
  options: LaunchFeatureMap;
  status: 'scheduled';
}

export interface RaceLaunchConstraints {
  minDurationMs: number;
  maxDurationMs: number;
  defaultDurationMs: number;
  minWinnerCount: number;
  defaultWinnerCount: number;
}

export const DEFAULT_RACE_LAUNCH_CONSTRAINTS: RaceLaunchConstraints = {
  minDurationMs: 5_000,
  maxDurationMs: 300_000,
  defaultDurationMs: 45_000,
  minWinnerCount: 1,
  defaultWinnerCount: 3
};
