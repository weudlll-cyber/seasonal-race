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
  schemaVersion: number;
  lastRaceSequence: number;
  runtimeBootstrapByRaceId: Record<string, RuntimeBootstrapPayload>;
  runtimeBootstrapSavedAtByRaceId: Record<string, number>;
}

export interface CreateFileRaceLaunchStoreOptions {
  storageFilePath: string;
  initialRaceSequence?: number;
  maxStoredRaceBootstraps?: number;
  maxStoredRaceBootstrapAgeMs?: number;
  nowEpochMsProvider?: () => number;
  strictDurability?: boolean;
}

const raceLaunchStoreSchemaVersion = 2;
const raceLaunchStoreBackupSuffix = '.bak';
const raceLaunchStoreTempSuffix = '.tmp';
const defaultMaxStoredRaceBootstraps = 500;

interface RaceLaunchStoreRetentionPolicy {
  maxStoredRaceBootstraps: number;
  maxStoredRaceBootstrapAgeMs: number | undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeRuntimeBootstrapByRaceId(
  value: unknown
): Record<string, RuntimeBootstrapPayload> {
  if (!isObjectRecord(value)) {
    return {};
  }

  return value as Record<string, RuntimeBootstrapPayload>;
}

function normalizeSavedAtByRaceId(value: unknown): Record<string, number> {
  if (!isObjectRecord(value)) {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [raceId, savedAt] of Object.entries(value)) {
    if (typeof savedAt === 'number' && Number.isFinite(savedAt) && savedAt >= 0) {
      normalized[raceId] = savedAt;
    }
  }

  return normalized;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const parsed = Math.trunc(value);
  return parsed > 0 ? parsed : fallback;
}

function normalizeOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  const parsed = Math.trunc(value);
  return parsed > 0 ? parsed : undefined;
}

function resolveRetentionPolicy(
  options: CreateFileRaceLaunchStoreOptions
): RaceLaunchStoreRetentionPolicy {
  return {
    maxStoredRaceBootstraps: normalizePositiveInteger(
      options.maxStoredRaceBootstraps,
      defaultMaxStoredRaceBootstraps
    ),
    maxStoredRaceBootstrapAgeMs: normalizeOptionalPositiveInteger(
      options.maxStoredRaceBootstrapAgeMs
    )
  };
}

function resolveNowEpochMsProvider(options: CreateFileRaceLaunchStoreOptions): () => number {
  if (typeof options.nowEpochMsProvider === 'function') {
    return options.nowEpochMsProvider;
  }

  return () => Date.now();
}

function resolveStrictDurability(options: CreateFileRaceLaunchStoreOptions): boolean {
  return options.strictDurability === true;
}

function parseRaceSequenceFromId(raceId: string): number {
  const match = /^race-(\d+)$/.exec(raceId);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  const sequenceText = match[1] ?? '';
  const sequence = Number.parseInt(sequenceText, 10);
  return Number.isFinite(sequence) ? sequence : Number.MAX_SAFE_INTEGER;
}

function applyRetentionPolicy(
  store: StoredRaceLaunchFileShape,
  policy: RaceLaunchStoreRetentionPolicy,
  nowEpochMs: number
): { store: StoredRaceLaunchFileShape; changed: boolean } {
  const runtimeBootstrapByRaceId = { ...store.runtimeBootstrapByRaceId };
  const runtimeBootstrapSavedAtByRaceId = { ...store.runtimeBootstrapSavedAtByRaceId };
  let changed = false;

  for (const raceId of Object.keys(runtimeBootstrapSavedAtByRaceId)) {
    if (!(raceId in runtimeBootstrapByRaceId)) {
      delete runtimeBootstrapSavedAtByRaceId[raceId];
      changed = true;
    }
  }

  if (policy.maxStoredRaceBootstrapAgeMs !== undefined) {
    for (const raceId of Object.keys(runtimeBootstrapByRaceId)) {
      const savedAt = runtimeBootstrapSavedAtByRaceId[raceId] ?? 0;
      if (nowEpochMs - savedAt > policy.maxStoredRaceBootstrapAgeMs) {
        delete runtimeBootstrapByRaceId[raceId];
        delete runtimeBootstrapSavedAtByRaceId[raceId];
        changed = true;
      }
    }
  }

  const raceIds = Object.keys(runtimeBootstrapByRaceId);
  if (raceIds.length > policy.maxStoredRaceBootstraps) {
    const removableRaceIds = [...raceIds]
      .sort((leftId, rightId) => {
        const leftSavedAt = runtimeBootstrapSavedAtByRaceId[leftId] ?? 0;
        const rightSavedAt = runtimeBootstrapSavedAtByRaceId[rightId] ?? 0;

        if (leftSavedAt !== rightSavedAt) {
          return leftSavedAt - rightSavedAt;
        }

        return parseRaceSequenceFromId(leftId) - parseRaceSequenceFromId(rightId);
      })
      .slice(0, raceIds.length - policy.maxStoredRaceBootstraps);

    for (const raceId of removableRaceIds) {
      delete runtimeBootstrapByRaceId[raceId];
      delete runtimeBootstrapSavedAtByRaceId[raceId];
      changed = true;
    }
  }

  return {
    store: {
      schemaVersion: store.schemaVersion,
      lastRaceSequence: store.lastRaceSequence,
      runtimeBootstrapByRaceId,
      runtimeBootstrapSavedAtByRaceId
    },
    changed
  };
}

