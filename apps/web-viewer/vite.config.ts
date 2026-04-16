/**
 * File: apps/web-viewer/vite.config.ts
 * Model: GPT-5.3-Codex
 * Purpose: Vite build configuration for the web-viewer PixiJS app.
 * Usage: Run `pnpm dev` from this package to start the dev server on port 5173.
 * Dependencies: Vite.
 */

import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      // Map workspace packages so viewer can import them without relative hell
      '@sr/shared-types': resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@sr/race-engine': resolve(__dirname, '../../packages/race-engine/src/index.ts'),
      '@sr/race-types': resolve(__dirname, '../../packages/race-types/src/index.ts')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 5173
  }
});
