/**
 * File: packages/branding/src/index.ts
 * Model: GPT-5.3-Codex
 * Purpose: Defines the baseline branding profile contract.
 * Usage: Shared between admin forms, API validation, and runtime theming.
 * Dependencies: TypeScript only.
 */

export interface BrandingProfile {
  id: string;
  name: string;
  palette: Record<string, string>;
}
