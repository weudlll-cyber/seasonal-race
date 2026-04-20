/**
 * File: apps/web-viewer/src/admin-shell.ts
 * Model: GPT-5.3-Codex
 * Purpose: Renders and resolves the static admin launch shell DOM.
 * Usage: Imported by admin-app for the launch console bootstrap.
 */

export interface AdminDom {
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

export function renderAdminShell(): AdminDom {
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
