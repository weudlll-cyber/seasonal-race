/**
 * File: vitest.config.ts
 * Model: GPT-5.3-Codex
 * Purpose: Configuration and test-runner setup for this workspace module.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false
  }
});
