# Architecture

## System Overview
The platform is split into five major concerns:
1. Frontend applications (`web-viewer`, `web-admin`)
2. Backend API (`api`)
3. Race engine (`race-engine`)
4. Race type adapters (`race-types/*`)
5. Branding subsystem (`branding`)

## Runtime Flow
1. Admin configures players, race settings, and brand profile.
2. API validates and starts a race session with a selected race-type adapter.
3. Race engine runs deterministic or non-deterministic simulation ticks.
4. State and events are streamed to viewer clients.
5. Results and replay metadata are persisted.

## Race Engine Contract
Each race adapter should implement:
- `initialize(context)`
- `tick(deltaMs)`
- `getState()`
- `getEventsSince(lastTick)`
- `finalize()`

## Visual Strategy
- Path-based track movement allows curved tracks.
- Lightweight procedural effects reduce asset requirements.
- Effects examples:
  - Duck: water motion, wake lines, bubbles.
  - Horse: gallop bounce and dust.
  - Rocket: cloud drift and flame particles.

## Extensibility Model
New race type requirements:
1. Asset folder
2. Typed config schema
3. Adapter implementation
4. Registration manifest

New brand requirements:
1. JSON profile following schema
2. Optional UI form entry
3. API endpoint validation

## Data Boundaries
- API contracts in shared types package.
- Engine is UI-agnostic and transport-agnostic.
- Frontends consume versioned DTOs from API.
