/**
 * File: apps/api/src/race-launch-store.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies race launch store behavior for memory and file-backed modes.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

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

      expect(payload?.raceId).toBe('race-file-1');
      expect(payload?.raceType).toBe('ice');
      expect(payload?.track.name).toBe('Test Track Ice');
      expect(payload?.launch.options.trackOrientation).toBe('top-to-bottom');
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
});
