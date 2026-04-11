/**
 * File: packages/shared-types/src/index.ts
 * Purpose: Holds shared contracts consumed by apps and domain packages.
 * Usage: Import DTOs and identifiers from this package instead of duplicating shapes.
 * Dependencies: TypeScript only.
 * Edge cases: Keep backward compatibility for versioned API contracts.
 */

export type RaceTypeKey = 'duck' | 'horse' | 'rocket';

export type ResultExportFormat = 'json' | 'csv' | 'webhook';

export type IntegrationEventType =
  | 'race.started'
  | 'race.tick'
  | 'race.finished'
  | 'race.result.exported';

export interface Participant {
  id: string;
  displayName: string;
}

export interface TrackPoint {
  x: number;
  y: number;
}

export interface TrackDefinition {
  id: string;
  name: string;
  length: number;
  points: TrackPoint[];
  effectProfileId?: string;
}

export interface NameList {
  id: string;
  name: string;
  names: string[];
}

export interface RacePlacement {
  participantId: string;
  rank: number;
  finishTimeMs: number;
}

export interface RaceResult {
  raceId: string;
  raceType: RaceTypeKey;
  seed: string;
  durationMs: number;
  placements: RacePlacement[];
}

export interface IntegrationEvent<TPayload = unknown> {
  type: IntegrationEventType;
  occurredAt: string;
  payload: TPayload;
}

export interface NameListProvider {
  readonly providerId: string;
  importNames(input: string): Promise<NameList>;
}

export interface ResultExporter {
  readonly format: ResultExportFormat;
  exportResult(result: RaceResult): Promise<string>;
}

export interface IntegrationConnector {
  readonly connectorId: string;
  publish(event: IntegrationEvent): Promise<void>;
}
