/**
 * File: apps/web-viewer/src/main.ts
 * Model: GPT-5.3-Codex
 * Purpose: Thin entry bootstrap that dispatches to the active app surface.
 * Usage: Vite default entrypoint for local viewer development.
 */

import { resolveAppSurface } from './app-surface-dispatcher';
import { startAdminApp } from './admin-app';
import { startRuntimeApp } from './runtime-app';
import { startStudioApp } from './studio-app';

const surface = resolveAppSurface(window.location.search);

if (surface === 'runtime') {
  startRuntimeApp().catch(console.error);
} else if (surface === 'admin') {
  startAdminApp().catch(console.error);
} else {
  startStudioApp().catch(console.error);
}
