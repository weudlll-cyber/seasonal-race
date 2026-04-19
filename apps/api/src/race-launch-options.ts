/**
 * File: apps/api/src/race-launch-options.ts
 * Model: GPT-5.3-Codex
 * Purpose: Validates and resolves extensible race-launch options for API start requests.
 * Usage: Called by the start-race route to produce normalized launch configuration.
 * Dependencies: Shared launch contracts.
 */

import {
  DEFAULT_RACE_LAUNCH_CONSTRAINTS,
  type LaunchFeatureMap,
  type LaunchOptionPrimitive,
  type RaceLaunchConstraints
} from '../../../packages/shared-types/src/index';

export type RaceLaunchValidationErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_OPTION_RANGE'
  | 'CATALOG_ENTRY_NOT_FOUND'
  | 'RACE_TYPE_MISMATCH';

export interface StartRaceInputBody {
  trackId?: unknown;
  racerListId?: unknown;
  seed?: unknown;
  durationMs?: unknown;
  winnerCount?: unknown;
  brandingProfileId?: unknown;
  options?: unknown;
}

export interface ResolvedRaceLaunchOptions {
  seed: string;
  durationMs: number;
  winnerCount: number;
  brandingProfileId?: string;
  options: LaunchFeatureMap;
}

export interface RaceLaunchOptionContext {
  input: StartRaceInputBody;
  racerCount: number;
  autoSeed: string;
  constraints?: RaceLaunchConstraints;
}

export type RaceLaunchOptionResult =
  | { ok: true; value: ResolvedRaceLaunchOptions }
  | { ok: false; code: RaceLaunchValidationErrorCode; message: string };

interface OptionResolver<TValue> {
  key: string;
  resolve: (
    context: RaceLaunchOptionContext
  ) =>
    | { ok: true; value: TValue }
    | { ok: false; code: RaceLaunchValidationErrorCode; message: string };
}

const resolveSeed: OptionResolver<string> = {
  key: 'seed',
  resolve: (context) => {
    const rawSeed = context.input.seed;
    if (typeof rawSeed === 'string' && rawSeed.trim().length > 0) {
      return { ok: true, value: rawSeed.trim() };
    }
    return { ok: true, value: context.autoSeed };
  }
};

const resolveDurationMs: OptionResolver<number> = {
  key: 'durationMs',
  resolve: (context) => {
    const constraints = context.constraints ?? DEFAULT_RACE_LAUNCH_CONSTRAINTS;
    const rawDuration = context.input.durationMs;

    if (rawDuration === undefined) {
      return { ok: true, value: constraints.defaultDurationMs };
    }

    if (typeof rawDuration !== 'number' || !Number.isFinite(rawDuration)) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: 'durationMs must be a finite number when provided.'
      };
    }

    const durationMs = Math.trunc(rawDuration);

    if (durationMs < constraints.minDurationMs || durationMs > constraints.maxDurationMs) {
      return {
        ok: false,
        code: 'INVALID_OPTION_RANGE',
        message: `durationMs must be between ${constraints.minDurationMs} and ${constraints.maxDurationMs}.`
      };
    }

    return { ok: true, value: durationMs };
  }
};

const resolveWinnerCount: OptionResolver<number> = {
  key: 'winnerCount',
  resolve: (context) => {
    const constraints = context.constraints ?? DEFAULT_RACE_LAUNCH_CONSTRAINTS;
    const rawWinnerCount = context.input.winnerCount;

    if (rawWinnerCount !== undefined && !Number.isInteger(rawWinnerCount)) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: 'winnerCount must be an integer when provided.'
      };
    }

    const winnerCount =
      typeof rawWinnerCount === 'number' ? rawWinnerCount : constraints.defaultWinnerCount;

    const maxWinnerCount = Math.max(constraints.minWinnerCount, context.racerCount);

    if (winnerCount < constraints.minWinnerCount || winnerCount > maxWinnerCount) {
      return {
        ok: false,
        code: 'INVALID_OPTION_RANGE',
        message: `winnerCount must be between ${constraints.minWinnerCount} and ${maxWinnerCount}.`
      };
    }

    return { ok: true, value: winnerCount };
  }
};

const resolveBrandingProfileId: OptionResolver<string | undefined> = {
  key: 'brandingProfileId',
  resolve: (context) => {
    const rawBranding = context.input.brandingProfileId;

    if (rawBranding === undefined) {
      return { ok: true, value: undefined };
    }

    if (typeof rawBranding !== 'string' || rawBranding.trim().length === 0) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: 'brandingProfileId must be a non-empty string when provided.'
      };
    }

    return { ok: true, value: rawBranding.trim() };
  }
};

const resolveOptions: OptionResolver<LaunchFeatureMap> = {
  key: 'options',
  resolve: (context) => {
    const rawOptions = context.input.options;

    if (rawOptions === undefined) {
      return { ok: true, value: {} };
    }

    if (typeof rawOptions !== 'object' || rawOptions === null || Array.isArray(rawOptions)) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: 'options must be an object when provided.'
      };
    }

    const normalizedOptions: LaunchFeatureMap = {};
    for (const [key, value] of Object.entries(rawOptions as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        normalizedOptions[key] = value as LaunchOptionPrimitive;
        continue;
      }

      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: `options.${key} must be a string, number, or boolean.`
      };
    }

    return { ok: true, value: normalizedOptions };
  }
};

export function resolveRaceLaunchOptions(context: RaceLaunchOptionContext): RaceLaunchOptionResult {
  const seed = resolveSeed.resolve(context);
  if (!seed.ok) return seed;

  const durationMs = resolveDurationMs.resolve(context);
  if (!durationMs.ok) return durationMs;

  const winnerCount = resolveWinnerCount.resolve(context);
  if (!winnerCount.ok) return winnerCount;

  const brandingProfileId = resolveBrandingProfileId.resolve(context);
  if (!brandingProfileId.ok) return brandingProfileId;

  const options = resolveOptions.resolve(context);
  if (!options.ok) return options;

  return {
    ok: true,
    value: {
      seed: seed.value,
      durationMs: durationMs.value,
      winnerCount: winnerCount.value,
      ...(brandingProfileId.value !== undefined
        ? { brandingProfileId: brandingProfileId.value }
        : {}),
      options: options.value
    }
  };
}
