"""Flask application factory for CutPrep."""

from __future__ import annotations

from flask import Flask

from .config import Config, DevelopmentConfig
from .routes import bp


def create_app(config: type[Config] | None = None) -> Flask:
    """Build and configure the CutPrep Flask application.

    Args:
        config: A configuration class to apply. Defaults to
            :class:`~cutprep.config.DevelopmentConfig`.

    Returns:
        A configured :class:`flask.Flask` instance.
    """
    app = Flask(__name__)
    app.config.from_object(config or DevelopmentConfig)

    # Ensure the upload directory exists.
    app.config["UPLOAD_DIR"].mkdir(parents=True, exist_ok=True)

    app.register_blueprint(bp)
    return app


# Convenience target for `flask --app cutprep.app run`.
app = create_app()
