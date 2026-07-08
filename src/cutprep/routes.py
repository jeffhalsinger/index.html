"""HTTP routes for CutPrep."""

from __future__ import annotations

from pathlib import Path

from flask import Blueprint, current_app, jsonify, request
from werkzeug.utils import secure_filename

from .processing import profiles, raster, vector

bp = Blueprint("cutprep", __name__)


def _extension(filename: str) -> str:
    return Path(filename).suffix.lstrip(".").lower()


@bp.get("/")
def index():
    """Health/landing endpoint."""
    return jsonify(
        app="CutPrep",
        status="ok",
        message="Preps images and vector files for CNC cutting.",
        processes=list(profiles.PROFILES),
    )


@bp.get("/profiles")
def list_profiles():
    """Return the available cutting-process profiles."""
    return jsonify({name: p.as_dict() for name, p in profiles.PROFILES.items()})


@bp.post("/prep")
def prep():
    """Accept an uploaded file and prep it for the requested cutting process.

    Form fields:
        file:    the uploaded image or vector file (required)
        process: one of ``plasma``, ``laser``, ``waterjet`` (default ``laser``)
    """
    if "file" not in request.files:
        return jsonify(error="no file provided"), 400

    upload = request.files["file"]
    if not upload.filename:
        return jsonify(error="empty filename"), 400

    raster_exts = current_app.config["RASTER_EXTENSIONS"]
    vector_exts = current_app.config["VECTOR_EXTENSIONS"]
    ext = _extension(upload.filename)
    if ext not in (raster_exts | vector_exts):
        return jsonify(error=f"unsupported file type: .{ext}"), 415

    process = request.form.get("process", "laser")
    if process not in profiles.PROFILES:
        return jsonify(error=f"unknown process: {process}"), 400

    filename = secure_filename(upload.filename)
    dest = current_app.config["UPLOAD_DIR"] / filename
    upload.save(dest)

    profile = profiles.PROFILES[process]
    if ext in raster_exts:
        result = raster.prep(dest, profile)
    else:
        result = vector.prep(dest, profile)

    return jsonify(process=process, source=filename, result=result)
