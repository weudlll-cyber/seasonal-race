/**
 * File: tests/api-race-launch-persistence.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies file-backed race launch persistence across app restarts.
 * Usage: Runs in Vitest to prevent race-id resets and lost runtime bootstrap state.
 * Dependencies: API app builder and file-backed race launch store.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildApiApp, createFileRaceLaunchStore } from '../apps/api/src/index';

const tempDirectories: string[] = [];

afterEach(() => {
  for (const tempDirectory of tempDirectories) {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
  tempDirectories.length = 0;
});

describe('api race launch persistence', () => {
  it('keeps runtime bootstrap and race id sequence after app restart with file store', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-api-persistence-'));
    tempDirectories.push(tempRoot);
    const storageFilePath = path.join(tempRoot, 'race-launch-store.json');

    const firstStore = createFileRaceLaunchStore({ storageFilePath });
    const firstApp = buildApiApp({ raceLaunchStore: firstStore });

    const firstStartResponse = await firstApp.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default'
      }
    });

    expect(firstStartResponse.statusCode).toBe(201);
    const firstStartBody = firstStartResponse.json() as { raceId: string };
    expect(firstStartBody.raceId).toBe('race-1');

    await firstApp.close();

    const secondStore = createFileRaceLaunchStore({ storageFilePath });
    const secondApp = buildApiApp({ raceLaunchStore: secondStore });

    const oldBootstrapResponse = await secondApp.inject({
      method: 'GET',
      url: '/api/v1/races/race-1/runtime-bootstrap'
    });

    expect(oldBootstrapResponse.statusCode).toBe(200);

    const secondStartResponse = await secondApp.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default'
      }
    });

    expect(secondStartResponse.statusCode).toBe(201);
    const secondStartBody = secondStartResponse.json() as { raceId: string };
    expect(secondStartBody.raceId).toBe('race-2');

    await secondApp.close();
  });

  it('self-heals corrupted launch store file and still starts races', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-api-corrupt-'));
    tempDirectories.push(tempRoot);
    const storageFilePath = path.join(tempRoot, 'race-launch-store.json');
    fs.writeFileSync(storageFilePath, 'not-json-content', 'utf8');

    const store = createFileRaceLaunchStore({ storageFilePath });
    const app = buildApiApp({ raceLaunchStore: store });

    const startResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default'
      }
    });

    expect(startResponse.statusCode).toBe(201);
    const startBody = startResponse.json() as { raceId: string };
    expect(startBody.raceId).toBe('race-1');

    const bootstrapResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/races/race-1/runtime-bootstrap'
    });

    expect(bootstrapResponse.statusCode).toBe(200);

    const healedRaw = fs.readFileSync(storageFilePath, 'utf8');
    const healedStore = JSON.parse(healedRaw) as {
      schemaVersion: number;
      lastRaceSequence: number;
    };
    expect(healedStore.schemaVersion).toBe(2);
    expect(healedStore.lastRaceSequence).toBe(1);

    await app.close();
  });

  it('migrates legacy unversioned store file and continues race ids', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-api-legacy-'));
    tempDirectories.push(tempRoot);
    const storageFilePath = path.join(tempRoot, 'race-launch-store.json');

    fs.writeFileSync(
      storageFilePath,
      JSON.stringify({
        lastRaceSequence: 3,
        runtimeBootstrapByRaceId: {}
      }),
      'utf8'
    );

    const store = createFileRaceLaunchStore({ storageFilePath });
    const app = buildApiApp({ raceLaunchStore: store });

    const startResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default'
      }
    });

    expect(startResponse.statusCode).toBe(201);
    const startBody = startResponse.json() as { raceId: string };
    expect(startBody.raceId).toBe('race-4');

    const migratedRaw = fs.readFileSync(storageFilePath, 'utf8');
    const migratedStore = JSON.parse(migratedRaw) as {
      schemaVersion: number;
      lastRaceSequence: number;
    };

    expect(migratedStore.schemaVersion).toBe(2);
    expect(migratedStore.lastRaceSequence).toBe(4);

    await app.close();
  });

  it('restores from backup store when primary file is corrupted', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-api-backup-'));
    tempDirectories.push(tempRoot);
    const storageFilePath = path.join(tempRoot, 'race-launch-store.json');

    const firstStore = createFileRaceLaunchStore({ storageFilePath });
    const firstApp = buildApiApp({ raceLaunchStore: firstStore });

    const firstStartResponse = await firstApp.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default'
      }
    });

    expect(firstStartResponse.statusCode).toBe(201);
    await firstApp.close();

    fs.writeFileSync(storageFilePath, '{corrupted-primary', 'utf8');

    const recoveredStore = createFileRaceLaunchStore({ storageFilePath });
    const recoveredApp = buildApiApp({ raceLaunchStore: recoveredStore });

    const existingBootstrapResponse = await recoveredApp.inject({
      method: 'GET',
      url: '/api/v1/races/race-1/runtime-bootstrap'
    });
    expect(existingBootstrapResponse.statusCode).toBe(200);

    const secondStartResponse = await recoveredApp.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default'
      }
    });

    expect(secondStartResponse.statusCode).toBe(201);
    const secondStartBody = secondStartResponse.json() as { raceId: string };
    expect(secondStartBody.raceId).toBe('race-2');

    await recoveredApp.close();
  });

  it('prunes oldest runtime bootstrap entries when max entry retention is reached', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-api-prune-max-'));
    tempDirectories.push(tempRoot);
    const storageFilePath = path.join(tempRoot, 'race-launch-store.json');

    const store = createFileRaceLaunchStore({
      storageFilePath,
      maxStoredRaceBootstraps: 2
    });
    const app = buildApiApp({ raceLaunchStore: store });

    const firstStartResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default'
      }
    });
    expect(firstStartResponse.statusCode).toBe(201);

    const secondStartResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default'
      }
    });
    expect(secondStartResponse.statusCode).toBe(201);

    const thirdStartResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default'
      }
    });
    expect(thirdStartResponse.statusCode).toBe(201);

    const firstBootstrapResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/races/race-1/runtime-bootstrap'
    });
    expect(firstBootstrapResponse.statusCode).toBe(404);

    const secondBootstrapResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/races/race-2/runtime-bootstrap'
    });
    expect(secondBootstrapResponse.statusCode).toBe(200);

    const thirdBootstrapResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/races/race-3/runtime-bootstrap'
    });
    expect(thirdBootstrapResponse.statusCode).toBe(200);

    await app.close();
  });

  it('supports strict durability mode via app options', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-api-strict-opt-'));
    tempDirectories.push(tempRoot);
    const storageFilePath = path.join(tempRoot, 'race-launch-store.json');

    const app = buildApiApp({
      raceLaunchStoreFilePath: storageFilePath,
      raceLaunchStoreStrictDurability: true
    });

    const startResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default'
      }
    });

    expect(startResponse.statusCode).toBe(201);
    expect(fs.existsSync(storageFilePath)).toBe(true);
    expect(fs.existsSync(`${storageFilePath}.bak`)).toBe(true);

    await app.close();
  });

  it('supports strict durability mode via env settings', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-api-strict-env-'));
    tempDirectories.push(tempRoot);
    const storageFilePath = path.join(tempRoot, 'race-launch-store.json');

    const originalFilePathEnv = process.env.SEASONAL_RACE_API_LAUNCH_STORE_FILE_PATH;
    const originalStrictEnv = process.env.SEASONAL_RACE_API_LAUNCH_STORE_STRICT_DURABILITY;

    process.env.SEASONAL_RACE_API_LAUNCH_STORE_FILE_PATH = storageFilePath;
    process.env.SEASONAL_RACE_API_LAUNCH_STORE_STRICT_DURABILITY = 'true';

    try {
      const app = buildApiApp();

      const startResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/races/start',
        payload: {
          trackId: 'duck-canal-s-curve',
          racerListId: 'duck-default'
        }
      });

      expect(startResponse.statusCode).toBe(201);
      expect(fs.existsSync(storageFilePath)).toBe(true);
      expect(fs.existsSync(`${storageFilePath}.bak`)).toBe(true);

      await app.close();
    } finally {
      if (originalFilePathEnv === undefined) {
        delete process.env.SEASONAL_RACE_API_LAUNCH_STORE_FILE_PATH;
      } else {
        process.env.SEASONAL_RACE_API_LAUNCH_STORE_FILE_PATH = originalFilePathEnv;
      }

      if (originalStrictEnv === undefined) {
        delete process.env.SEASONAL_RACE_API_LAUNCH_STORE_STRICT_DURABILITY;
      } else {
        process.env.SEASONAL_RACE_API_LAUNCH_STORE_STRICT_DURABILITY = originalStrictEnv;
      }
    }
  });
});