function createFallbackStore(initialRaceSequence: number): StoredRaceLaunchFileShape {
  return {
    schemaVersion: raceLaunchStoreSchemaVersion,
    lastRaceSequence: initialRaceSequence,
    runtimeBootstrapByRaceId: {},
    runtimeBootstrapSavedAtByRaceId: {}
  };
}

function normalizeParsedStore(
  parsedValue: unknown,
  initialRaceSequence: number
): { store: StoredRaceLaunchFileShape; shouldRewrite: boolean } {
  const fallbackStore = createFallbackStore(initialRaceSequence);

  if (!isObjectRecord(parsedValue)) {
    return { store: fallbackStore, shouldRewrite: true };
  }

  const runtimeBootstrapByRaceId = normalizeRuntimeBootstrapByRaceId(
    parsedValue.runtimeBootstrapByRaceId
  );
  const runtimeBootstrapSavedAtByRaceId = normalizeSavedAtByRaceId(
    parsedValue.runtimeBootstrapSavedAtByRaceId
  );

  for (const raceId of Object.keys(runtimeBootstrapByRaceId)) {
    if (!(raceId in runtimeBootstrapSavedAtByRaceId)) {
      runtimeBootstrapSavedAtByRaceId[raceId] = 0;
    }
  }

  for (const raceId of Object.keys(runtimeBootstrapSavedAtByRaceId)) {
    if (!(raceId in runtimeBootstrapByRaceId)) {
      delete runtimeBootstrapSavedAtByRaceId[raceId];
    }
  }

  const lastRaceSequence = normalizeRaceSequence(
    parsedValue.lastRaceSequence ?? initialRaceSequence
  );

  if (parsedValue.schemaVersion === raceLaunchStoreSchemaVersion) {
    return {
      store: {
        schemaVersion: raceLaunchStoreSchemaVersion,
        lastRaceSequence,
        runtimeBootstrapByRaceId,
        runtimeBootstrapSavedAtByRaceId
      },
      shouldRewrite: false
    };
  }

  if ('lastRaceSequence' in parsedValue || 'runtimeBootstrapByRaceId' in parsedValue) {
    return {
      store: {
        schemaVersion: raceLaunchStoreSchemaVersion,
        lastRaceSequence,
        runtimeBootstrapByRaceId,
        runtimeBootstrapSavedAtByRaceId
      },
      shouldRewrite: true
    };
  }

  return { store: fallbackStore, shouldRewrite: true };
}

function resolveBackupFilePath(storageFilePath: string): string {
  return `${storageFilePath}${raceLaunchStoreBackupSuffix}`;
}

function readNormalizedStoreFromFile(
  filePath: string,
  initialRaceSequence: number
): { store: StoredRaceLaunchFileShape; shouldRewrite: boolean } | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return normalizeParsedStore(parsed, initialRaceSequence);
  } catch {
    return null;
  }
}

function readStoreFile(options: CreateFileRaceLaunchStoreOptions): StoredRaceLaunchFileShape {
  const initialRaceSequence = normalizeRaceSequence(options.initialRaceSequence);
  const fallbackStore = createFallbackStore(initialRaceSequence);
  const retentionPolicy = resolveRetentionPolicy(options);
  const nowEpochMsProvider = resolveNowEpochMsProvider(options);
  const strictDurability = resolveStrictDurability(options);

  const primaryStore = readNormalizedStoreFromFile(options.storageFilePath, initialRaceSequence);
  if (primaryStore) {
    const retained = applyRetentionPolicy(
      primaryStore.store,
      retentionPolicy,
      nowEpochMsProvider()
    );
    if (primaryStore.shouldRewrite || retained.changed) {
      writeStoreFile(options.storageFilePath, retained.store, strictDurability);
    }
    return retained.store;
  }

  const backupFilePath = resolveBackupFilePath(options.storageFilePath);
  const backupStore = readNormalizedStoreFromFile(backupFilePath, initialRaceSequence);
  if (backupStore) {
    const retained = applyRetentionPolicy(backupStore.store, retentionPolicy, nowEpochMsProvider());
    // Prefer restoring primary from backup before continuing launch operations.
    writeStoreFile(options.storageFilePath, retained.store, strictDurability);
    return retained.store;
  }

  // Self-heal missing/corrupted store content to keep API startup and launch flow resilient.
  writeStoreFile(options.storageFilePath, fallbackStore, strictDurability);
  return fallbackStore;
}

