/**
 * File: tests/api-catalog-endpoints.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies API catalog endpoints for normal and invalid-content scenarios.
 * Usage: Runs in Vitest as part of CI test suite.
 * Dependencies: Fastify app builder and Node fs for temporary fixtures.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildApiApp } from '../apps/api/src/app';

const tempDirectories: string[] = [];

afterEach(() => {
  for (const tempDirectory of tempDirectories) {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
  tempDirectories.length = 0;
});

describe('api catalog endpoints', () => {
  it('returns track and racer catalog items from content manifests', async () => {
    const app = buildApiApp();

    const tracksResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/tracks'
    });

    expect(tracksResponse.statusCode).toBe(200);
    const trackBody = tracksResponse.json() as { items: Array<{ id: string; pointCount: number }> };
    expect(trackBody.items.length).toBeGreaterThanOrEqual(3);
    expect(trackBody.items.some((item) => item.id === 'duck-canal-s-curve')).toBe(true);
    expect(trackBody.items.every((item) => item.pointCount >= 3)).toBe(true);

    const racersResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/racers'
    });

    expect(racersResponse.statusCode).toBe(200);
    const racerBody = racersResponse.json() as { items: Array<{ id: string; racerCount: number }> };
    expect(racerBody.items.length).toBeGreaterThanOrEqual(2);
    expect(racerBody.items.some((item) => item.id === 'duck-default')).toBe(true);
    expect(racerBody.items.every((item) => item.racerCount >= 2)).toBe(true);

    await app.close();
  });

  it('returns 500 when a manifest references a missing track file', async () => {
    const contentRoot = createBrokenContentRoot();
    const app = buildApiApp({ contentRoot });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/tracks'
    });

    expect(response.statusCode).toBe(500);
    const body = response.json() as { error: string; message: string };
    expect(body.error).toBe('CATALOG_LOAD_FAILED');
    expect(body.message).toMatch(/Missing content file/);

    await app.close();
  });
});

function createBrokenContentRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seasonal-race-content-'));
  tempDirectories.push(tempRoot);

  const manifestsDir = path.join(tempRoot, 'manifests');
  const racersDir = path.join(tempRoot, 'racers');

  fs.mkdirSync(manifestsDir, { recursive: true });
  fs.mkdirSync(racersDir, { recursive: true });

  const tracksManifest = {
    version: 1,
    tracks: [
      {
        id: 'broken-track',
        displayName: 'Broken Track',
        raceType: 'duck',
        file: 'missing-track.json'
      }
    ]
  };

  const racersManifest = {
    version: 1,
    racerLists: [
      {
        id: 'duck-default',
        displayName: 'Duck Default',
        raceType: 'duck',
        file: 'duck-default.json'
      }
    ]
  };

  const duckRacers = {
    id: 'duck-default',
    name: 'Duck Default',
    names: ['One', 'Two']
  };

  fs.writeFileSync(
    path.join(manifestsDir, 'tracks.manifest.json'),
    JSON.stringify(tracksManifest, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(manifestsDir, 'racers.manifest.json'),
    JSON.stringify(racersManifest, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(racersDir, 'duck-default.json'),
    JSON.stringify(duckRacers, null, 2),
    'utf8'
  );

  return tempRoot;
}
