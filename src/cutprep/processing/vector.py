"""Vector (SVG/DXF) prep.

Prepping a vector file means cleaning geometry so a CNC controller can follow
it: normalizing units, closing open contours, and simplifying redundant nodes.
This module holds the entry point; the individual steps are stubbed out.
"""

from __future__ import annotations

from pathlib import Path

from .profiles import Profile


def prep(source: Path, profile: Profile) -> dict:
    """Prep a vector file for the given cutting process.

    Args:
        source: Path to the uploaded vector file on disk.
        profile: The cutting-process profile to apply.

    Returns:
        A summary of the prep result. This is a scaffold: the real pipeline
        (parse → normalize units → close paths → simplify → apply kerf) is not
        implemented yet.
    """
    return {
        "type": "vector",
        "steps": ["parse", "normalize-units", "close-paths", "simplify"],
        "kerf_mm": profile.kerf_mm,
        "status": "not-implemented",
        "source_bytes": source.stat().st_size,
    }
