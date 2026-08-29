"""The public API surface.

Deliberately small for now: enough to prove the deployment works end to end and
to give the storefront something to check. The store endpoints (orders,
pricing, providers, ledger) land here once this is confirmed running.
"""

import os
import platform
import sys
import time

from flask import Blueprint, jsonify

from .config import Config

api = Blueprint("api", __name__, url_prefix="/api")

STARTED_AT = time.time()
VERSION = os.environ.get("APP_VERSION", "0.1.0")


@api.get("/health")
def health():
    """Liveness plus the configuration problems worth knowing about.

    Returns 200 while the process is serving. `config_problems` being non-empty
    is a warning, not a failure — the app is up, but not yet ready for real
    traffic.
    """
    problems = Config.problems()
    return jsonify(
        status="ok",
        ready=not problems,
        config_problems=problems,
        version=VERSION,
        env=Config.ENV,
        uptime_seconds=round(time.time() - STARTED_AT, 1),
    )


@api.get("/version")
def version():
    """Enough detail to confirm which interpreter Passenger actually used."""
    return jsonify(
        version=VERSION,
        python=platform.python_version(),
        implementation=platform.python_implementation(),
        executable=sys.executable,
    )
