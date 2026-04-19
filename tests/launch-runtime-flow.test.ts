/**
 * File: tests/launch-runtime-flow.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Contract regression for the full launch-to-runtime bootstrap flow.
 * Usage: Runs in Vitest as part of Priority 5 end-to-end contract coverage.
 * Dependencies: API app builder and web-admin launch model helpers.
 */

import { describe, expect, it } from 'vitest';

import { buildApiApp } from '../apps/api/src/app';
import {
  buildStartRaceRequestBody,
  createOpsLaunchSelectorModel,
  type RacerCatalogOption,
  type TrackCatalogOption
} from '../apps/web-admin/src/index';

describe('launch to runtime bootstrap flow', () => {
  it('keeps launch contracts consistent from admin model to runtime bootstrap payload', async () => {
    const app = buildApiApp();

    const tracksResponse = await app.inject({ method: 'GET', url: '/api/v1/catalog/tracks' });
    const racersResponse = await app.inject({ method: 'GET', url: '/api/v1/catalog/racers' });

    expect(tracksResponse.statusCode).toBe(200);
    expect(racersResponse.statusCode).toBe(200);

    const trackCatalog = tracksResponse.json() as { items: TrackCatalogOption[] };
    const racerCatalog = racersResponse.json() as { items: RacerCatalogOption[] };

    const model = createOpsLaunchSelectorModel(trackCatalog.items, racerCatalog.items, {
      trackId: 'duck-canal-s-curve',
      racerListId: 'duck-default',
      brandingProfileId: 'brand-flow-check'
    });

    const launchRequest = buildStartRaceRequestBody(model, {
      seed: 'flow-seed-1',
      durationMs: 62_000,
      winnerCount: 2,
      options: {
        streamOverlay: true,
        cameraProfile: 'tight'
      }
    });

    const startResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/races/start',
      payload: launchRequest
    });

    expect(startResponse.statusCode).toBe(201);

    const startBody = startResponse.json() as {
      raceId: string;
      raceType: string;
      trackId: string;
      racerListId: string;
      durationMs: number;
      winnerCount: number;
      brandingProfileId?: string;
      seed: string;
      options: Record<string, unknown>;
      status: string;
    };

    expect(startBody.trackId).toBe('duck-canal-s-curve');
    expect(startBody.racerListId).toBe('duck-default');
    expect(startBody.durationMs).toBe(62_000);
    expect(startBody.winnerCount).toBe(2);
    expect(startBody.brandingProfileId).toBe('brand-flow-check');
    expect(startBody.seed).toBe('flow-seed-1');

    const runtimeBootstrapResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/races/${startBody.raceId}/runtime-bootstrap`
    });

    expect(runtimeBootstrapResponse.statusCode).toBe(200);

    const runtimeBody = runtimeBootstrapResponse.json() as {
      raceId: string;
      raceType: string;
      launch: typeof startBody;
      track: { id: string; pointCount: number; points: unknown[] };
      racerList: { id: string; racerCount: number };
    };

    expect(runtimeBody.raceId).toBe(startBody.raceId);
    expect(runtimeBody.raceType).toBe(startBody.raceType);
    expect(runtimeBody.launch).toEqual(startBody);
    expect(runtimeBody.track.id).toBe('duck-canal-s-curve');
    expect(runtimeBody.track.pointCount).toBeGreaterThanOrEqual(3);
    expect(runtimeBody.track.points.length).toBeGreaterThanOrEqual(3);
    expect(runtimeBody.racerList.id).toBe('duck-default');
    expect(runtimeBody.racerList.racerCount).toBeGreaterThanOrEqual(2);

    await app.close();
  });
});
