<#
File: run-quality-gate.ps1
Purpose: Runs project quality gates with a single command.
Usage Examples:
  ./scripts/run-quality-gate.ps1 -Gate light
  ./scripts/run-quality-gate.ps1 -Gate extended
  ./scripts/run-quality-gate.ps1 -Gate full
Dependencies: pnpm and project package scripts.
Edge Cases: Fails fast if an unknown gate value is provided.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('light', 'extended', 'full')]
  [string]$Gate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

switch ($Gate) {
  'light' {
    pnpm ci:light
  }
  'extended' {
    pnpm ci:extended
  }
  'full' {
    pnpm ci:full
  }
}
