"""HTTP routes for CutPrep.

Feature 1 (this file for now): the input step. The user picks a cutting method
and material thickness; we derive and display the kerf width and minimum safe
feature size. File upload / validation is added in the next feature.
"""

from __future__ import annotations

from flask import Blueprint, render_template, request

from .processing import profiles

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
