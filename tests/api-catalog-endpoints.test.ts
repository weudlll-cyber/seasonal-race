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

import { buildApiApp } from '../apps/api/src/index';

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

  it('starts a race when selected track and racer ids are valid and race types match', async () => {
    const app = buildApiApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default',
        seed: 'manual-seed',
        durationMs: 60_000,
        winnerCount: 2,
        brandingProfileId: 'brand-spring-2026',
        options: {
          weather: 'rain',
          intensity: 3,
          noCollisions: false
        }
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      raceId: string;
      raceType: string;
      trackId: string;
      racerListId: string;
      durationMs: number;
      winnerCount: number;
      brandingProfileId?: string;
      seed: string;
      options: Record<string, string | number | boolean>;
      status: string;
    };

    expect(body.raceId).toBe('race-1');
    expect(body.raceType).toBe('duck');
    expect(body.trackId).toBe('duck-canal-s-curve');
    expect(body.racerListId).toBe('duck-default');
    expect(body.durationMs).toBe(60_000);
    expect(body.winnerCount).toBe(2);
    expect(body.brandingProfileId).toBe('brand-spring-2026');
    expect(body.seed).toBe('manual-seed');
    expect(body.options).toEqual({
      weather: 'rain',
      intensity: 3,
      noCollisions: false
    });
    expect(body.status).toBe('scheduled');

    await app.close();
  });

  it('rejects start requests with missing ids', async () => {
    const app = buildApiApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: '',
        racerListId: 'duck-default'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { error: string; message: string };
    expect(body.error).toBe('INVALID_REQUEST');

    await app.close();
  });

  it('rejects start requests when catalog ids are unknown', async () => {
    const app = buildApiApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'unknown-track',
        racerListId: 'duck-default'
      }
    });

    expect(response.statusCode).toBe(404);
    const body = response.json() as { error: string; message: string };
    expect(body.error).toBe('CATALOG_ENTRY_NOT_FOUND');
    expect(body.message).toMatch(/unknown-track/);

    await app.close();
  });

  it('rejects start requests when track and racer list race types differ', async () => {
    const app = buildApiApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'horse-default'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { error: string; message: string };
    expect(body.error).toBe('RACE_TYPE_MISMATCH');

    await app.close();
  });

  it('rejects start requests when duration is out of supported range', async () => {
    const app = buildApiApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default',
        durationMs: 1_000
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { error: string; message: string };
    expect(body.error).toBe('INVALID_OPTION_RANGE');
    expect(body.message).toMatch(/durationMs/);

    await app.close();
  });

  it('rejects start requests when winnerCount exceeds racer list size', async () => {
    const app = buildApiApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default',
        winnerCount: 99
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { error: string; message: string };
    expect(body.error).toBe('INVALID_OPTION_RANGE');
    expect(body.message).toMatch(/winnerCount/);

    await app.close();
  });

  it('rejects start requests when options contain unsupported value types', async () => {
    const app = buildApiApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default',
        options: {
          nested: { bad: true }
        }
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { error: string; message: string };
    expect(body.error).toBe('INVALID_REQUEST');
    expect(body.message).toMatch(/options\.nested/);

    await app.close();
  });

  it('returns runtime bootstrap payload for an existing started race', async () => {
    const app = buildApiApp();

    const startResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: {
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default',
        durationMs: 55_000,
        winnerCount: 3,
        options: {
          streamOverlay: true
        }
      }
    });

    expect(startResponse.statusCode).toBe(201);
    const startBody = startResponse.json() as { raceId: string };

    const bootstrapResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/races/${startBody.raceId}/runtime-bootstrap`
    });

    expect(bootstrapResponse.statusCode).toBe(200);
    const bootstrapBody = bootstrapResponse.json() as {
      raceId: string;
      raceType: string;
      launch: { durationMs: number; winnerCount: number; options: Record<string, unknown> };
      track: { id: string; pointCount: number; points: unknown[] };
      racerList: { id: string; racerCount: number };
    };

    expect(bootstrapBody.raceId).toBe(startBody.raceId);
    expect(bootstrapBody.raceType).toBe('duck');
    expect(bootstrapBody.launch.durationMs).toBe(55_000);
    expect(bootstrapBody.launch.winnerCount).toBe(3);
    expect(bootstrapBody.launch.options).toEqual({ streamOverlay: true });
    expect(bootstrapBody.track.id).toBe('duck-canal-s-curve');
    expect(bootstrapBody.track.pointCount).toBeGreaterThanOrEqual(3);
    expect(bootstrapBody.track.points.length).toBeGreaterThanOrEqual(3);
    expect(bootstrapBody.racerList.id).toBe('duck-default');
    expect(bootstrapBody.racerList.racerCount).toBeGreaterThanOrEqual(2);

    await app.close();
  });

  it('returns 404 runtime bootstrap when race id does not exist', async () => {
    const app = buildApiApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/races/race-missing/runtime-bootstrap'
    });

    expect(response.statusCode).toBe(404);
    const body = response.json() as { error: string; message: string };
    expect(body.error).toBe('RACE_NOT_FOUND');
    expect(body.message).toMatch(/race-missing/);

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
