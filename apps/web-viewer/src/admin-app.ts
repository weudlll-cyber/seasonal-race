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

interface CatalogResponse<T> {
  items: T[];
}

interface ApiErrorBody {
  error?: string;
  message?: string;
}

interface AdminDom {
  apiBaseInput: HTMLInputElement;
  reloadCatalogBtn: HTMLButtonElement;
  trackSelect: HTMLSelectElement;
  racerSelect: HTMLSelectElement;
  orientationSelect: HTMLSelectElement;
  durationInput: HTMLInputElement;
  winnerCountInput: HTMLInputElement;
  seedInput: HTMLInputElement;
  brandingInput: HTMLInputElement;
  optionsInput: HTMLTextAreaElement;
  launchPreview: HTMLPreElement;
  launchBtn: HTMLButtonElement;
  runtimeBtn: HTMLButtonElement;
  statusBadge: HTMLSpanElement;
  statusText: HTMLDivElement;
  lastRaceBox: HTMLDivElement;
}

function renderAdminShell(): AdminDom {
  document.title = 'Seasonal Race - Admin Launch Console';
  document.body.className = '';
  document.body.innerHTML = `
    <main class="ops-root">
      <section class="ops-hero">
        <h1>Race Ops Console</h1>
        <p>Launch race sessions from catalog IDs with clean validation and runtime handoff.</p>
      </section>

      <section class="ops-layout">
        <article class="ops-card ops-form-card">
          <h2>Launch Setup</h2>

          <label for="ops-api-base">API Base</label>
          <div class="ops-inline">
            <input id="ops-api-base" value="/api/v1" />
            <button id="ops-reload-catalog" type="button">Reload Catalog</button>
          </div>

          <div class="ops-grid">
            <div>
              <label for="ops-track-select">Track</label>
              <select id="ops-track-select"></select>
            </div>
            <div>
              <label for="ops-racer-select">Racer List</label>
              <select id="ops-racer-select"></select>
            </div>
            <div>
              <label for="ops-orientation-select">Track Orientation</label>
              <select id="ops-orientation-select"></select>
            </div>
            <div>
              <label for="ops-duration">Duration (ms)</label>
              <input id="ops-duration" type="number" min="5000" max="300000" step="1000" value="45000" />
            </div>
            <div>
              <label for="ops-winner-count">Winner Count</label>
              <input id="ops-winner-count" type="number" min="1" max="100" step="1" value="3" />
            </div>
            <div>
              <label for="ops-seed">Seed (optional)</label>
              <input id="ops-seed" placeholder="for example: stream-heat-a" />
            </div>
          </div>

          <label for="ops-branding">Branding Profile ID (optional)</label>
          <input id="ops-branding" placeholder="for example: brand-neon" />

          <label for="ops-options">Additional options JSON (optional)</label>
          <textarea id="ops-options" spellcheck="false" placeholder='{"streamOverlay": true, "cameraProfile": "tight"}'></textarea>

          <div class="ops-actions">
            <button id="ops-launch-btn" class="primary" type="button">Start Race</button>
            <button id="ops-open-runtime-btn" type="button" disabled>Open Runtime View</button>
          </div>
        </article>

        <article class="ops-card ops-output-card">
          <h2>Launch Output</h2>
          <div class="ops-status-row">
            <span id="ops-status-badge" class="status idle">Idle</span>
            <div id="ops-status-text">Load catalogs and start a race.</div>
          </div>

          <h3>Request Preview</h3>
          <pre id="ops-launch-preview" class="ops-code"></pre>

          <h3>Last Started Race</h3>
          <div id="ops-last-race" class="ops-last-race">No race started yet.</div>
        </article>
      </section>
    </main>
  `;

  const style = document.createElement('style');
  style.textContent = `
    :root {
      --ops-bg-1: #08121b;
      --ops-bg-2: #0f2435;
      --ops-panel: #132a3f;
      --ops-panel-2: #17324a;
      --ops-border: #2d4f6d;
      --ops-text: #e7f1f8;
      --ops-muted: #9db3c7;
      --ops-accent: #4ad6b0;
      --ops-accent-2: #2f8cff;
      --ops-danger: #df6f6f;
      --ops-font: 'Space Grotesk', 'Trebuchet MS', 'Segoe UI', sans-serif;
    }

    body {
      margin: 0;
      color: var(--ops-text);
      min-height: 100svh;
      background:
        radial-gradient(100% 100% at 0% 0%, #1a3954 0%, transparent 48%),
        radial-gradient(90% 90% at 100% 100%, #122d49 0%, transparent 52%),
        linear-gradient(135deg, var(--ops-bg-1), var(--ops-bg-2));
      font-family: var(--ops-font);
    }

    .ops-root {
      max-width: 1240px;
      margin: 0 auto;
      padding: 20px;
      display: grid;
      gap: 14px;
    }

    .ops-hero {
      border: 1px solid #355e82;
      border-radius: 16px;
      background: linear-gradient(120deg, rgba(24, 58, 86, 0.9), rgba(23, 35, 55, 0.9));
      padding: 16px 18px;
    }

    .ops-hero h1 {
      margin: 0;
      font-size: 1.45rem;
      letter-spacing: 0.02em;
    }

    .ops-hero p {
      margin: 6px 0 0;
      color: var(--ops-muted);
      font-size: 0.96rem;
    }

    .ops-layout {
      display: grid;
      grid-template-columns: minmax(350px, 1.2fr) minmax(320px, 1fr);
      gap: 14px;
      align-items: start;
    }

    .ops-card {
      border: 1px solid var(--ops-border);
      border-radius: 14px;
      background: linear-gradient(180deg, var(--ops-panel) 0%, var(--ops-panel-2) 100%);
      padding: 14px;
      box-shadow: 0 14px 40px rgba(3, 11, 19, 0.32);
    }

    .ops-card h2 {
      margin: 0 0 10px;
      font-size: 1.02rem;
    }

    .ops-card h3 {
      margin: 12px 0 8px;
      font-size: 0.9rem;
      color: var(--ops-muted);
    }

    .ops-inline {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      margin-bottom: 10px;
    }

    .ops-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 9px;
      margin-bottom: 10px;
    }

    label {
      display: block;
      margin: 0 0 4px;
      color: var(--ops-muted);
      font-size: 0.82rem;
      letter-spacing: 0.01em;
    }

    input,
    select,
    textarea,
    button {
      width: 100%;
      border: 1px solid #3d6487;
      border-radius: 9px;
      background: #0b1f32;
      color: var(--ops-text);
      padding: 8px 9px;
      font-family: var(--ops-font);
      font-size: 0.9rem;
    }

    textarea {
      min-height: 115px;
      resize: vertical;
    }

    button {
      cursor: pointer;
      transition: filter 0.18s ease, transform 0.18s ease;
    }

    button:hover:not(:disabled) {
      filter: brightness(1.13);
      transform: translateY(-1px);
    }

    button:disabled {
      opacity: 0.56;
      cursor: not-allowed;
    }

    button.primary {
      background: linear-gradient(120deg, #206b57, #3e9f89);
      border-color: #4ab39d;
      font-weight: 600;
    }

    .ops-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px;
      margin-top: 10px;
    }

    .ops-status-row {
      display: grid;
      gap: 7px;
    }

    .status {
      width: fit-content;
      border-radius: 999px;
      border: 1px solid #5f7a93;
      background: #1f3446;
      padding: 2px 10px;
      font-size: 0.79rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .status.loading {
      background: #1f3b57;
      border-color: #4e84b3;
    }

    .status.success {
      background: #1f473d;
      border-color: #59b69f;
    }

    .status.error {
      background: #4b2626;
      border-color: var(--ops-danger);
    }

    .ops-code {
      margin: 0;
      border: 1px solid #2f5270;
      border-radius: 9px;
      background: #0a1826;
      padding: 10px;
      font-size: 0.8rem;
      line-height: 1.45;
      min-height: 160px;
      overflow: auto;
    }

    .ops-last-race {
      border: 1px dashed #3f6482;
      border-radius: 9px;
      background: #0b1f32;
      padding: 10px;
      min-height: 76px;
      display: grid;
      gap: 5px;
      font-size: 0.88rem;
    }

    .ops-last-race a {
      color: #85d7ff;
      text-decoration: none;
    }

    .ops-last-race a:hover {
      text-decoration: underline;
    }

    @media (max-width: 980px) {
      .ops-layout {
        grid-template-columns: 1fr;
      }

      .ops-grid {
        grid-template-columns: 1fr;
      }

      .ops-root {
        padding: 12px;
      }

      .ops-actions {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);

  const byId = <T extends HTMLElement>(id: string): T => {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Admin UI element not found: ${id}`);
    }
    return element as T;
  };

  return {
    apiBaseInput: byId<HTMLInputElement>('ops-api-base'),
    reloadCatalogBtn: byId<HTMLButtonElement>('ops-reload-catalog'),
    trackSelect: byId<HTMLSelectElement>('ops-track-select'),
    racerSelect: byId<HTMLSelectElement>('ops-racer-select'),
    orientationSelect: byId<HTMLSelectElement>('ops-orientation-select'),
    durationInput: byId<HTMLInputElement>('ops-duration'),
    winnerCountInput: byId<HTMLInputElement>('ops-winner-count'),
    seedInput: byId<HTMLInputElement>('ops-seed'),
    brandingInput: byId<HTMLInputElement>('ops-branding'),
    optionsInput: byId<HTMLTextAreaElement>('ops-options'),
    launchPreview: byId<HTMLPreElement>('ops-launch-preview'),
    launchBtn: byId<HTMLButtonElement>('ops-launch-btn'),
    runtimeBtn: byId<HTMLButtonElement>('ops-open-runtime-btn'),
    statusBadge: byId<HTMLSpanElement>('ops-status-badge'),
    statusText: byId<HTMLDivElement>('ops-status-text'),
    lastRaceBox: byId<HTMLDivElement>('ops-last-race')
  };
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
