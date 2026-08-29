"""Passenger entry point for the e-network.net Python App (cPanel / Namecheap).

cPanel is configured with:
    Application root : e-network-backend
    Startup file     : passenger_wsgi.py
    Entry point      : application
    Python           : 3.10

Passenger imports this module and looks for a module-level name `application`.
If importing the real app raises — a missing dependency, a syntax error, a bad
environment variable — Passenger has nothing to serve and the browser gets an
opaque 500 with no way to tell what went wrong from the outside.

So this file never lets an import error escape: it falls back to a tiny
dependency-free WSGI app that answers 503 and names the failure. That turns a
blank 500 into "ModuleNotFoundError: No module named 'flask'" — which is the
difference between guessing and knowing.
"""

import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))

# Passenger runs with the app root as the working directory, but the project
# package still has to be importable when it is not installed.
if HERE not in sys.path:
    sys.path.insert(0, HERE)


def _load_dotenv():
    """Read a local .env, if present, without requiring python-dotenv.

    Secrets live in the environment, never in the repository. On cPanel they can
    also be set under "Environment variables" in the Python App screen; anything
    already exported there wins over the file.
    """
    path = os.path.join(HERE, ".env")
    if not os.path.isfile(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)
    except OSError:
        # A missing or unreadable .env must never stop the app from booting.
        pass


def _boot_failure_app(exc):
    """A dependency-free WSGI app that reports why the real app did not start.

    The exception type and message are always shown — they name the problem
    without revealing anything sensitive. The full traceback is shown only when
    APP_BOOT_DIAGNOSTICS=1, which should be turned off once the app is up.
    """
    summary = "{0}: {1}".format(type(exc).__name__, exc)
    detail = ""
    if os.environ.get("APP_BOOT_DIAGNOSTICS") == "1":
        detail = "\n\n" + "".join(
            traceback.format_exception(type(exc), exc, exc.__traceback__)
        ) + "\npython: {0}\ncwd: {1}\n".format(sys.version, os.getcwd())

    body = (
        "e-network backend did not start.\n\n"
        "{0}{1}\n"
        "Set APP_BOOT_DIAGNOSTICS=1 in the Python App environment variables for "
        "the full traceback, and unset it once the app is running.\n"
    ).format(summary, detail).encode("utf-8")

    # Written to stderr as well, which Passenger captures in stderr.log.
    sys.stderr.write("[passenger_wsgi] boot failed: {0}\n".format(summary))
    traceback.print_exception(type(exc), exc, exc.__traceback__, file=sys.stderr)
    sys.stderr.flush()

    def app(environ, start_response):
        start_response(
            "503 Service Unavailable",
            [
                ("Content-Type", "text/plain; charset=utf-8"),
                ("Content-Length", str(len(body))),
                ("Cache-Control", "no-store"),
            ],
        )
        return [body]

    return app


_load_dotenv()

try:
    from app import create_app

    application = create_app()
except Exception as exc:  # noqa: BLE001 — deliberately catching everything
    application = _boot_failure_app(exc)
