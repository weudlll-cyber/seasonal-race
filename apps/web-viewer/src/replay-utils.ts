/**
 * File: apps/web-viewer/src/replay-utils.ts
 * Model: GPT-5.3-Codex
 * Purpose: Build and sample deterministic recorded-race style replay data.
 * Usage: Used by the track editor to preview how a real race might look on a custom track.
 * Dependencies: None.
 */

export interface RecordedRacerFrame {
  id: string;
  progress: number;
}

export interface RecordedRaceFrame {
  timeMs: number;
  finished: boolean;
  racers: RecordedRacerFrame[];
}

export interface RecordedRaceData {
  durationMs: number;
  frames: RecordedRaceFrame[];
}

/**
 * Creates deterministic pseudo-recorded race data with rich, unpredictable dynamics.
 *
 * Design goals (for demo AND future real-game use):
 * - Frequent overtakes throughout the entire race.
 * - No racer is "obviously" the winner at any point before the final stretch.
 * - Racers go through random fast/slow momentum phases.
 * - Random surge/slump events create dramatic position swings.
 * - Pack stays competitive but naturally spreads toward the finish.
 * - Every race looks different even with the same racer set.
 */
export function buildDemoRecordedRaceData(
  racerIds: string[],
  durationMs = 42_000,
  stepMs = 200,
  raceSeed = 0
): RecordedRaceData {
  const safeDuration = Math.max(5_000, durationMs);
  const safeStep = Math.max(50, stepMs);
  const durationSec = safeDuration / 1000;

  const progressById = new Map<string, number>();
  for (const id of racerIds) progressById.set(id, 0);

  // --- Per-racer trait generation ---
  // Each racer gets a unique profile built from deterministic hashing.
  const MOMENTUM_LAYERS = 4; // overlapping sine waves at different frequencies
  const SURGE_COUNT = 8; // frequent but softer burst/slump events per racer

  interface RacerProfile {
    /** Base speed multiplier — kept very tight so nobody is "clearly fastest". */
    baseBias: number;
    /** Momentum wave parameters: [frequency, amplitude, phase] per layer. */
    momentumWaves: Array<{ freq: number; amp: number; phase: number }>;
    /** Discrete surge/slump events: [racePhase, strength, width]. */
    surges: Array<{ center: number; strength: number; width: number }>;
    /** Sector strength: how well the racer performs in each race third. */
    sectorStrengths: [number, number, number];
  }

  const profiles = new Map<string, RacerProfile>();
  for (const id of racerIds) {
    const seed = hashString(`${id}|${raceSeed}`);
    let saltIdx = 0;
    const u = () => unitFromSeed(seed, saltIdx++);

    // Very tight base bias: ±1.1% — NOT the main differentiator.
    const baseBias = mapUnitToRange(u(), -0.009, 0.009);

    // Momentum waves: multi-frequency oscillations creating unpredictable speed patterns.
    const momentumWaves: RacerProfile['momentumWaves'] = [];
    for (let i = 0; i < MOMENTUM_LAYERS; i++) {
      momentumWaves.push({
        freq: mapUnitToRange(u(), 0.15 + i * 0.3, 0.6 + i * 0.5),
        amp: mapUnitToRange(u(), 0.03, 0.08),
        phase: mapUnitToRange(u(), 0, Math.PI * 2)
      });
    }

    // Surge/slump events scattered randomly across the race.
    const surges: RacerProfile['surges'] = [];
    for (let i = 0; i < SURGE_COUNT; i++) {
      surges.push({
        center: mapUnitToRange(u(), 0.05, 0.95), // when in race
        strength: mapUnitToRange(u(), -0.115, 0.115), // negative = slump, positive = surge
        width: mapUnitToRange(u(), 0.028, 0.09) // how wide the event is
      });
    }

    // Sector strengths: different racers dominate different race phases.
    const sectorStrengths: [number, number, number] = [
      mapUnitToRange(u(), -0.055, 0.055), // early
      mapUnitToRange(u(), -0.055, 0.055), // mid
      mapUnitToRange(u(), -0.055, 0.055) // late
    ];

    profiles.set(id, { baseBias, momentumWaves, surges, sectorStrengths });
  }

  // --- Simulation loop ---
  const extendedDurationMs = Math.round(safeDuration * 1.35);

  const frames: RecordedRaceFrame[] = [];
  for (let timeMs = 0; timeMs <= extendedDurationMs; timeMs += safeStep) {
    const t = timeMs / 1000;
    const racePhase = Math.min(1, t / durationSec);

    // Compute pack average for competitive rubber-banding.
    let packSum = 0;
    for (const id of racerIds) packSum += progressById.get(id) ?? 0;
    const packAvg = racerIds.length > 0 ? packSum / racerIds.length : 0;

    const orderedIds = [...racerIds].sort(
      (a, b) => (progressById.get(b) ?? 0) - (progressById.get(a) ?? 0)
    );
    const rankById = new Map<string, number>();
    for (let i = 0; i < orderedIds.length; i += 1) {
      rankById.set(orderedIds[i]!, i + 1);
    }

    for (const id of racerIds) {
      const baseSpeed = 1 / durationSec;
      const profile = profiles.get(id)!;
      const current = progressById.get(id) ?? 0;

      // 1. Base bias (tiny constant offset)
      let speedMultiplier = 1 + profile.baseBias;

      // 1b. Natural launch ramp: avoid hard early burst then sudden slowdown.
      const launchT = Math.max(0, Math.min(1, racePhase / 0.2));
      const launchRamp = 0.62 + smoothstep(launchT) * 0.38;
      const startDynamicsBlend = smoothstep(Math.max(0, Math.min(1, (racePhase - 0.06) / 0.2)));
      speedMultiplier *= launchRamp;

      // 2. Momentum waves — the main source of overtakes.
      // Multiple overlapping waves create unpredictable fast/slow phases.
      let momentumTotal = 0;
      for (const wave of profile.momentumWaves) {
        momentumTotal += wave.amp * Math.sin(t * wave.freq + wave.phase);
      }
      speedMultiplier += momentumTotal * startDynamicsBlend;

      // 3. Surge/slump events — dramatic bursts and drops.
      for (const surge of profile.surges) {
        const dist = Math.abs(racePhase - surge.center);
        if (dist < surge.width * 2) {
          const influence = Math.exp(-(dist * dist) / (2 * surge.width * surge.width));
          speedMultiplier += surge.strength * influence * startDynamicsBlend;
        }
      }

      // 4. Sector strength — different racers shine in different race thirds.
      const sectorIndex = Math.min(2, Math.floor(racePhase * 3));
      const sectorBlend = racePhase * 3 - sectorIndex;
      const currentSector = profile.sectorStrengths[sectorIndex]!;
      const nextSector = profile.sectorStrengths[Math.min(2, sectorIndex + 1)]!;
      speedMultiplier +=
        (currentSector * (1 - sectorBlend) + nextSector * sectorBlend) * startDynamicsBlend;

      // 5. Competitive rubber-banding — keeps the pack exciting.
      // Racers ahead of the pack get slightly slower, racers behind get a boost.
      const gap = current - packAvg;
      const rubberBand = -gap * 0.68; // strength of the pull toward pack
      speedMultiplier += rubberBand * startDynamicsBlend;

      // 5b. Early/mid anti-persistence pressure:
      // if a racer sits in top-5, apply a very small drag; immediate chasers get
      // a small boost. This increases lead changes without looking artificial.
      const rank = rankById.get(id) ?? racerIds.length;
      const pressurePhase = Math.max(0, Math.min(1, (racePhase - 0.05) / 0.85));
      const pressureWindow = pressurePhase * (1 - pressurePhase) * 4; // bell-ish 0..1
      if (rank <= 5) {
        const topDepth = (6 - rank) / 5; // 1.0 for P1, smaller for P5
        speedMultiplier -= 0.07 * topDepth * pressureWindow * startDynamicsBlend;
      } else if (rank <= 24) {
        const chaseDepth = (25 - rank) / 19; // strongest for P6, fades to P24
        speedMultiplier += 0.056 * chaseDepth * pressureWindow * startDynamicsBlend;
      }

      // 5c. Local pack compression around the front group to trigger natural overtakes
      // without large raw speed jumps.
      if (rank <= 28) {
        const leaderId = orderedIds[0];
        const leaderProgress = leaderId ? (progressById.get(leaderId) ?? current) : current;
        const toLeader = leaderProgress - current;
        if (toLeader > 0 && toLeader < 0.14) {
          const chaseWindow = Math.sin(Math.max(0, Math.min(1, racePhase)) * Math.PI);
          const localBoost = (0.14 - toLeader) / 0.14;
          speedMultiplier += 0.048 * localBoost * chaseWindow * startDynamicsBlend;
        }
      }

      // 6. Natural spread toward finish — reduce rubber-banding only late
      // so a real winner can emerge.
      if (racePhase > 0.94) {
        const finalPhase = (racePhase - 0.94) / 0.06;
        // Partially release the rubber band for the finishing stretch.
        speedMultiplier -= rubberBand * finalPhase * 0.18;
      }

      // Keep per-step changes believable; early race should ramp to race pace
      // without overshooting above it.
      const minBound = lerp(0.58, 0.78, smoothstep(Math.max(0, Math.min(1, racePhase / 0.18))));
      const maxBound =
        racePhase < 0.22
          ? lerp(0.82, 1.0, smoothstep(Math.max(0, Math.min(1, racePhase / 0.22))))
          : 1.22;
      speedMultiplier = Math.max(minBound, Math.min(maxBound, speedMultiplier));

      const speed = Math.max(0.0001, baseSpeed * speedMultiplier);
      const next = Math.min(1, current + speed * (safeStep / 1000));
      progressById.set(id, next);
    }

    const allDone = racerIds.every((id) => (progressById.get(id) ?? 0) >= 0.9999);

    frames.push({
      timeMs,
      finished: allDone,
      racers: racerIds.map((id) => ({
        id,
        progress: round4(progressById.get(id) ?? 0)
      }))
    });

    if (allDone) break;
  }

  const actualDurationMs = frames.length > 0 ? frames[frames.length - 1]!.timeMs : safeDuration;

  return {
    durationMs: actualDurationMs,
    frames: dedupeByTime(frames)
  };
}

