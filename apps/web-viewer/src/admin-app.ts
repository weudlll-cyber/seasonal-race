/**
 * File: apps/web-viewer/src/admin-app.ts
 * Model: GPT-5.3-Codex
 * Purpose: Provides a dedicated web-admin launch UI surface in the viewer host.
 * Usage: Started by main bootstrap when URL mode is set to admin.
 * Dependencies: Ops launch model helpers and shared launch contracts.
 */

import type {
  LaunchOptionPrimitive,
  RaceLaunchResolvedConfig
} from '../../../packages/shared-types/src/index';
import {
  TRACK_ORIENTATION_OPTIONS,
  buildStartRaceRequestBody,
  createOpsLaunchSelectorModel,
  type BuildStartRaceRequestOptions,
  type RacerCatalogOption,
  type TrackCatalogOption,
  type TrackOrientation
} from '../../web-admin/src/index';
import { renderAdminShell, type AdminDom } from './admin-shell.js';

interface CatalogResponse<T> {
  items: T[];
}

interface ApiErrorBody {
  error?: string;
  message?: string;
}

function normalizeApiBase(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '/api/v1';
}

function toPositiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function setStatus(
  dom: AdminDom,
  state: 'idle' | 'loading' | 'success' | 'error',
  message: string
): void {
  dom.statusBadge.className = `status ${state}`;
  dom.statusBadge.textContent = state === 'idle' ? 'Idle' : state.toUpperCase();
  dom.statusText.textContent = message;
}

function parseOptionsJson(rawValue: string): Record<string, LaunchOptionPrimitive> {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return {};
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Additional options must be a JSON object.');
  }

  const result: Record<string, LaunchOptionPrimitive> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
      continue;
    }

    throw new Error(
      `Invalid option value for key "${key}". Only string, number, or boolean are allowed.`
    );
  }

  return result;
}

function buildLaunchOptionsFromDom(dom: AdminDom): BuildStartRaceRequestOptions {
  const durationMs = toPositiveNumber(dom.durationInput.value);
  const winnerCount = toPositiveNumber(dom.winnerCountInput.value);
  const seed = dom.seedInput.value.trim();
  const brandingProfileId = dom.brandingInput.value.trim();

  return {
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(winnerCount !== undefined ? { winnerCount } : {}),
    ...(seed.length > 0 ? { seed } : {}),
    ...(brandingProfileId.length > 0 ? { brandingProfileId } : {}),
    trackOrientation: dom.orientationSelect.value as TrackOrientation,
    options: parseOptionsJson(dom.optionsInput.value)
  };
}

function updateTrackOptions(
  dom: AdminDom,
  tracks: TrackCatalogOption[],
  selectedTrackId?: string
): void {
  dom.trackSelect.innerHTML = '';
  for (const track of tracks) {
    const option = document.createElement('option');
    option.value = track.id;
    option.textContent = `${track.displayName} (${track.raceType})`;
    dom.trackSelect.appendChild(option);
  }

  if (selectedTrackId && tracks.some((track) => track.id === selectedTrackId)) {
    dom.trackSelect.value = selectedTrackId;
  }
}

function updateRacerOptions(
  dom: AdminDom,
  tracks: TrackCatalogOption[],
  racers: RacerCatalogOption[],
  selectedTrackId: string,
  requestedRacerId?: string
): void {
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId);
  const filteredRacers = selectedTrack
    ? racers.filter((racer) => racer.raceType === selectedTrack.raceType)
    : racers;

  dom.racerSelect.innerHTML = '';
  for (const racer of filteredRacers) {
    const option = document.createElement('option');
    option.value = racer.id;
    option.textContent = `${racer.displayName} (${racer.raceType})`;
    dom.racerSelect.appendChild(option);
  }

  if (requestedRacerId && filteredRacers.some((racer) => racer.id === requestedRacerId)) {
    dom.racerSelect.value = requestedRacerId;
  }
}

function updateOrientationOptions(dom: AdminDom): void {
  dom.orientationSelect.innerHTML = '';
  for (const orientation of TRACK_ORIENTATION_OPTIONS) {
    const option = document.createElement('option');
    option.value = orientation.value;
    option.textContent = orientation.label;
    dom.orientationSelect.appendChild(option);
  }
  dom.orientationSelect.value = 'left-to-right';
}

function buildRuntimeUrl(raceId: string, apiBase: string): string {
  const params = new URLSearchParams({
    mode: 'runtime',
    raceId
  });

  if (apiBase !== '/api/v1') {
    params.set('apiBase', apiBase);
  }

  return `${window.location.pathname}?${params.toString()}`;
}

async function fetchCatalog<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const message =
      typeof errorBody.message === 'string' && errorBody.message.trim().length > 0
        ? errorBody.message
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  const payload = (await response.json()) as CatalogResponse<T>;
  return payload.items;
}

