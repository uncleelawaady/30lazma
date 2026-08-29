"""Configuration, read from the environment only.

Nothing secret is ever committed. On cPanel these are set under
"Environment variables" in the Python App screen, or in a `.env` file that sits
beside passenger_wsgi.py and is git-ignored.
"""

import os


def _bool(name, default=False):
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _list(name, default=()):
    raw = os.environ.get(name, "")
    values = [v.strip() for v in raw.split(",") if v.strip()]
    return values or list(default)


class Config:
    """Effective settings for one process."""

    ENV = os.environ.get("APP_ENV", "production")
    DEBUG = _bool("APP_DEBUG", False)

    # Browsers that may call this API. The storefront is served from a different
    # origin, so this list is what makes the API reachable at all — and what
    # keeps every other site out.
    CORS_ORIGINS = _list(
        "CORS_ORIGINS",
        ("https://newlynow.com", "https://www.newlynow.com", "https://e-network.net"),
    )

    # Set once the app is live; used to sign sessions and tokens.
    SECRET_KEY = os.environ.get("APP_SECRET_KEY", "")

    @classmethod
    def problems(cls):
        """Configuration mistakes worth reporting on /api/health.

        Reported rather than raised: a missing secret should not stop the app
        from booting and telling you it is missing.
        """
        found = []
        if cls.ENV == "production":
            if not cls.SECRET_KEY:
                found.append("APP_SECRET_KEY is not set")
            elif len(cls.SECRET_KEY) < 32:
                found.append("APP_SECRET_KEY is shorter than 32 characters")
            if cls.DEBUG:
                found.append("APP_DEBUG is on in production")
            if any(o.startswith("http://") for o in cls.CORS_ORIGINS):
                found.append("CORS_ORIGINS contains a plain-http origin")
        return found
