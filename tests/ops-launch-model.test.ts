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
      racerListId: 'horse-default',
      brandingProfileId: 'brand-neon'
    });

    const body = buildStartRaceRequestBody(model, {
      seed: '  seed-42  ',
      durationMs: 50_000,
      winnerCount: 2,
      options: {
        weather: 'fog',
        boostPads: true
      }
    });

    expect(body).toEqual({
      trackId: 'horse-arena-oval',
      racerListId: 'horse-default',
      seed: 'seed-42',
      durationMs: 50_000,
      winnerCount: 2,
      brandingProfileId: 'brand-neon',
      options: {
        weather: 'fog',
        boostPads: true
      }
    });
  });

  it('throws when no selectors are available to build request', () => {
    const model = createOpsLaunchSelectorModel([], []);

    expect(() => buildStartRaceRequestBody(model)).toThrow(/no track is selected/i);
  });

  it('allows overriding branding id from launch options for future extension workflows', () => {
    const model = createOpsLaunchSelectorModel(tracks, racers, {
      trackId: 'duck-canal-s-curve',
      racerListId: 'duck-default',
      brandingProfileId: 'brand-default'
    });

    const body = buildStartRaceRequestBody(model, {
      brandingProfileId: 'brand-event-special'
    });

    expect(body.brandingProfileId).toBe('brand-event-special');
  });

  it('maps track orientation launch option into options payload', () => {
    const model = createOpsLaunchSelectorModel(tracks, racers, {
      trackId: 'duck-canal-s-curve',
      racerListId: 'duck-default'
    });

    const body = buildStartRaceRequestBody(model, {
      trackOrientation: 'top-to-bottom',
      options: {
        weather: 'clear'
      }
    });

    expect(body.options).toEqual({
      weather: 'clear',
      trackOrientation: 'top-to-bottom'
    });
  });
});
