"""Application factory for the e-network backend.

Kept as a factory so tests can build an isolated app, and so nothing runs at
import time — Passenger imports this module before it serves a single request.
"""

from flask import Flask, jsonify

from .api import api
from .config import Config

__all__ = ["create_app"]


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config["ENV_NAME"] = config_object.ENV
    app.config["DEBUG"] = config_object.DEBUG
    app.config["SECRET_KEY"] = config_object.SECRET_KEY or "dev-only-not-for-production"

    app.register_blueprint(api)
    _register_cors(app, config_object)
    _register_security_headers(app)
    _register_error_handlers(app)

    @app.get("/")
    def root():
        """A plain, honest landing response — this host serves an API."""
        return jsonify(service="e-network backend", api="/api/health")

    return app


def _register_cors(app, config_object):
    """Minimal CORS, written out rather than pulled from a dependency.

    Only the configured origins are echoed back, and only the headers the
    storefront actually sends are allowed. A wildcard would defeat the point.
    """
    allowed = set(config_object.CORS_ORIGINS)

    @app.after_request
    def add_cors(response):
        from flask import request

        origin = request.headers.get("Origin")
        if origin and origin in allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Max-Age"] = "600"
        # Caches must not serve one origin's response to another.
        response.headers.add("Vary", "Origin")
        return response

    @app.route("/<path:_any>", methods=["OPTIONS"])
    @app.route("/", methods=["OPTIONS"])
    def preflight(_any=None):
        return ("", 204)


def _register_security_headers(app):
    @app.after_request
    def add_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
        return response


def _register_error_handlers(app):
    """JSON errors, so a client never has to parse an HTML error page."""

    @app.errorhandler(404)
    def not_found(_err):
        return jsonify(error="not_found"), 404

    @app.errorhandler(405)
    def method_not_allowed(_err):
        return jsonify(error="method_not_allowed"), 405

    @app.errorhandler(500)
    def server_error(_err):
        return jsonify(error="internal_error"), 500