function writeStoreFile(
  storageFilePath: string,
  store: StoredRaceLaunchFileShape,
  strictDurability: boolean
): void {
  const serializedStore = JSON.stringify(store, null, 2);
  const storageDir = path.dirname(storageFilePath);
  const backupFilePath = resolveBackupFilePath(storageFilePath);

  fs.mkdirSync(storageDir, { recursive: true });
  atomicWriteTextFile(storageFilePath, serializedStore, strictDurability);
  atomicWriteTextFile(backupFilePath, serializedStore, strictDurability);
}

function atomicWriteTextFile(filePath: string, content: string, strictDurability: boolean): void {
  const tempFilePath = `${filePath}.${process.pid}.${Date.now()}.${Math.random()
    .toString(16)
    .slice(2)}${raceLaunchStoreTempSuffix}`;

  const tempFd = fs.openSync(tempFilePath, 'w');
  try {
    fs.writeSync(tempFd, content, undefined, 'utf8');
    if (strictDurability) {
      fs.fsyncSync(tempFd);
    }
  } finally {
    fs.closeSync(tempFd);
  }

  try {
    fs.renameSync(tempFilePath, filePath);
    fsyncAfterRename(filePath, strictDurability);
  } catch (renameError) {
    try {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
        fs.renameSync(tempFilePath, filePath);
        fsyncAfterRename(filePath, strictDurability);
        return;
      }
    } catch {
      if (fs.existsSync(tempFilePath)) {
        fs.rmSync(tempFilePath, { force: true });
      }
      throw renameError;
    }

    if (fs.existsSync(tempFilePath)) {
      fs.rmSync(tempFilePath, { force: true });
    }
    throw renameError;
  }
}

function fsyncAfterRename(filePath: string, strictDurability: boolean): void {
  if (!strictDurability) {
    return;
  }

  try {
    const fileFd = fs.openSync(filePath, 'r');
    try {
      fs.fsyncSync(fileFd);
    } finally {
      fs.closeSync(fileFd);
    }
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (
      errorCode === 'EINVAL' ||
      errorCode === 'ENOTSUP' ||
      errorCode === 'EPERM' ||
      errorCode === 'EISDIR'
    ) {
      return;
    }

    throw error;
  }

  const directoryPath = path.dirname(filePath);

  try {
    const directoryFd = fs.openSync(directoryPath, 'r');
    try {
      fs.fsyncSync(directoryFd);
    } finally {
      fs.closeSync(directoryFd);
    }
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (
      errorCode === 'EINVAL' ||
      errorCode === 'ENOTSUP' ||
      errorCode === 'EPERM' ||
      errorCode === 'EISDIR'
    ) {
      return;
    }

    throw error;
  }
}

export function createFileRaceLaunchStore(
  options: CreateFileRaceLaunchStoreOptions
): RaceLaunchStore {
  const retentionPolicy = resolveRetentionPolicy(options);
  const nowEpochMsProvider = resolveNowEpochMsProvider(options);
  const strictDurability = resolveStrictDurability(options);

  return {
    peekNextRaceSequence() {
      const store = readStoreFile(options);
      return store.lastRaceSequence + 1;
    },
    allocateRaceId() {
      const store = readStoreFile(options);
      store.lastRaceSequence += 1;
      writeStoreFile(options.storageFilePath, store, strictDurability);
      return `race-${store.lastRaceSequence}`;
    },
    saveRuntimeBootstrap(raceId, payload) {
      const store = readStoreFile(options);
      store.runtimeBootstrapByRaceId[raceId] = payload;
      store.runtimeBootstrapSavedAtByRaceId[raceId] = nowEpochMsProvider();
      const retained = applyRetentionPolicy(store, retentionPolicy, nowEpochMsProvider());
      writeStoreFile(options.storageFilePath, retained.store, strictDurability);
    },
    getRuntimeBootstrap(raceId) {
      const store = readStoreFile(options);
      return store.runtimeBootstrapByRaceId[raceId];
    }
  };
}
