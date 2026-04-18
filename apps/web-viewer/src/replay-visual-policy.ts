/**
 * File: apps/web-viewer/src/replay-visual-policy.ts
 * Model: GPT-5.3-Codex
 * Purpose: Pure replay-visual policy helpers shared by editor preview and runtime race views.
 * Usage: Import from viewer modules that need racer labeling, focus, leaderboard, and pack layout behavior.
 */

export type NameDisplayMode = 'leaders-focus' | 'hover' | 'all';

export interface ReplayVisualRacerState {
  id: string;
  index: number;
  progress: number;
  rankScore?: number;
  displayProgress?: number;
  hovered: boolean;
  visible: boolean;
}

export interface ReplayLabelDecision {
  id: string;
  showLabel: boolean;
  isFocus: boolean;
  markerAlpha: number;
  scale: number;
  zIndex: number;
}

export interface ReplayLeaderboardRow {
  kind: 'racer' | 'separator';
  place?: number;
  racerIndex?: number;
  progressPercent?: number;
  isFocus?: boolean;
}

export interface ReplayVisualSnapshot {
  sortedRacers: ReplayVisualRacerState[];
  labelDecisions: ReplayLabelDecision[];
  leaderboardRows: ReplayLeaderboardRow[];
}

export interface ReplayPackLayout {
  columns: number;
  rows: number;
  rowLagProgress: number;
  halfWidth: number;
}

export function toNameDisplayMode(value: string): NameDisplayMode {
  if (value === 'all' || value === 'hover' || value === 'leaders-focus') {
    return value;
  }
  return 'leaders-focus';
}

export function normalizeFocusRacerNumber(input: number, racerCount: number): number {
  const safeCount = Math.max(2, Math.min(100, Math.floor(racerCount)));
  if (!Number.isFinite(input)) return 1;
  return Math.max(1, Math.min(safeCount, Math.floor(input)));
}

export function createRacerIds(count: number): string[] {
  const safeCount = Math.max(2, Math.min(100, Math.floor(count)));
  return Array.from({ length: safeCount }, (_, index) => `duck-${index + 1}`);
}

export function buildReplayPackLayout(racerCount: number, laneWidthPx: number): ReplayPackLayout {
  const maxPackWidthPx = 190;
  const normalizedLaneWidth = Math.max(4, laneWidthPx);
  const columnsByWidth = Math.floor(maxPackWidthPx / normalizedLaneWidth) + 1;
  const targetColumns = racerCount >= 80 ? 10 : racerCount >= 50 ? 9 : 8;
  const columns = Math.max(
    4,
    Math.min(racerCount, Math.min(14, Math.min(columnsByWidth, targetColumns)))
  );
  const rows = Math.max(1, Math.ceil(racerCount / columns));
  const rowLagProgress = Math.max(0.0007, Math.min(0.0042, 0.22 / rows));
  const halfWidth = ((columns - 1) / 2) * laneWidthPx + 12;

  return {
    columns,
    rows,
    rowLagProgress,
    halfWidth
  };
}

export function buildReplayVisualSnapshot(
  racers: ReplayVisualRacerState[],
  mode: NameDisplayMode,
  focusRacerNumber: number,
  leaderboardTopCount = 12
): ReplayVisualSnapshot {
  const sortedRacers = [...racers].sort(
    (a, b) =>
      (b.rankScore ?? b.progress) - (a.rankScore ?? a.progress) ||
      b.progress - a.progress ||
      a.index - b.index
  );
  const sortedByProgress = [...racers].sort((a, b) => b.progress - a.progress || a.index - b.index);
  const focusId = `duck-${focusRacerNumber}`;
  const leadersToShow = 5;
  // Use live progress for label visibility so true on-track leaders always keep their names,
  // and keep the selection strictly on top-5.
  const leaderIds = new Set(sortedByProgress.slice(0, leadersToShow).map((r) => r.id));

  const labelDecisions = racers.map((racer) => {
    const isFocus = racer.id === focusId;
    const isLeader = leaderIds.has(racer.id);
    const showByMode =
      mode === 'all' ? true : mode === 'hover' ? racer.hovered || isFocus : isLeader;
    const showLabel = racer.visible && showByMode;

    return {
      id: racer.id,
      showLabel,
      isFocus,
      markerAlpha: isFocus ? 1 : isLeader ? 0.97 : 0.82,
      scale: isFocus ? 1.18 : isLeader ? 1.07 : 1,
      zIndex: isFocus ? 55 : isLeader ? 28 : showLabel ? 20 : 10
    };
  });

  const topCount = Math.min(leaderboardTopCount, sortedRacers.length);
  const focusRank = sortedRacers.findIndex((racer) => racer.id === focusId);
  const leaderboardRows: ReplayLeaderboardRow[] = [];

  for (let i = 0; i < topCount; i += 1) {
    const racer = sortedRacers[i]!;
    leaderboardRows.push({
      kind: 'racer',
      place: i + 1,
      racerIndex: racer.index,
      progressPercent: Math.round(clamp01(racer.displayProgress ?? racer.progress) * 100),
      isFocus: racer.id === focusId
    });
  }

  if (focusRank >= topCount) {
    const focusRacer = sortedRacers[focusRank]!;
    leaderboardRows.push({ kind: 'separator' });
    leaderboardRows.push({
      kind: 'racer',
      place: focusRank + 1,
      racerIndex: focusRacer.index,
      progressPercent: Math.round(clamp01(focusRacer.displayProgress ?? focusRacer.progress) * 100),
      isFocus: true
    });
  }

  return {
    sortedRacers,
    labelDecisions,
    leaderboardRows
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
