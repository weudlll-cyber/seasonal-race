/**
 * File: apps/api/src/catalog.ts
 * Model: GPT-5.3-Codex
 * Purpose: Loads validated content catalogs (tracks and racer lists) for API consumption.
 * Usage: Used by API routes to expose read-only catalog endpoints.
 * Dependencies: Node fs/path and shared content JSON conventions.
 */

import fs from 'node:fs';
import path from 'node:path';

interface TrackManifestEntry {
  id: string;
  displayName: string;
  raceType: string;
  file: string;
}

interface RacerManifestEntry {
  id: string;
  displayName: string;
  raceType: string;
  file: string;
}

interface TrackFileShape {
  id: string;
  name: string;
  length: number;
  points: Array<{ x: number; y: number }>;
  effectProfileId?: string;
}

interface RacerFileShape {
  id: string;
  name: string;
  names: string[];
}

interface TracksManifestShape {
  version: number;
  tracks: TrackManifestEntry[];
}

interface RacersManifestShape {
  version: number;
  racerLists: RacerManifestEntry[];
}

export interface TrackCatalogItem {
  id: string;
  displayName: string;
  raceType: string;
  file: string;
  name: string;
  length: number;
  pointCount: number;
  effectProfileId?: string;
}

export interface RacerCatalogItem {
  id: string;
  displayName: string;
  raceType: string;
  file: string;
  name: string;
  racerCount: number;
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function ensureContentFile(contentRoot: string, folder: string, fileName: string): string {
  const safeFileName = path.basename(fileName);
  const fullPath = path.join(contentRoot, folder, safeFileName);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing content file: ${folder}/${safeFileName}`);
  }

  return fullPath;
}

export function loadTrackCatalog(contentRoot: string): TrackCatalogItem[] {
  const tracksManifestPath = path.join(contentRoot, 'manifests', 'tracks.manifest.json');
  const manifest = readJsonFile<TracksManifestShape>(tracksManifestPath);

  if (!Array.isArray(manifest.tracks)) {
    throw new Error('Invalid tracks manifest: tracks must be an array.');
  }

  return manifest.tracks.map((entry) => {
    const trackFilePath = ensureContentFile(contentRoot, 'tracks', entry.file);
    const trackFile = readJsonFile<TrackFileShape>(trackFilePath);

    const catalogItem: TrackCatalogItem = {
      id: entry.id,
      displayName: entry.displayName,
      raceType: entry.raceType,
      file: entry.file,
      name: trackFile.name,
      length: trackFile.length,
      pointCount: Array.isArray(trackFile.points) ? trackFile.points.length : 0
    };

    if (typeof trackFile.effectProfileId === 'string') {
      catalogItem.effectProfileId = trackFile.effectProfileId;
    }

    return catalogItem;
  });
}

export function loadRacerCatalog(contentRoot: string): RacerCatalogItem[] {
  const racersManifestPath = path.join(contentRoot, 'manifests', 'racers.manifest.json');
  const manifest = readJsonFile<RacersManifestShape>(racersManifestPath);

  if (!Array.isArray(manifest.racerLists)) {
    throw new Error('Invalid racers manifest: racerLists must be an array.');
  }

  return manifest.racerLists.map((entry) => {
    const racerFilePath = ensureContentFile(contentRoot, 'racers', entry.file);
    const racerFile = readJsonFile<RacerFileShape>(racerFilePath);

    return {
      id: entry.id,
      displayName: entry.displayName,
      raceType: entry.raceType,
      file: entry.file,
      name: racerFile.name,
      racerCount: Array.isArray(racerFile.names) ? racerFile.names.length : 0
    };
  });
}
