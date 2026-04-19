/**
 * File: apps/web-viewer/src/runtime-bootstrap-client.ts
 * Model: GPT-5.3-Codex
 * Purpose: Runtime bootstrap client helpers for loading launched race payloads.
 * Usage: Used by runtime-app to resolve race id from URL and fetch startup payload.
 * Dependencies: Shared runtime bootstrap contracts.
 */

import type { RuntimeBootstrapPayload } from '../../../packages/shared-types/src/index.js';

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
