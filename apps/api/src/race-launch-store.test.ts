/**
 * File: apps/api/src/race-launch-store.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies race launch store behavior for memory and file-backed modes.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createFileRaceLaunchStore, createInMemoryRaceLaunchStore } from './race-launch-store';

describe('race-launch-store', () => {
  it('allocates increasing race ids in memory mode', () => {
    const store = createInMemoryRaceLaunchStore();

    expect(store.peekNextRaceSequence()).toBe(1);
    expect(store.allocateRaceId()).toBe('race-1');
    expect(store.peekNextRaceSequence()).toBe(2);
    expect(store.allocateRaceId()).toBe('race-2');
  });

  it('stores and resolves runtime bootstrap payloads in memory', () => {
    const store = createInMemoryRaceLaunchStore();

    store.saveRuntimeBootstrap('race-memory-1', {
      raceId: 'race-memory-1',
      raceType: 'asphalt',
      launch: {
        raceId: 'race-memory-1',
        trackId: 'test-track',
        racerListId: 'test-racers',
        seed: 'seed-memory',
        durationMs: 30000,
        winnerCount: 3,
        options: {},
        raceType: 'asphalt',
        status: 'scheduled'
      },
      track: {
        id: 'test-track',
        name: 'Test Track',
        length: 1000,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 200, y: 0 }
        ],
        pointCount: 3
      },
      racerList: {
        id: 'test-racers',
        name: 'Test Racers',
        racerCount: 6
      }
    });

    const payload = store.getRuntimeBootstrap('race-memory-1');

    expect(payload?.raceId).toBe('race-memory-1');
    expect(payload?.raceType).toBe('asphalt');
  });

  it('persists runtime bootstrap payloads in file-backed mode', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-store-'));

    try {
      const storageFilePath = path.join(tempRoot, 'race-launch-store.json');
      const storeWriter = createFileRaceLaunchStore({ storageFilePath });

      storeWriter.saveRuntimeBootstrap('race-file-1', {
        raceId: 'race-file-1',
        raceType: 'ice',
        launch: {
          raceId: 'race-file-1',
          trackId: 'test-track-ice',
          racerListId: 'test-racers-ice',
          seed: 'seed-file',
          durationMs: 45000,
          winnerCount: 3,
          options: { trackOrientation: 'top-to-bottom' },
          raceType: 'ice',
          status: 'scheduled'
        },
        track: {
          id: 'test-track-ice',
          name: 'Test Track Ice',
          length: 1200,
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 50 },
            { x: 200, y: 100 }
          ],
          pointCount: 3
        },
        racerList: {
          id: 'test-racers-ice',
          name: 'Test Racers Ice',
          racerCount: 8
        }
      });

      const storeReader = createFileRaceLaunchStore({ storageFilePath });
      const payload = storeReader.getRuntimeBootstrap('race-file-1');
      const persistedRaw = fs.readFileSync(storageFilePath, 'utf8');
      const persisted = JSON.parse(persistedRaw) as { schemaVersion: number };

      expect(payload?.raceId).toBe('race-file-1');
      expect(payload?.raceType).toBe('ice');
      expect(payload?.track.name).toBe('Test Track Ice');
      expect(payload?.launch.options.trackOrientation).toBe('top-to-bottom');
      expect(persisted.schemaVersion).toBe(2);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('persists race id sequence in file-backed mode', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-sequence-'));

    try {
      const storageFilePath = path.join(tempRoot, 'race-launch-store.json');

      const firstStore = createFileRaceLaunchStore({ storageFilePath });
      expect(firstStore.peekNextRaceSequence()).toBe(1);
      expect(firstStore.allocateRaceId()).toBe('race-1');

      const secondStore = createFileRaceLaunchStore({ storageFilePath });
      expect(secondStore.peekNextRaceSequence()).toBe(2);
      expect(secondStore.allocateRaceId()).toBe('race-2');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('recovers from malformed store file content in file-backed mode', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-corrupt-store-'));

    try {
      const storageFilePath = path.join(tempRoot, 'race-launch-store.json');
      fs.writeFileSync(storageFilePath, '{ this-is: not-valid-json', 'utf8');

      const store = createFileRaceLaunchStore({ storageFilePath });

      expect(store.peekNextRaceSequence()).toBe(1);
      expect(store.getRuntimeBootstrap('race-unknown')).toBeUndefined();
      expect(store.allocateRaceId()).toBe('race-1');

      const healedRaw = fs.readFileSync(storageFilePath, 'utf8');
      const healed = JSON.parse(healedRaw) as {
        schemaVersion: number;
        lastRaceSequence: number;
        runtimeBootstrapByRaceId: Record<string, unknown>;
      };

      expect(healed.schemaVersion).toBe(2);
      expect(healed.lastRaceSequence).toBe(1);
      expect(healed.runtimeBootstrapByRaceId).toEqual({});
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('normalizes invalid runtime bootstrap map entries from file-backed store', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-normalize-store-'));

    try {
      const storageFilePath = path.join(tempRoot, 'race-launch-store.json');
      fs.writeFileSync(
        storageFilePath,
        JSON.stringify({
          lastRaceSequence: 5,
          runtimeBootstrapByRaceId: 'invalid-map'
        }),
        'utf8'
      );

      const store = createFileRaceLaunchStore({ storageFilePath });
      const healedRaw = fs.readFileSync(storageFilePath, 'utf8');
      const healed = JSON.parse(healedRaw) as {
        schemaVersion: number;
        runtimeBootstrapByRaceId: Record<string, unknown>;
      };

      expect(store.peekNextRaceSequence()).toBe(6);
      expect(store.getRuntimeBootstrap('race-1')).toBeUndefined();
      expect(healed.schemaVersion).toBe(2);
      expect(healed.runtimeBootstrapByRaceId).toEqual({});
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('migrates legacy unversioned store files to current schema version', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-legacy-store-'));

    try {
      const storageFilePath = path.join(tempRoot, 'race-launch-store.json');
      fs.writeFileSync(
        storageFilePath,
        JSON.stringify({
          lastRaceSequence: 4,
          runtimeBootstrapByRaceId: {
            'race-4': {
              raceId: 'race-4',
              raceType: 'duck',
              launch: {
                raceId: 'race-4',
                raceType: 'duck',
                trackId: 'duck-canal-s-curve',
                racerListId: 'duck-default',
                seed: 'legacy-seed',
                durationMs: 45000,
                winnerCount: 3,
                options: {},
                status: 'scheduled'
              },
              track: {
                id: 'duck-canal-s-curve',
                name: 'Legacy Duck Track',
                length: 1000,
                points: [
                  { x: 0, y: 0 },
                  { x: 100, y: 0 },
                  { x: 200, y: 0 }
                ],
                pointCount: 3
              },
              racerList: {
                id: 'duck-default',
                name: 'Legacy Racers',
                racerCount: 6
              }
            }
          }
        }),
        'utf8'
      );

      const store = createFileRaceLaunchStore({ storageFilePath });

      expect(store.peekNextRaceSequence()).toBe(5);
      expect(store.getRuntimeBootstrap('race-4')?.raceId).toBe('race-4');

      const migratedRaw = fs.readFileSync(storageFilePath, 'utf8');
      const migrated = JSON.parse(migratedRaw) as {
        schemaVersion: number;
        lastRaceSequence: number;
      };

      expect(migrated.schemaVersion).toBe(2);
      expect(migrated.lastRaceSequence).toBe(4);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('restores primary store from backup when primary file is corrupted', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-backup-recovery-'));

    try {
      const storageFilePath = path.join(tempRoot, 'race-launch-store.json');
      const storeWriter = createFileRaceLaunchStore({ storageFilePath });

      const raceId = storeWriter.allocateRaceId();
      storeWriter.saveRuntimeBootstrap(raceId, {
        raceId,
        raceType: 'duck',
        launch: {
          raceId,
          raceType: 'duck',
          trackId: 'duck-canal-s-curve',
          racerListId: 'duck-default',
          seed: 'backup-seed',
          durationMs: 45000,
          winnerCount: 3,
          options: {},
          status: 'scheduled'
        },
        track: {
          id: 'duck-canal-s-curve',
          name: 'Backup Recovery Track',
          length: 1000,
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 200, y: 0 }
          ],
          pointCount: 3
        },
        racerList: {
          id: 'duck-default',
          name: 'Backup Recovery Racers',
          racerCount: 6
        }
      });

      fs.writeFileSync(storageFilePath, '{bad-primary-json', 'utf8');

      const recoveredStore = createFileRaceLaunchStore({ storageFilePath });

      expect(recoveredStore.peekNextRaceSequence()).toBe(2);
      expect(recoveredStore.getRuntimeBootstrap('race-1')?.raceId).toBe('race-1');

      const healedPrimaryRaw = fs.readFileSync(storageFilePath, 'utf8');
      const healedPrimary = JSON.parse(healedPrimaryRaw) as {
        schemaVersion: number;
        lastRaceSequence: number;
      };

      expect(healedPrimary.schemaVersion).toBe(2);
      expect(healedPrimary.lastRaceSequence).toBe(1);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('prunes oldest runtime bootstraps when max stored entries are exceeded', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-prune-max-'));

    try {
      const storageFilePath = path.join(tempRoot, 'race-launch-store.json');
      let nowEpochMs = 1_000;
      const store = createFileRaceLaunchStore({
        storageFilePath,
        maxStoredRaceBootstraps: 2,
        nowEpochMsProvider: () => nowEpochMs
      });

      const raceId1 = store.allocateRaceId();
      store.saveRuntimeBootstrap(raceId1, buildRuntimeBootstrapPayload(raceId1));

      nowEpochMs += 1_000;
      const raceId2 = store.allocateRaceId();
      store.saveRuntimeBootstrap(raceId2, buildRuntimeBootstrapPayload(raceId2));

      nowEpochMs += 1_000;
      const raceId3 = store.allocateRaceId();
      store.saveRuntimeBootstrap(raceId3, buildRuntimeBootstrapPayload(raceId3));

      expect(store.getRuntimeBootstrap('race-1')).toBeUndefined();
      expect(store.getRuntimeBootstrap('race-2')?.raceId).toBe('race-2');
      expect(store.getRuntimeBootstrap('race-3')?.raceId).toBe('race-3');

      const persistedRaw = fs.readFileSync(storageFilePath, 'utf8');
      const persisted = JSON.parse(persistedRaw) as {
        runtimeBootstrapByRaceId: Record<string, unknown>;
        runtimeBootstrapSavedAtByRaceId: Record<string, number>;
      };

      expect(Object.keys(persisted.runtimeBootstrapByRaceId).sort()).toEqual(['race-2', 'race-3']);
      expect(Object.keys(persisted.runtimeBootstrapSavedAtByRaceId).sort()).toEqual([
        'race-2',
        'race-3'
      ]);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('prunes expired runtime bootstraps when max age is configured', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-prune-ttl-'));

    try {
      const storageFilePath = path.join(tempRoot, 'race-launch-store.json');
      let nowEpochMs = 10_000;
      const store = createFileRaceLaunchStore({
        storageFilePath,
        maxStoredRaceBootstraps: 10,
        maxStoredRaceBootstrapAgeMs: 5_000,
        nowEpochMsProvider: () => nowEpochMs
      });

      const raceId1 = store.allocateRaceId();
      store.saveRuntimeBootstrap(raceId1, buildRuntimeBootstrapPayload(raceId1));

      nowEpochMs += 6_000;
      const raceId2 = store.allocateRaceId();
      store.saveRuntimeBootstrap(raceId2, buildRuntimeBootstrapPayload(raceId2));

      expect(store.getRuntimeBootstrap('race-1')).toBeUndefined();
      expect(store.getRuntimeBootstrap('race-2')?.raceId).toBe('race-2');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('uses atomic writes without leaving temporary store files behind', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-atomic-write-'));

    try {
      const storageFilePath = path.join(tempRoot, 'race-launch-store.json');
      const store = createFileRaceLaunchStore({ storageFilePath });

      const raceId = store.allocateRaceId();
      store.saveRuntimeBootstrap(raceId, buildRuntimeBootstrapPayload(raceId));

      const fileNames = fs.readdirSync(tempRoot);
      expect(fileNames.includes('race-launch-store.json')).toBe(true);
      expect(fileNames.includes('race-launch-store.json.bak')).toBe(true);
      expect(fileNames.some((name) => name.includes('.tmp'))).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('runs fsync path when strict durability mode is enabled', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-strict-durability-'));
    const fsyncSpy = vi.spyOn(fs, 'fsyncSync');

    try {
      const storageFilePath = path.join(tempRoot, 'race-launch-store.json');
      const store = createFileRaceLaunchStore({
        storageFilePath,
        strictDurability: true
      });

      const raceId = store.allocateRaceId();
      store.saveRuntimeBootstrap(raceId, buildRuntimeBootstrapPayload(raceId));

      expect(fsyncSpy).toHaveBeenCalled();
    } finally {
      fsyncSpy.mockRestore();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

function buildRuntimeBootstrapPayload(raceId: string) {
  return {
    raceId,
    raceType: 'duck',
    launch: {
      raceId,
      raceType: 'duck',
      trackId: 'duck-canal-s-curve',
      racerListId: 'duck-default',
      seed: `${raceId}-seed`,
      durationMs: 45000,
      winnerCount: 3,
      options: {},
      status: 'scheduled' as const
    },
    track: {
      id: 'duck-canal-s-curve',
      name: `Track ${raceId}`,
      length: 1000,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 0 }
      ],
      pointCount: 3
    },
    racerList: {
      id: 'duck-default',
      name: `Racers ${raceId}`,
      racerCount: 6
    }
  };
}
