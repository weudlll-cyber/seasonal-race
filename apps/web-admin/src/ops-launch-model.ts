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
}

export interface StartRaceRequestBody {
  trackId: string;
  racerListId: string;
  seed?: string;
}

export function createOpsLaunchSelectorModel(
  tracks: TrackCatalogOption[],
  racers: RacerCatalogOption[],
  currentSelection?: { trackId?: string; racerListId?: string }
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
    selectedRacerListId
  };
}

export function buildStartRaceRequestBody(
  model: OpsLaunchSelectorModel,
  seed?: string
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

  if (typeof seed === 'string' && seed.trim().length > 0) {
    body.seed = seed.trim();
  }

  return body;
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