export async function startAdminApp(): Promise<void> {
  const dom = renderAdminShell();
  updateOrientationOptions(dom);

  let tracks: TrackCatalogOption[] = [];
  let racers: RacerCatalogOption[] = [];
  let runtimeUrl: string | null = null;

  const refreshPreview = (): void => {
    if (tracks.length === 0 || racers.length === 0) {
      dom.launchPreview.textContent = '{\n  "status": "catalogs-not-loaded"\n}';
      return;
    }

    try {
      const model = createOpsLaunchSelectorModel(tracks, racers, {
        trackId: dom.trackSelect.value,
        racerListId: dom.racerSelect.value,
        brandingProfileId: dom.brandingInput.value,
        trackOrientation: dom.orientationSelect.value as TrackOrientation
      });

      const requestBody = buildStartRaceRequestBody(model, buildLaunchOptionsFromDom(dom));

      dom.launchPreview.textContent = JSON.stringify(requestBody, null, 2);
      setStatus(dom, 'idle', 'Launch request preview is ready.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to build launch request preview.';
      setStatus(dom, 'error', message);
      dom.launchPreview.textContent = JSON.stringify({ error: message }, null, 2);
    }
  };

  const loadCatalogs = async (): Promise<void> => {
    const apiBase = normalizeApiBase(dom.apiBaseInput.value);
    setStatus(dom, 'loading', 'Loading track and racer catalogs...');
    dom.reloadCatalogBtn.disabled = true;
    dom.launchBtn.disabled = true;
    dom.runtimeBtn.disabled = true;

    try {
      const [trackItems, racerItems] = await Promise.all([
        fetchCatalog<TrackCatalogOption>(`${apiBase}/catalog/tracks`),
        fetchCatalog<RacerCatalogOption>(`${apiBase}/catalog/racers`)
      ]);

      tracks = trackItems;
      racers = racerItems;

      if (tracks.length === 0 || racers.length === 0) {
        throw new Error('Catalog response was empty. Add track and racer entries first.');
      }

      updateTrackOptions(dom, tracks, dom.trackSelect.value);
      updateRacerOptions(dom, tracks, racers, dom.trackSelect.value, dom.racerSelect.value);

      dom.launchBtn.disabled = false;
      refreshPreview();
      setStatus(
        dom,
        'success',
        `Catalog loaded: ${tracks.length} tracks, ${racers.length} racer lists.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Catalog loading failed.';
      setStatus(dom, 'error', message);
      dom.launchPreview.textContent = JSON.stringify({ error: message }, null, 2);
    } finally {
      dom.reloadCatalogBtn.disabled = false;
    }
  };

  const onLaunch = async (): Promise<void> => {
    if (tracks.length === 0 || racers.length === 0) {
      setStatus(dom, 'error', 'Load catalogs before launching a race.');
      return;
    }

    setStatus(dom, 'loading', 'Starting race...');
    dom.launchBtn.disabled = true;
    dom.runtimeBtn.disabled = true;

    try {
      const model = createOpsLaunchSelectorModel(tracks, racers, {
        trackId: dom.trackSelect.value,
        racerListId: dom.racerSelect.value,
        brandingProfileId: dom.brandingInput.value,
        trackOrientation: dom.orientationSelect.value as TrackOrientation
      });

      const requestBody = buildStartRaceRequestBody(model, buildLaunchOptionsFromDom(dom));

      const apiBase = normalizeApiBase(dom.apiBaseInput.value);
      const response = await fetch(`${apiBase}/races/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as ApiErrorBody;
        const message =
          typeof errorBody.message === 'string' && errorBody.message.trim().length > 0
            ? errorBody.message
            : `Start request failed (${response.status})`;
        throw new Error(message);
      }

      const launch = (await response.json()) as RaceLaunchResolvedConfig;
      runtimeUrl = buildRuntimeUrl(launch.raceId, apiBase);
      dom.runtimeBtn.disabled = false;

      dom.lastRaceBox.innerHTML = `
        <div><strong>Race ID:</strong> ${launch.raceId}</div>
        <div><strong>Type:</strong> ${launch.raceType}</div>
        <div><strong>Track:</strong> ${launch.trackId} | <strong>Racers:</strong> ${launch.racerListId}</div>
        <div><strong>Seed:</strong> ${launch.seed}</div>
        <a href="${runtimeUrl}" target="_blank" rel="noreferrer">Open Runtime in new tab</a>
      `;

      setStatus(dom, 'success', `Race ${launch.raceId} started successfully.`);
      dom.launchPreview.textContent = JSON.stringify(requestBody, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Race launch failed.';
      setStatus(dom, 'error', message);
      dom.lastRaceBox.textContent = 'No race started yet.';
    } finally {
      dom.launchBtn.disabled = false;
    }
  };

  dom.reloadCatalogBtn.addEventListener('click', () => {
    void loadCatalogs();
  });

  dom.trackSelect.addEventListener('change', () => {
    updateRacerOptions(dom, tracks, racers, dom.trackSelect.value, dom.racerSelect.value);
    refreshPreview();
  });

  dom.racerSelect.addEventListener('change', refreshPreview);
  dom.orientationSelect.addEventListener('change', refreshPreview);
  dom.durationInput.addEventListener('input', refreshPreview);
  dom.winnerCountInput.addEventListener('input', refreshPreview);
  dom.seedInput.addEventListener('input', refreshPreview);
  dom.brandingInput.addEventListener('input', refreshPreview);
  dom.optionsInput.addEventListener('input', refreshPreview);

  dom.launchBtn.addEventListener('click', () => {
    void onLaunch();
  });

  dom.runtimeBtn.addEventListener('click', () => {
    if (!runtimeUrl) {
      return;
    }
    window.open(runtimeUrl, '_blank', 'noopener,noreferrer');
  });

  await loadCatalogs();
}
