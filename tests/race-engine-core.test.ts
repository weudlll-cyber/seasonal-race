/**
 * File: tests/race-engine-core.test.ts
 * Purpose: Validates Phase-2 race engine core contracts and deterministic behavior.
 * Usage: Ensures session orchestration and registry contracts stay stable.
 * Dependencies: Vitest and race-engine modules.
 * Edge cases: Verifies seeded RNG repeatability and duplicate registry safeguards.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  createDeterministicRng,
  createRaceSession,
  type RaceAdapter,
  type RaceInitializationContext,
  type RaceTickResult
} from '../packages/race-engine/src/index';
import {
  clearRaceTypeRegistry,
  listRaceAdapters,
  registerRaceAdapter
} from '../packages/race-types/src/index';
import type { Participant, RaceResult, TrackDefinition } from '../packages/shared-types/src/index';

const participants: Participant[] = [
  { id: 'p1', displayName: 'Alice' },
  { id: 'p2', displayName: 'Bob' }
];

const track: TrackDefinition = {
  id: 'track-curve-1',
  name: 'Curve One',
  length: 1200,
  points: [
    { x: 0, y: 0 },
    { x: 500, y: 120 },
    { x: 1200, y: 30 }
  ]
};

class MockDuckAdapter implements RaceAdapter {
  public readonly raceType = 'duck' as const;

  private initializationContext?: RaceInitializationContext;

  private tickCounter = 0;

  initialize(context: RaceInitializationContext): void {
    this.initializationContext = context;
  }

  tick(_deltaMs: number): RaceTickResult {
    this.tickCounter += 1;

    return {
      finished: this.tickCounter >= 3,
      events: [{ type: 'mock.tick', payload: { tick: this.tickCounter } }]
    };
  }

  getState() {
    return {
      tick: this.tickCounter,
      elapsedMs: this.tickCounter * 100,
      seed: this.initializationContext?.seed ?? 'missing-seed'
    };
  }

  finalize(): RaceResult {
    return {
      raceId: this.initializationContext?.raceId ?? 'missing-race-id',
      raceType: this.raceType,
      seed: this.initializationContext?.seed ?? 'missing-seed',
      durationMs: this.tickCounter * 100,
      placements: [
        { participantId: 'p1', rank: 1, finishTimeMs: 250 },
        { participantId: 'p2', rank: 2, finishTimeMs: 290 }
      ]
    };
  }

  getInitializationContext(): RaceInitializationContext | undefined {
    return this.initializationContext;
  }
}

describe('race engine core', () => {
  beforeEach(() => {
    clearRaceTypeRegistry();
  });

  it('produces identical deterministic sequences for identical seeds', () => {
    const first = createDeterministicRng('seed-123');
    const second = createDeterministicRng('seed-123');

    const firstSequence = [first.next(), first.next(), first.nextInt(1, 10)];
    const secondSequence = [second.next(), second.next(), second.nextInt(1, 10)];

    expect(firstSequence).toEqual(secondSequence);
  });

  it('initializes and advances a session with deterministic seed', () => {
    const adapter = new MockDuckAdapter();
    const session = createRaceSession(adapter, {
      raceId: 'race-1',
      raceType: 'duck',
      participants,
      track,
      seed: 'seed-fixed'
    });

    const firstTick = session.advanceTick(100);
    const secondTick = session.advanceTick(100);

    expect(firstTick.finished).toBe(false);
    expect(secondTick.finished).toBe(false);
    expect(session.getCurrentTick()).toBe(2);
    expect(session.getElapsedMs()).toBe(200);
    expect(adapter.getInitializationContext()?.seed).toBe('seed-fixed');
    expect(adapter.getInitializationContext()?.track.id).toBe('track-curve-1');
  });

  it('throws when registering duplicate race adapters', () => {
    const adapter = new MockDuckAdapter();

    registerRaceAdapter(adapter);

    expect(() => registerRaceAdapter(adapter)).toThrow(/already registered/);
    expect(listRaceAdapters()).toHaveLength(1);
  });
});
