/**
 * File: apps/api/src/app.ts
 * Model: GPT-5.3-Codex
 * Purpose: Builds the API app and exposes read-only content catalog endpoints.
 * Usage: Imported by tests and future runtime entrypoint for HTTP serving.
 * Dependencies: fastify and local catalog loader.
 */

import path from 'node:path';

import Fastify, { type FastifyInstance } from 'fastify';

import type {
  RaceLaunchRequest,
  RaceLaunchResolvedConfig
} from '../../../packages/shared-types/src/index';
import { loadRacerCatalog, loadRacerListById, loadTrackById, loadTrackCatalog } from './catalog';
import {
  createFileRaceLaunchStore,
  createInMemoryRaceLaunchStore,
  type RaceLaunchStore
} from './race-launch-store';
import {
  resolveRaceLaunchOptions,
  type RaceLaunchValidationErrorCode
} from './race-launch-options';

export interface BuildApiAppOptions {
  contentRoot?: string;
  raceLaunchStore?: RaceLaunchStore;
  raceLaunchStoreFilePath?: string;
}

interface ApiErrorBody {
  error: 'CATALOG_LOAD_FAILED';
  message: string;
}

interface StartRaceValidationErrorBody {
  error: RaceLaunchValidationErrorCode;
  message: string;
}

interface RuntimeBootstrapErrorBody {
  error: 'RACE_NOT_FOUND';
  message: string;
}

const defaultContentRoot = path.resolve(process.cwd(), 'content');
const raceLaunchStoreFilePathEnvKey = 'SEASONAL_RACE_API_LAUNCH_STORE_FILE_PATH';

function resolveRaceLaunchStore(options: BuildApiAppOptions): RaceLaunchStore {
  if (options.raceLaunchStore) {
    return options.raceLaunchStore;
  }

  const configuredFilePath =
    options.raceLaunchStoreFilePath ?? process.env[raceLaunchStoreFilePathEnvKey];

  if (typeof configuredFilePath === 'string' && configuredFilePath.trim().length > 0) {
    return createFileRaceLaunchStore({ storageFilePath: configuredFilePath.trim() });
  }

  return createInMemoryRaceLaunchStore();
}

function mapCatalogError(error: unknown): ApiErrorBody {
  const message = error instanceof Error ? error.message : 'Unknown catalog error';
  return {
    error: 'CATALOG_LOAD_FAILED',
    message
  };
}

