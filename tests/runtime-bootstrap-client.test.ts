/**
 * File: tests/runtime-bootstrap-client.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies runtime bootstrap client URL parsing and fetch behavior.
 * Usage: Runs in Vitest as part of CI test suite.
 * Dependencies: runtime-bootstrap-client helper module.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchRuntimeBootstrap,
  resolveRuntimeApiBase,
  resolveRuntimeRaceId,
  resolveRuntimeTrackOrientation
} from '../apps/web-viewer/src/runtime-bootstrap-client';

describe('runtime bootstrap client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves race id and api base from query parameters', () => {
    expect(resolveRuntimeRaceId('?raceId=race-12')).toBe('race-12');
    expect(resolveRuntimeRaceId('?raceId=%20%20')).toBeNull();
    expect(resolveRuntimeRaceId('')).toBeNull();

    expect(resolveRuntimeApiBase('?apiBase=http://localhost:5050/api/v1')).toBe(
      'http://localhost:5050/api/v1'
    );
    expect(resolveRuntimeApiBase('')).toBe('/api/v1');

    expect(resolveRuntimeTrackOrientation('?orientation=top-to-bottom')).toBe('top-to-bottom');
    expect(resolveRuntimeTrackOrientation('?orientation=vertical')).toBe('top-to-bottom');
    expect(resolveRuntimeTrackOrientation('?orientation=left-to-right')).toBe('left-to-right');
    expect(resolveRuntimeTrackOrientation('')).toBe('left-to-right');
  });

  it('fetches runtime bootstrap payload from api endpoint', async () => {
    const mockPayload = {
      raceId: 'race-7',
      raceType: 'duck',
      launch: {
        raceId: 'race-7',
        raceType: 'duck',
        trackId: 'duck-canal-s-curve',
        racerListId: 'duck-default',
        seed: 'seed',
        durationMs: 55_000,
        winnerCount: 3,
        options: {},
        status: 'scheduled'
      },
      track: {
        id: 'duck-canal-s-curve',
        name: 'Duck Canal S Curve',
        length: 1200,
        points: [
          { x: 10, y: 20 },
          { x: 20, y: 30 },
          { x: 30, y: 40 }
        ],
        pointCount: 3
      },
      racerList: {
        id: 'duck-default',
        name: 'Duck Default Roster',
        racerCount: 8
      }
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockPayload
    } as Response);

    const payload = await fetchRuntimeBootstrap('race-7', 'http://localhost:5050/api/v1');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:5050/api/v1/races/race-7/runtime-bootstrap'
    );
    expect(payload.raceId).toBe('race-7');
    expect(payload.track.id).toBe('duck-canal-s-curve');
  });

  it('throws on non-2xx bootstrap responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'not found'
    } as Response);

    await expect(fetchRuntimeBootstrap('race-missing')).rejects.toThrow(/404/);
  });
});
