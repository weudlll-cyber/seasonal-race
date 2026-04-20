/**
 * File: apps/api/src/index.ts
 * Model: GPT-5.3-Codex
 * Purpose: Exposes API module identity and app factory entrypoints.
 * Usage: Imported by tests and future API runtime process bootstrap.
 * Dependencies: API app builder module.
 */

export { buildApiApp, type BuildApiAppOptions } from './app';
export {
  createFileRaceLaunchStore,
  createInMemoryRaceLaunchStore,
  type CreateFileRaceLaunchStoreOptions,
  type CreateInMemoryRaceLaunchStoreOptions,
  type RaceLaunchStore
} from './race-launch-store';

export const apiAppId = 'seasonal-race-api';
