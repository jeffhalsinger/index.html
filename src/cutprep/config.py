"""Application configuration objects.

Values are read from the environment so the same code runs unchanged in
development and production. See ``.env.example`` for the supported variables.
"""

from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Config:
    """Base configuration shared by all environments."""

    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "dev-insecure-change-me")

    # Where uploaded source files are written.
    UPLOAD_DIR = Path(
        os.environ.get("CUTPREP_UPLOAD_DIR", PROJECT_ROOT / "uploads")
    )

    # Reject uploads larger than this many bytes (default 16 MiB).
    MAX_CONTENT_LENGTH = int(
        os.environ.get("CUTPREP_MAX_CONTENT_LENGTH", 16 * 1024 * 1024)
    )

    # File types CutPrep knows how to prep.
    RASTER_EXTENSIONS = frozenset({"png", "jpg", "jpeg", "bmp", "gif"})
    VECTOR_EXTENSIONS = frozenset({"svg", "dxf"})

    @classmethod
    def allowed_extensions(cls) -> frozenset[str]:
        return cls.RASTER_EXTENSIONS | cls.VECTOR_EXTENSIONS


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
