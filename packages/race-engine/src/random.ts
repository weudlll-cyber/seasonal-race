/**
 * File: packages/race-engine/src/random.ts
 * Purpose: Provides deterministic and non-deterministic RNG implementations for simulation.
 * Usage: Use createDeterministicRng for seeded races and createSecureRng for non-seeded runs.
 * Dependencies: Node crypto API.
 * Edge cases: Deterministic mode must generate identical sequences for identical seeds.
 */

import { randomBytes } from 'node:crypto';

export interface EngineRng {
  next(): number;
  nextInt(minInclusive: number, maxInclusive: number): number;
}

const UINT32_MAX_PLUS_ONE = 0x1_0000_0000;

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let temp = Math.imul(state ^ (state >>> 15), 1 | state);
    temp ^= temp + Math.imul(temp ^ (temp >>> 7), 61 | temp);

    return ((temp ^ (temp >>> 14)) >>> 0) / UINT32_MAX_PLUS_ONE;
  };
}

function buildRng(nextValue: () => number): EngineRng {
  return {
    next(): number {
      return nextValue();
    },
    nextInt(minInclusive: number, maxInclusive: number): number {
      if (maxInclusive < minInclusive) {
        throw new Error('maxInclusive must be greater than or equal to minInclusive');
      }

      const span = maxInclusive - minInclusive + 1;

      return Math.floor(nextValue() * span) + minInclusive;
    }
  };
}

export function createDeterministicRng(seed: string): EngineRng {
  return buildRng(mulberry32(hashSeed(seed)));
}

export function createSecureRng(): EngineRng {
  const nextValue = (): number => {
    const bytes = randomBytes(4);
    const uint = bytes.readUInt32BE(0);

    return uint / UINT32_MAX_PLUS_ONE;
  };

  return buildRng(nextValue);
}
