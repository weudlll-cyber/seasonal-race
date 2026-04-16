/**
 * File: apps/web-viewer/src/app-surface-dispatcher.ts
 * Model: GPT-5.3-Codex
 * Purpose: Resolves which web-viewer surface should be started by the main entrypoint.
 * Usage: Called from main bootstrap to select studio or runtime mode.
 */

export type AppSurface = 'studio' | 'runtime';

export function resolveAppSurface(search: string): AppSurface {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  return mode === 'runtime' ? 'runtime' : 'studio';
}
