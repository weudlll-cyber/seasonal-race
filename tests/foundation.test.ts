/**
 * File: tests/foundation.test.ts
 * Purpose: Verifies that Phase 1 foundation modules are wired and importable.
 * Usage: Runs in CI as baseline guard for workspace tooling.
 * Dependencies: Vitest and shared package placeholders.
 * Edge cases: Keep deterministic and side-effect free.
 */

import { describe, expect, it } from 'vitest';

import { apiAppId } from '../apps/api/src/index';
import { webAdminAppId } from '../apps/web-admin/src/index';
import { webViewerAppId } from '../apps/web-viewer/src/index';
import { clearRaceTypeRegistry, listRaceAdapters } from '../packages/race-types/src/index';

describe('foundation bootstrap', () => {
  clearRaceTypeRegistry();

  it('exposes stable module identifiers', () => {
    expect(apiAppId).toBe('seasonal-race-api');
    expect(webAdminAppId).toBe('seasonal-race-web-admin');
    expect(webViewerAppId).toBe('seasonal-race-web-viewer');
  });

  it('starts with an empty race-type registry', () => {
    expect(listRaceAdapters()).toEqual([]);
  });
});
