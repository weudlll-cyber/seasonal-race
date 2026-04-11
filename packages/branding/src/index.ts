/**
 * File: packages/branding/src/index.ts
 * Purpose: Defines the baseline branding profile contract.
 * Usage: Shared between admin forms, API validation, and runtime theming.
 * Dependencies: TypeScript only.
 * Edge cases: Unknown token keys must be rejected by future validators.
 */

export interface BrandingProfile {
  id: string;
  name: string;
  palette: Record<string, string>;
}
