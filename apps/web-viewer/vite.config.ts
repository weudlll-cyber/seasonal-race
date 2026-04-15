/**
 * File: apps/web-viewer/vite.config.ts
 * Purpose: Vite build configuration for the web-viewer PixiJS app.
 * Usage: Run `pnpm dev` from this package to start the dev server on port 5173.
 * Dependencies: Vite.
 * Edge cases: Alias @sr/* maps to workspace packages for clean imports.
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