/**
 * Samples replay data at arbitrary time by linear interpolation between two frames.
 */
export function sampleReplayAtTime(data: RecordedRaceData, timeMs: number): RecordedRaceFrame {
  if (data.frames.length === 0) {
    return { timeMs: 0, finished: true, racers: [] };
  }

  const clamped = Math.max(0, Math.min(data.durationMs, timeMs));
  const frames = data.frames;

  let rightIndex = frames.findIndex((f) => f.timeMs >= clamped);
  if (rightIndex === -1) rightIndex = frames.length - 1;
  const leftIndex = Math.max(0, rightIndex - 1);

  const left = frames[leftIndex]!;
  const right = frames[rightIndex]!;
  if (left.timeMs === right.timeMs) {
    return {
      timeMs: clamped,
      finished: clamped >= data.durationMs,
      racers: left.racers.map((r) => ({ id: r.id, progress: r.progress }))
    };
  }

  const alpha = (clamped - left.timeMs) / (right.timeMs - left.timeMs);
  const progressById = new Map<string, number>();

  for (const l of left.racers) {
    const r = right.racers.find((x) => x.id === l.id);
    const endProgress = r?.progress ?? l.progress;
    progressById.set(l.id, round4(lerp(l.progress, endProgress, alpha)));
  }

  return {
    timeMs: clamped,
    finished: clamped >= data.durationMs,
    racers: left.racers.map((r) => ({
      id: r.id,
      progress: progressById.get(r.id) ?? r.progress
    }))
  };
}

function dedupeByTime(frames: RecordedRaceFrame[]): RecordedRaceFrame[] {
  const byTime = new Map<number, RecordedRaceFrame>();
  for (const frame of frames) {
    byTime.set(frame.timeMs, frame);
  }

  return [...byTime.values()].sort((a, b) => a.timeMs - b.timeMs);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unitFromSeed(seed: number, salt: number): number {
  const mixed = Math.imul(seed ^ (salt * 374761393), 668265263) >>> 0;
  return mixed / 0xffffffff;
}

function mapUnitToRange(unit: number, min: number, max: number): number {
  return min + (max - min) * unit;
}