export function buildApiApp(options: BuildApiAppOptions = {}): FastifyInstance {
  const contentRoot = options.contentRoot ?? defaultContentRoot;
  const app = Fastify({ logger: false });
  const raceLaunchStore = resolveRaceLaunchStore(options);

  app.get('/api/v1/catalog/tracks', async (_, reply) => {
    try {
      const tracks = loadTrackCatalog(contentRoot);
      return { items: tracks };
    } catch (error) {
      return reply.status(500).send(mapCatalogError(error));
    }
  });

  app.get('/api/v1/catalog/racers', async (_, reply) => {
    try {
      const racerLists = loadRacerCatalog(contentRoot);
      return { items: racerLists };
    } catch (error) {
      return reply.status(500).send(mapCatalogError(error));
    }
  });

  app.post('/api/v1/races/start', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<RaceLaunchRequest>;
    const trackId = typeof body.trackId === 'string' ? body.trackId.trim() : '';
    const racerListId = typeof body.racerListId === 'string' ? body.racerListId.trim() : '';

    if (trackId.length === 0 || racerListId.length === 0) {
      const validationError: StartRaceValidationErrorBody = {
        error: 'INVALID_REQUEST',
        message: 'trackId and racerListId are required non-empty strings.'
      };
      return reply.status(400).send(validationError);
    }

    try {
      const tracks = loadTrackCatalog(contentRoot);
      const racerLists = loadRacerCatalog(contentRoot);

      const selectedTrack = tracks.find((item) => item.id === trackId);
      if (!selectedTrack) {
        const notFoundError: StartRaceValidationErrorBody = {
          error: 'CATALOG_ENTRY_NOT_FOUND',
          message: `Track id not found: ${trackId}`
        };
        return reply.status(404).send(notFoundError);
      }

      const selectedRacerList = racerLists.find((item) => item.id === racerListId);
      if (!selectedRacerList) {
        const notFoundError: StartRaceValidationErrorBody = {
          error: 'CATALOG_ENTRY_NOT_FOUND',
          message: `Racer list id not found: ${racerListId}`
        };
        return reply.status(404).send(notFoundError);
      }

      if (selectedTrack.raceType !== selectedRacerList.raceType) {
        const mismatchError: StartRaceValidationErrorBody = {
          error: 'RACE_TYPE_MISMATCH',
          message: `Track raceType ${selectedTrack.raceType} does not match racer list raceType ${selectedRacerList.raceType}.`
        };
        return reply.status(400).send(mismatchError);
      }

      const resolvedOptions = resolveRaceLaunchOptions({
        input: body,
        racerCount: selectedRacerList.racerCount,
        autoSeed: `auto-seed-${raceLaunchStore.peekNextRaceSequence()}`
      });

      if (!resolvedOptions.ok) {
        const optionsError: StartRaceValidationErrorBody = {
          error: resolvedOptions.code,
          message: resolvedOptions.message
        };
        return reply.status(400).send(optionsError);
      }

      const raceId = raceLaunchStore.allocateRaceId();

      const responseBody: RaceLaunchResolvedConfig = {
        raceId,
        raceType: selectedTrack.raceType,
        trackId: selectedTrack.id,
        racerListId: selectedRacerList.id,
        durationMs: resolvedOptions.value.durationMs,
        winnerCount: resolvedOptions.value.winnerCount,
        ...(resolvedOptions.value.brandingProfileId
          ? { brandingProfileId: resolvedOptions.value.brandingProfileId }
          : {}),
        seed: resolvedOptions.value.seed,
        options: resolvedOptions.value.options,
        status: 'scheduled'
      };

      const runtimeTrack = loadTrackById(contentRoot, selectedTrack.id);
      const runtimeRacerList = loadRacerListById(contentRoot, selectedRacerList.id);

      if (!runtimeTrack || !runtimeRacerList) {
        const catalogError: StartRaceValidationErrorBody = {
          error: 'CATALOG_ENTRY_NOT_FOUND',
          message: 'Unable to build runtime payload from selected catalog entries.'
        };
        return reply.status(404).send(catalogError);
      }

      raceLaunchStore.saveRuntimeBootstrap(raceId, {
        raceId,
        raceType: selectedTrack.raceType,
        launch: responseBody,
        track: {
          id: runtimeTrack.id,
          name: runtimeTrack.name,
          length: runtimeTrack.length,
          points: runtimeTrack.points,
          pointCount: runtimeTrack.pointCount,
          ...(runtimeTrack.effectProfileId ? { effectProfileId: runtimeTrack.effectProfileId } : {})
        },
        racerList: {
          id: runtimeRacerList.id,
          name: runtimeRacerList.name,
          racerCount: runtimeRacerList.racerCount
        }
      });

      return reply.status(201).send(responseBody);
    } catch (error) {
      return reply.status(500).send(mapCatalogError(error));
    }
  });

  app.get('/api/v1/races/:raceId/runtime-bootstrap', async (request, reply) => {
    const raceId = (request.params as { raceId?: string }).raceId ?? '';

    const payload = raceLaunchStore.getRuntimeBootstrap(raceId);
    if (!payload) {
      const notFound: RuntimeBootstrapErrorBody = {
        error: 'RACE_NOT_FOUND',
        message: `Race id not found: ${raceId}`
      };
      return reply.status(404).send(notFound);
    }

    return payload;
  });

  return app;
}
