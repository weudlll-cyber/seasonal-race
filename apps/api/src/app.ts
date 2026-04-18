/**
 * File: apps/api/src/app.ts
 * Model: GPT-5.3-Codex
 * Purpose: Builds the API app and exposes read-only content catalog endpoints.
 * Usage: Imported by tests and future runtime entrypoint for HTTP serving.
 * Dependencies: fastify and local catalog loader.
 */

import path from 'node:path';

import Fastify, { type FastifyInstance } from 'fastify';

import { loadRacerCatalog, loadTrackCatalog } from './catalog';

export interface BuildApiAppOptions {
  contentRoot?: string;
}

interface ApiErrorBody {
  error: 'CATALOG_LOAD_FAILED';
  message: string;
}

const defaultContentRoot = path.resolve(process.cwd(), 'content');

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

  return app;
}
