/**
 * File: packages/shared-types/src/index.ts
 * Purpose: Holds shared contracts consumed by apps and domain packages.
 * Usage: Import DTOs and identifiers from this package instead of duplicating shapes.
 * Dependencies: TypeScript only.
 * Edge cases: Keep backward compatibility for versioned API contracts.
 */

export type RaceTypeKey = 'duck' | 'horse' | 'rocket';

export interface Participant {
  id: string;
  displayName: string;
}
