# Builds the deployable archive for elawaady.com (Windows / PowerShell).
#
# Hostinger's hosting_deployStaticWebsite tool expects the name pattern
# <dirname>_YYYYMMDD_HHMMSS.zip, so that's what this produces.
#
# Excluded on purpose: DEPLOY.md and the make-archive scripts — internal
# tooling that would otherwise be publicly readable on the live domain.

$ErrorActionPreference = 'Stop'

Set-Location -Path $PSScriptRoot

$stamp   = Get-Date -Format 'yyyyMMdd_HHmmss'
$archive = Join-Path (Split-Path $PSScriptRoot -Parent) "portfolio_$stamp.zip"
$staging = Join-Path $env:TEMP "portfolio_$stamp"

Copy-Item -Path $PSScriptRoot -Destination $staging -Recurse
Remove-Item -Path (Join-Path $staging 'DEPLOY.md'),
                  (Join-Path $staging 'make-archive.sh'),
                  (Join-Path $staging 'make-archive.ps1') -Force -ErrorAction SilentlyContinue

Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $archive -Force
Remove-Item -Path $staging -Recurse -Force

Write-Host "Archive ready:"
Write-Host $archive
