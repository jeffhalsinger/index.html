"""HTTP routes for CutPrep.

Feature 1: the input step. The user picks a cutting method and material
thickness; we derive kerf width and minimum safe feature size.

Feature 2: vector file validation. The user uploads an SVG or DXF; we report
open paths, duplicate/overlapping paths, and curve simplification. Report-only.
"""

from __future__ import annotations

from pathlib import Path

from flask import Blueprint, current_app, jsonify, render_template, request
from werkzeug.utils import secure_filename

from .processing import profiles, vector

bp = Blueprint("cutprep", __name__)


@bp.get("/")
def index():
    """Render the input form."""
    return render_template("index.html", methods=profiles.METHODS.values())


@bp.post("/analyze")
def analyze():
    """Compute cutting parameters from the submitted method + thickness."""
    method = request.form.get("method", "")
    unit = request.form.get("unit", "in")
    raw_thickness = request.form.get("thickness", "")

    errors = []
    if method not in profiles.METHODS:
        errors.append(f"Unknown cutting method: {method!r}")

    thickness = None
    try:
        thickness = float(raw_thickness)
        if thickness <= 0:
            errors.append("Thickness must be greater than zero.")
    except (TypeError, ValueError):
        errors.append(f"Thickness must be a number (got {raw_thickness!r}).")

    if errors:
        return (
            render_template("index.html", methods=profiles.METHODS.values(), errors=errors),
            400,
        )

    params = profiles.compute_parameters(method, thickness, unit)
    return render_template("result.html", params=params.as_dict())


@bp.post("/validate")
def validate():
    """Validate an uploaded SVG/DXF file and report issues (no file written).

    Returns JSON when ``?format=json`` is set or the client asks for JSON;
    otherwise renders an HTML report.
    """
    wants_json = request.args.get("format") == "json" or request.accept_mimetypes.best == "application/json"

    if "file" not in request.files or not request.files["file"].filename:
        msg = "No file was uploaded."
        if wants_json:
            return jsonify(error=msg), 400
        return render_template("index.html", methods=profiles.METHODS.values(), errors=[msg]), 400

    upload = request.files["file"]
    ext = Path(upload.filename).suffix.lstrip(".").lower()
    if ext not in vector.SUPPORTED_EXTENSIONS:
        msg = f"Unsupported file type: .{ext}. Accepted: {', '.join(vector.SUPPORTED_EXTENSIONS)}."
        if wants_json:
            return jsonify(error=msg), 415
        return render_template("index.html", methods=profiles.METHODS.values(), errors=[msg]), 415

    filename = secure_filename(upload.filename)
    dest = current_app.config["UPLOAD_DIR"] / filename
    upload.save(dest)

    report = vector.analyze_file(dest)
    if wants_json:
        return jsonify(source=filename, report=report.as_dict())
    return render_template("report.html", source=filename, report=report)


@bp.get("/api/parameters")
def api_parameters():
    """JSON variant of :func:`analyze`, handy for scripted testing.

    Query params: ``method``, ``thickness``, ``unit``.
    """
    from flask import jsonify

    method = request.args.get("method", "")
    unit = request.args.get("unit", "in")
    try:
        thickness = float(request.args.get("thickness", ""))
        params = profiles.compute_parameters(method, thickness, unit)
    except KeyError:
        return jsonify(error=f"unknown method: {method}"), 400
    except ValueError as exc:
        return jsonify(error=str(exc)), 400

    return jsonify(params.as_dict())
