/**
 * File: tests/foundation.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies that Phase 1 foundation modules are wired and importable.
 * Usage: Runs in CI as baseline guard for workspace tooling.
 * Dependencies: Vitest and shared package placeholders.
 */

import { describe, expect, it } from 'vitest';

import { apiAppId, buildApiApp } from '../apps/api/src/index';
import { TRACK_ORIENTATION_OPTIONS, webAdminAppId } from '../apps/web-admin/src/index';
import { webViewerAppId } from '../apps/web-viewer/src/index';
import { createSecureRng } from '../packages/race-engine/src/index';
import {
  clearRaceTypeRegistry,
  duckAdapter,
  getRaceAdapter,
  listRaceAdapters,
  registerDefaultAdapters
} from '../packages/race-types/src/index';
import { KNOWN_RACE_TYPES } from '../packages/shared-types/src/index';

describe('foundation bootstrap', () => {
  clearRaceTypeRegistry();

  it('exposes stable module identifiers', () => {
    expect(apiAppId).toBe('seasonal-race-api');
    expect(webAdminAppId).toBe('seasonal-race-web-admin');
    expect(webViewerAppId).toBe('seasonal-race-web-viewer');
  });

  it('exposes admin launch orientation options for UI wiring', () => {
    expect(TRACK_ORIENTATION_OPTIONS).toEqual([
      { value: 'left-to-right', label: 'Left to Right' },
      { value: 'top-to-bottom', label: 'Top to Bottom' }
    ]);
  });

  it('starts with an empty race-type registry', () => {
    expect(listRaceAdapters()).toEqual([]);
  });

  it('keeps key exported API contracts wired', () => {
    expect(typeof buildApiApp).toBe('function');
    expect(KNOWN_RACE_TYPES.DUCK).toBe('duck');

    const sample = createSecureRng().next();
    expect(sample).toBeGreaterThanOrEqual(0);
    expect(sample).toBeLessThan(1);

    clearRaceTypeRegistry();
    registerDefaultAdapters();
    expect(getRaceAdapter(KNOWN_RACE_TYPES.DUCK)).toBe(duckAdapter);
    clearRaceTypeRegistry();
  });
});
