/**
 * File: tests/ops-launch-model.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies Ops launch selector defaults and request-body construction.
 * Usage: Runs in Vitest as part of CI regression coverage for admin launch flow.
 * Dependencies: ops-launch-model helper module.
 */

import { describe, expect, it } from 'vitest';

import {
  buildStartRaceRequestBody,
  createOpsLaunchSelectorModel,
  type RacerCatalogOption,
  type TrackCatalogOption
} from '../apps/web-admin/src/ops-launch-model';

const tracks: TrackCatalogOption[] = [
  { id: 'duck-canal-s-curve', displayName: 'Duck Canal S Curve', raceType: 'duck' },
  { id: 'horse-arena-oval', displayName: 'Horse Arena Oval', raceType: 'horse' }
];

const racers: RacerCatalogOption[] = [
  { id: 'duck-default', displayName: 'Duck Default', raceType: 'duck' },
  { id: 'horse-default', displayName: 'Horse Default', raceType: 'horse' }
];

describe('ops launch model', () => {
  it('selects first track and matching racer list by default', () => {
    const model = createOpsLaunchSelectorModel(tracks, racers);

    expect(model.selectedTrackId).toBe('duck-canal-s-curve');
    expect(model.selectedRacerListId).toBe('duck-default');
  });

  it('keeps valid explicit selection and builds launch request body', () => {
    const model = createOpsLaunchSelectorModel(tracks, racers, {
      trackId: 'horse-arena-oval',
      racerListId: 'horse-default'
    });

    const body = buildStartRaceRequestBody(model, '  seed-42  ');

    expect(body).toEqual({
      trackId: 'horse-arena-oval',
      racerListId: 'horse-default',
      seed: 'seed-42'
    });
  });

  it('throws when no selectors are available to build request', () => {
    const model = createOpsLaunchSelectorModel([], []);

    expect(() => buildStartRaceRequestBody(model)).toThrow(/no track is selected/i);
  });
});
