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
});
