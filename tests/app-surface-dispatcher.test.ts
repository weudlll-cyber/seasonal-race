/**
 * File: tests/app-surface-dispatcher.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies bootstrap surface selection for web-viewer entrypoint.
 * Usage: Runs in Vitest as part of the regular test suite.
 * Dependencies: app-surface-dispatcher.
 */

import { describe, expect, it } from 'vitest';
import { resolveAppSurface } from '../apps/web-viewer/src/app-surface-dispatcher';

describe('app surface dispatcher', () => {
  it('defaults to studio when no mode is set', () => {
    expect(resolveAppSurface('')).toBe('studio');
    expect(resolveAppSurface('?foo=bar')).toBe('studio');
  });

  it('selects runtime only for explicit runtime mode', () => {
    expect(resolveAppSurface('?mode=runtime')).toBe('runtime');
    expect(resolveAppSurface('?mode=studio')).toBe('studio');
  });
});
