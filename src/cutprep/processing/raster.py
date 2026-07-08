"""Raster (bitmap image) prep.

Prepping a raster file for cutting means reducing a full-colour photo/logo to a
clean two-tone silhouette that can be traced into cut paths. This module holds
the entry point; the individual steps (threshold, denoise, vectorize) are
stubbed out for now.
"""

from __future__ import annotations

from pathlib import Path

from .profiles import Profile


def prep(source: Path, profile: Profile) -> dict:
    """Prep a raster image for the given cutting process.

    Args:
        source: Path to the uploaded image on disk.
        profile: The cutting-process profile to apply.

    Returns:
        A summary of the prep result. This is a scaffold: the real pipeline
        (threshold → denoise → vectorize → apply kerf) is not implemented yet.
    """
    return {
        "type": "raster",
        "steps": ["load", "threshold", "denoise", "vectorize"],
        "kerf_mm": profile.kerf_mm,
        "status": "not-implemented",
        "source_bytes": source.stat().st_size,
    }
