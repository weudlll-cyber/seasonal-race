/**
 * File: apps/web-viewer/src/runtime-bootstrap-client.ts
 * Model: GPT-5.3-Codex
 * Purpose: Runtime bootstrap client helpers for loading launched race payloads.
 * Usage: Used by runtime-app to resolve race id from URL and fetch startup payload.
 * Dependencies: Shared runtime bootstrap contracts.
 */

import type { RuntimeBootstrapPayload } from '../../../packages/shared-types/src/index.js';
import { resolveTrackOrientationFromSearch, type TrackOrientation } from './track-orientation.js';

interface RuntimeCatalogTrackItem {
  id: string;
  raceType: string;
}

interface RuntimeCatalogRacerItem {
  id: string;
  raceType: string;
}

interface RuntimeCatalogResponse<T> {
  items: T[];
}

interface RuntimeLaunchResponse {
  raceId: string;
}

export function resolveRuntimeRaceId(search: string): string | null {
  const params = new URLSearchParams(search);
  const raceId = params.get('raceId');
  if (!raceId) {
    return null;
  }

  const normalized = raceId.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveRuntimeApiBase(search: string): string {
  const params = new URLSearchParams(search);
  const apiBase = params.get('apiBase');

  if (!apiBase) {
    return '/api/v1';
  }

  const normalized = apiBase.trim();
  return normalized.length > 0 ? normalized : '/api/v1';
}

export function resolveRuntimeTrackOrientation(search: string): TrackOrientation {
  return resolveTrackOrientationFromSearch(search);
}

export async function fetchRuntimeBootstrap(
  raceId: string,
  apiBase = '/api/v1'
): Promise<RuntimeBootstrapPayload> {
  const response = await fetch(`${apiBase}/races/${encodeURIComponent(raceId)}/runtime-bootstrap`);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Runtime bootstrap request failed (${response.status}): ${message}`);
  }

  return (await response.json()) as RuntimeBootstrapPayload;
}

export async function launchRuntimeRaceFromDefaults(apiBase = '/api/v1'): Promise<string> {
  const [tracksResponse, racersResponse] = await Promise.all([
    fetch(`${apiBase}/catalog/tracks`),
    fetch(`${apiBase}/catalog/racers`)
  ]);

  if (!tracksResponse.ok || !racersResponse.ok) {
    throw new Error('Unable to load runtime catalogs for auto-launch.');
  }

  const tracksPayload =
    (await tracksResponse.json()) as RuntimeCatalogResponse<RuntimeCatalogTrackItem>;
  const racersPayload =
    (await racersResponse.json()) as RuntimeCatalogResponse<RuntimeCatalogRacerItem>;
  const tracks = tracksPayload.items ?? [];
  const racers = racersPayload.items ?? [];

  const pair = tracks
    .map((track) => {
      const racer = racers.find((entry) => entry.raceType === track.raceType);
      return racer ? { trackId: track.id, racerListId: racer.id } : null;
    })
    .find((candidate): candidate is { trackId: string; racerListId: string } => candidate !== null);

  if (!pair) {
    throw new Error('No compatible track/racer catalog pair found for auto-launch.');
  }

  const launchResponse = await fetch(`${apiBase}/races/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackId: pair.trackId,
      racerListId: pair.racerListId,
      durationMs: 55_000,
      winnerCount: 3,
      options: { trackOrientation: 'left-to-right' }
    })
  });

  if (!launchResponse.ok) {
    const details = await launchResponse.text();
    throw new Error(`Auto-launch request failed (${launchResponse.status}): ${details}`);
  }

  const payload = (await launchResponse.json()) as RuntimeLaunchResponse;
  if (!payload.raceId) {
    throw new Error('Auto-launch response did not include raceId.');
  }

  return payload.raceId;
}
