/**
 * File: apps/api/src/race-launch-store.ts
 * Model: GPT-5.3-Codex
 * Purpose: Provides pluggable storage for race launch/bootstrap records.
 * Usage: API app uses this abstraction to persist and resolve runtime bootstrap payloads.
 * Dependencies: Node fs/path for optional file-backed storage implementation.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { RuntimeBootstrapPayload } from '../../../packages/shared-types/src/index';

export interface RaceLaunchStore {
  peekNextRaceSequence(): number;
  allocateRaceId(): string;
  saveRuntimeBootstrap(raceId: string, payload: RuntimeBootstrapPayload): void;
  getRuntimeBootstrap(raceId: string): RuntimeBootstrapPayload | undefined;
}

export interface CreateInMemoryRaceLaunchStoreOptions {
  initialRaceSequence?: number;
}

function normalizeRaceSequence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  const parsed = Math.trunc(value);
  return parsed >= 0 ? parsed : 0;
}

export function createInMemoryRaceLaunchStore(
  options: CreateInMemoryRaceLaunchStoreOptions = {}
): RaceLaunchStore {
  const runtimeBootstrapStore = new Map<string, RuntimeBootstrapPayload>();
  let lastRaceSequence = normalizeRaceSequence(options.initialRaceSequence);

  return {
    peekNextRaceSequence() {
      return lastRaceSequence + 1;
    },
    allocateRaceId() {
      lastRaceSequence += 1;
      return `race-${lastRaceSequence}`;
    },
    saveRuntimeBootstrap(raceId, payload) {
      runtimeBootstrapStore.set(raceId, payload);
    },
    getRuntimeBootstrap(raceId) {
      return runtimeBootstrapStore.get(raceId);
    }
  };
}

interface StoredRaceLaunchFileShape {
  lastRaceSequence: number;
  runtimeBootstrapByRaceId: Record<string, RuntimeBootstrapPayload>;
}

export interface CreateFileRaceLaunchStoreOptions {
  storageFilePath: string;
  initialRaceSequence?: number;
}

function readStoreFile(options: CreateFileRaceLaunchStoreOptions): StoredRaceLaunchFileShape {
  const initialRaceSequence = normalizeRaceSequence(options.initialRaceSequence);

  if (!fs.existsSync(options.storageFilePath)) {
    return {
      lastRaceSequence: initialRaceSequence,
      runtimeBootstrapByRaceId: {}
    };
  }

  const raw = fs.readFileSync(options.storageFilePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<StoredRaceLaunchFileShape>;

  return {
    lastRaceSequence: normalizeRaceSequence(parsed.lastRaceSequence ?? initialRaceSequence),
    runtimeBootstrapByRaceId: parsed.runtimeBootstrapByRaceId ?? {}
  };
}

function writeStoreFile(storageFilePath: string, store: StoredRaceLaunchFileShape): void {
  const storageDir = path.dirname(storageFilePath);
  fs.mkdirSync(storageDir, { recursive: true });
  fs.writeFileSync(storageFilePath, JSON.stringify(store, null, 2), 'utf8');
}

export function createFileRaceLaunchStore(
  options: CreateFileRaceLaunchStoreOptions
): RaceLaunchStore {
  return {
    peekNextRaceSequence() {
      const store = readStoreFile(options);
      return store.lastRaceSequence + 1;
    },
    allocateRaceId() {
      const store = readStoreFile(options);
      store.lastRaceSequence += 1;
      writeStoreFile(options.storageFilePath, store);
      return `race-${store.lastRaceSequence}`;
    },
    saveRuntimeBootstrap(raceId, payload) {
      const store = readStoreFile(options);
      store.runtimeBootstrapByRaceId[raceId] = payload;
      writeStoreFile(options.storageFilePath, store);
    },
    getRuntimeBootstrap(raceId) {
      const store = readStoreFile(options);
      return store.runtimeBootstrapByRaceId[raceId];
    }
  };
}
