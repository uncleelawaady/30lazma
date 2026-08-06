#!/usr/bin/env bash
# Builds the deployable archive for elawaady.com.
#
# Hostinger's hosting_deployStaticWebsite tool expects the name pattern
# <dirname>_YYYYMMDD_HHMMSS.zip, so that's what this produces.
#
# Excluded from the archive on purpose:
#   DEPLOY.md, make-archive.sh, make-archive.ps1 — internal docs/tooling,
#   they would otherwise be publicly readable on the live domain.

set -euo pipefail

cd "$(dirname "$0")"

ARCHIVE="../portfolio_$(date +%Y%m%d_%H%M%S).zip"

zip -r -q "$ARCHIVE" . \
  -x 'DEPLOY.md' 'make-archive.sh' 'make-archive.ps1' '.DS_Store' '*/.DS_Store'

echo "Archive ready:"
cd .. && printf '%s\n' "$(pwd)/$(basename "$ARCHIVE")"
