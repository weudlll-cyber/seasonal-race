#!/usr/bin/env bash
# File: scripts/install-vps.sh
# Purpose: Secure one-command VPS installation entrypoint (blueprint).
# Usage: sudo ./scripts/install-vps.sh
# Dependencies: Ubuntu/Debian-like system, root privileges, internet access.
# Edge cases: Script is idempotent-by-design and exits on first failing command.

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "[error] Please run as root: sudo ./scripts/install-vps.sh" >&2
  exit 1
fi

echo "[info] Seasonal Race VPS installer (blueprint)"
echo "[info] This script is intentionally conservative and currently validates prerequisites only."

if ! command -v apt-get >/dev/null 2>&1; then
  echo "[error] Unsupported OS: expected apt-based distribution." >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "[error] systemd is required for service management." >&2
  exit 1
fi

echo "[info] Preflight checks passed."
echo "[todo] Next phases will add package install, service setup, TLS, and health checks."
