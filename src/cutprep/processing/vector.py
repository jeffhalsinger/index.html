"""Vector (SVG/DXF) file validation — the public entry point.

Dispatches on file extension to the right loader, then runs the shared
analyzer. Report-only: no modified file is produced.
"""

from __future__ import annotations

from pathlib import Path

from . import model
from .dxf_loader import load_dxf
from .model import AnalysisReport
from .svg_loader import load_svg

SUPPORTED_EXTENSIONS = ("svg", "dxf")


def analyze_file(filepath: str | Path) -> AnalysisReport:
    """Validate a vector file and return an :class:`AnalysisReport`.

    Raises:
        ValueError: if the file extension is not supported.
    """
    filepath = Path(filepath)
    ext = filepath.suffix.lstrip(".").lower()

    if ext == "svg":
        paths, warnings = load_svg(str(filepath))
    elif ext == "dxf":
        paths, warnings = load_dxf(str(filepath))
    else:
        raise ValueError(f"unsupported vector format: .{ext}")

    return model.analyze(ext, paths, warnings)
