/**
 * File: apps/web-admin/src/ops-launch-model.ts
 * Model: GPT-5.3-Codex
 * Purpose: Pure helpers for Ops/Admin race launch selectors and request construction.
 * Usage: Consumed by future admin UI to drive id-only launch flow from API catalogs.
 * Dependencies: None.
 */

export interface TrackCatalogOption {
  id: string;
  displayName: string;
  raceType: string;
}

export type TrackOrientation = 'left-to-right' | 'top-to-bottom';

export interface TrackOrientationOption {
  value: TrackOrientation;
  label: string;
}

export const TRACK_ORIENTATION_OPTIONS: TrackOrientationOption[] = [
  { value: 'left-to-right', label: 'Left to Right' },
  { value: 'top-to-bottom', label: 'Top to Bottom' }
];

export interface RacerCatalogOption {
  id: string;
  displayName: string;
  raceType: string;
}

export interface OpsLaunchSelectorModel {
  tracks: TrackCatalogOption[];
  racers: RacerCatalogOption[];
  selectedTrackId: string | null;
  selectedRacerListId: string | null;
  selectedBrandingProfileId: string | null;
  selectedTrackOrientation: TrackOrientation;
}

export interface StartRaceRequestBody {
  trackId: string;
  racerListId: string;
  durationMs?: number;
  winnerCount?: number;
  brandingProfileId?: string;
  seed?: string;
  options?: Record<string, string | number | boolean>;
}

export interface BuildStartRaceRequestOptions {
  seed?: string;
  durationMs?: number;
  winnerCount?: number;
  brandingProfileId?: string;
  trackOrientation?: TrackOrientation;
  options?: Record<string, string | number | boolean>;
}

export function createOpsLaunchSelectorModel(
  tracks: TrackCatalogOption[],
  racers: RacerCatalogOption[],
  currentSelection?: {
    trackId?: string;
    racerListId?: string;
    brandingProfileId?: string;
    trackOrientation?: TrackOrientation;
  }
): OpsLaunchSelectorModel {
  const selectedTrackId = resolveTrackSelection(tracks, currentSelection?.trackId);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId);

  const selectedRacerListId = resolveRacerSelection(
    racers,
    selectedTrack?.raceType,
    currentSelection?.racerListId
  );

  return {
    tracks,
    racers,
    selectedTrackId,
    selectedRacerListId,
    selectedBrandingProfileId: resolveOptionalSelection(currentSelection?.brandingProfileId),
    selectedTrackOrientation: normalizeTrackOrientation(currentSelection?.trackOrientation)
  };
}

export function buildStartRaceRequestBody(
  model: OpsLaunchSelectorModel,
  launchOptions: BuildStartRaceRequestOptions = {}
): StartRaceRequestBody {
  if (model.selectedTrackId === null) {
    throw new Error('Cannot build launch request: no track is selected.');
  }

  if (model.selectedRacerListId === null) {
    throw new Error('Cannot build launch request: no racer list is selected.');
  }

  const body: StartRaceRequestBody = {
    trackId: model.selectedTrackId,
    racerListId: model.selectedRacerListId
  };

  if (typeof launchOptions.seed === 'string' && launchOptions.seed.trim().length > 0) {
    body.seed = launchOptions.seed.trim();
  }

  if (typeof launchOptions.durationMs === 'number' && Number.isFinite(launchOptions.durationMs)) {
    body.durationMs = launchOptions.durationMs;
  }

  if (typeof launchOptions.winnerCount === 'number' && Number.isFinite(launchOptions.winnerCount)) {
    body.winnerCount = launchOptions.winnerCount;
  }

  const brandingId =
    typeof launchOptions.brandingProfileId === 'string'
      ? launchOptions.brandingProfileId
      : model.selectedBrandingProfileId;

  if (typeof brandingId === 'string' && brandingId.trim().length > 0) {
    body.brandingProfileId = brandingId.trim();
  }

  const optionBag: Record<string, string | number | boolean> = {
    ...(launchOptions.options ?? {})
  };

  const hasExplicitOrientation = launchOptions.trackOrientation !== undefined;
  const normalizedOrientation = hasExplicitOrientation
    ? normalizeTrackOrientation(launchOptions.trackOrientation)
    : model.selectedTrackOrientation;

  if (hasExplicitOrientation || normalizedOrientation !== 'left-to-right') {
    optionBag.trackOrientation = normalizedOrientation;
  }

  if (Object.keys(optionBag).length > 0) {
    body.options = optionBag;
  }

  return body;
}

function resolveOptionalSelection(requestedValue?: string): string | null {
  if (typeof requestedValue !== 'string') {
    return null;
  }

  const normalized = requestedValue.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTrackOrientation(
  value: BuildStartRaceRequestOptions['trackOrientation']
): TrackOrientation {
  if (value === 'left-to-right' || value === 'top-to-bottom') {
    return value;
  }

  return 'left-to-right';
}

function resolveTrackSelection(
  tracks: TrackCatalogOption[],
  requestedTrackId?: string
): string | null {
  if (tracks.length === 0) {
    return null;
  }

  if (
    typeof requestedTrackId === 'string' &&
    tracks.some((track) => track.id === requestedTrackId)
  ) {
    return requestedTrackId;
  }

  const firstTrack = tracks[0];
  return firstTrack?.id ?? null;
}

function resolveRacerSelection(
  racers: RacerCatalogOption[],
  selectedTrackRaceType?: string,
  requestedRacerListId?: string
): string | null {
  if (racers.length === 0) {
    return null;
  }

  if (
    typeof requestedRacerListId === 'string' &&
    racers.some((racerList) => racerList.id === requestedRacerListId)
  ) {
    return requestedRacerListId;
  }

  if (typeof selectedTrackRaceType === 'string') {
    const matchingRacerList = racers.find(
      (racerList) => racerList.raceType === selectedTrackRaceType
    );
    if (matchingRacerList) {
      return matchingRacerList.id;
    }
  }

  const firstRacerList = racers[0];
  return firstRacerList?.id ?? null;
}
