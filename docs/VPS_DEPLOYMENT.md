# VPS Deployment Plan

## Goal

Provide a secure, reproducible one-command installation flow for deploying Seasonal Race on a VPS after local validation.

## Deployment Principles

- Local-first: features must be tested locally before deployment.
- Reproducible: same command should yield the same environment state.
- Idempotent: rerunning installation should not break existing setup.
- Least privilege: application services run as non-root users.
- Auditable: installation and service logs are accessible and traceable.

## Target Topology

- Reverse proxy (TLS termination)
- API service
- Web viewer/admin service
- PostgreSQL database (local or managed)
- Optional Redis (if realtime/session scale requires it)

## One-Command Installer

Planned entrypoint:

- `sudo ./scripts/install-vps.sh`

Installer responsibilities:

1. Validate OS and required permissions.
2. Install runtime dependencies (Node, pnpm via Corepack, reverse proxy).
3. Create dedicated service user and directory layout.
4. Configure environment files from templates.
5. Install app dependencies and build artifacts.
6. Configure systemd services.
7. Configure TLS and reverse proxy.
8. Run health checks and print rollback hints.

## Security Hardening Checklist

- Deny-by-default firewall policy.
- SSH hardening and key-based auth.
- Automatic security updates where appropriate.
- Secrets injected from secure sources; never committed.
- Service file hardening options (NoNewPrivileges, PrivateTmp, etc.).
- Explicit open ports list and health endpoint restrictions.

## Rollback Strategy

- Keep last known-good build artifact.
- Support service rollback to previous release directory.
- Provide restart and health-check verification commands.

## Local-to-VPS Promotion Flow

1. Run local full gate: `corepack pnpm run ci:full`
2. Build release artifacts.
3. Execute VPS installer.
4. Run post-deploy smoke tests.
5. Validate logs and metrics.
