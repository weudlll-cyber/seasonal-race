/**
 * File: scripts/validate-content.mjs
 * Model: GPT-5.3-Codex
 * Purpose: Validate content JSON files and manifests used by local/runtime catalog flows.
 */

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const contentRoot = path.join(repoRoot, 'content');
const tracksDir = path.join(contentRoot, 'tracks');
const racersDir = path.join(contentRoot, 'racers');
const manifestsDir = path.join(contentRoot, 'manifests');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function collectDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }
    seen.add(value);
  }
  return [...duplicates];
}

function validateTrack(track, fileName, errors) {
  if (!isNonEmptyString(track.id)) {
    errors.push(`Track ${fileName}: id must be a non-empty string.`);
  }

  if (!isNonEmptyString(track.name)) {
    errors.push(`Track ${fileName}: name must be a non-empty string.`);
  }

  if (!isFiniteNumber(track.length) || track.length <= 0) {
    errors.push(`Track ${fileName}: length must be a finite number greater than 0.`);
  }

  if (!Array.isArray(track.points) || track.points.length < 3) {
    errors.push(`Track ${fileName}: points must contain at least 3 entries.`);
    return;
  }

  for (let index = 0; index < track.points.length; index += 1) {
    const point = track.points[index];
    if (point === null || typeof point !== 'object') {
      errors.push(`Track ${fileName}: point at index ${index} must be an object.`);
      continue;
    }

    if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
      errors.push(`Track ${fileName}: point at index ${index} must provide finite x/y numbers.`);
    }
  }

  if (track.effectProfileId !== undefined && !isNonEmptyString(track.effectProfileId)) {
    errors.push(`Track ${fileName}: effectProfileId must be a non-empty string when provided.`);
  }
}

function validateRacerList(racerList, fileName, errors) {
  if (!isNonEmptyString(racerList.id)) {
    errors.push(`Racer list ${fileName}: id must be a non-empty string.`);
  }

  if (!isNonEmptyString(racerList.name)) {
    errors.push(`Racer list ${fileName}: name must be a non-empty string.`);
  }

  if (!Array.isArray(racerList.names) || racerList.names.length < 2) {
    errors.push(`Racer list ${fileName}: names must contain at least 2 entries.`);
    return;
  }

  const badNameIndex = racerList.names.findIndex((name) => !isNonEmptyString(name));
  if (badNameIndex >= 0) {
    errors.push(`Racer list ${fileName}: names[${badNameIndex}] must be a non-empty string.`);
  }
}

function validateManifestHeader(manifest, manifestLabel, collectionKey, errors) {
  if (!isFiniteNumber(manifest.version) || manifest.version < 1) {
    errors.push(`${manifestLabel}: version must be a positive number.`);
  }

  if (!Array.isArray(manifest[collectionKey]) || manifest[collectionKey].length === 0) {
    errors.push(`${manifestLabel}: ${collectionKey} must be a non-empty array.`);
  }
}

function validateManifestEntries(entries, manifestLabel, errors) {
  if (!Array.isArray(entries)) {
    return;
  }

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry === null || typeof entry !== 'object') {
      errors.push(`${manifestLabel}: entry at index ${index} must be an object.`);
      continue;
    }

    if (!isNonEmptyString(entry.id)) {
      errors.push(`${manifestLabel}: entry ${index} id must be a non-empty string.`);
    }
    if (!isNonEmptyString(entry.displayName)) {
      errors.push(`${manifestLabel}: entry ${index} displayName must be a non-empty string.`);
    }
    if (!isNonEmptyString(entry.raceType)) {
      errors.push(`${manifestLabel}: entry ${index} raceType must be a non-empty string.`);
    }
    if (!isNonEmptyString(entry.file)) {
      errors.push(`${manifestLabel}: entry ${index} file must be a non-empty string.`);
    }
  }

  const ids = entries
    .map((entry) => (entry && typeof entry === 'object' ? entry.id : undefined))
    .filter((id) => typeof id === 'string');

  const duplicateIds = collectDuplicates(ids);
  for (const duplicateId of duplicateIds) {
    errors.push(`${manifestLabel}: duplicate id detected: ${duplicateId}.`);
  }
}

function main() {
  const errors = [];

  const tracksManifestPath = path.join(manifestsDir, 'tracks.manifest.json');
  const racersManifestPath = path.join(manifestsDir, 'racers.manifest.json');

  if (!fs.existsSync(tracksManifestPath)) {
    errors.push('Missing manifest file: content/manifests/tracks.manifest.json');
  }
  if (!fs.existsSync(racersManifestPath)) {
    errors.push('Missing manifest file: content/manifests/racers.manifest.json');
  }

  if (errors.length > 0) {
    console.error('Content validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const tracksManifest = readJson(tracksManifestPath);
  const racersManifest = readJson(racersManifestPath);

  validateManifestHeader(tracksManifest, 'tracks.manifest.json', 'tracks', errors);
  validateManifestHeader(racersManifest, 'racers.manifest.json', 'racerLists', errors);

  validateManifestEntries(tracksManifest.tracks, 'tracks.manifest.json', errors);
  validateManifestEntries(racersManifest.racerLists, 'racers.manifest.json', errors);

  const trackEntries = Array.isArray(tracksManifest.tracks) ? tracksManifest.tracks : [];
  const racerEntries = Array.isArray(racersManifest.racerLists) ? racersManifest.racerLists : [];

  let validatedTrackCount = 0;
  let validatedRacerListCount = 0;

  for (const entry of trackEntries) {
    if (!entry || typeof entry !== 'object' || !isNonEmptyString(entry.file)) {
      continue;
    }

    const filePath = path.join(tracksDir, entry.file);
    if (!fs.existsSync(filePath)) {
      errors.push(`tracks.manifest.json: referenced file not found: ${entry.file}`);
      continue;
    }

    const trackJson = readJson(filePath);
    validateTrack(trackJson, entry.file, errors);

    if (isNonEmptyString(trackJson.id) && trackJson.id !== entry.id) {
      errors.push(
        `tracks.manifest.json: entry id ${entry.id} does not match file id ${trackJson.id} (${entry.file}).`
      );
    }

    validatedTrackCount += 1;
  }

  for (const entry of racerEntries) {
    if (!entry || typeof entry !== 'object' || !isNonEmptyString(entry.file)) {
      continue;
    }

    const filePath = path.join(racersDir, entry.file);
    if (!fs.existsSync(filePath)) {
      errors.push(`racers.manifest.json: referenced file not found: ${entry.file}`);
      continue;
    }

    const racerJson = readJson(filePath);
    validateRacerList(racerJson, entry.file, errors);

    if (isNonEmptyString(racerJson.id) && racerJson.id !== entry.id) {
      errors.push(
        `racers.manifest.json: entry id ${entry.id} does not match file id ${racerJson.id} (${entry.file}).`
      );
    }

    validatedRacerListCount += 1;
  }

  if (errors.length > 0) {
    console.error('Content validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `Content validation passed (${validatedTrackCount} tracks, ${validatedRacerListCount} racer lists).`
  );
}

main();
