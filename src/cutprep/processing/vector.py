"""Vector (SVG/DXF) file validation — the public entry point.

Dispatches on file extension to the right loader, then runs the shared
analyzer. Report-only: no modified file is produced.

Simplification precision is expressed in real millimetres and, by default,
derived from the kerf width of the chosen cutting method — so the polyline
never deviates from the true curve by more than a small fraction of the cut
width. Ambiguous-unit files fall back to the caller's chosen unit system.
"""

from __future__ import annotations

from pathlib import Path

from . import model
from .dxf_loader import load_dxf
from .model import AnalysisReport
from .svg_loader import load_svg
from .units import UnitInfo

SUPPORTED_EXTENSIONS = ("svg", "dxf")

# Simplification deviation as a fraction of kerf, with sane absolute bounds (mm).
_KERF_FRACTION = 0.1
_MIN_SIMPLIFY_MM = 0.02
_MAX_SIMPLIFY_MM = 0.5
_DEFAULT_SIMPLIFY_MM = 0.1


def tolerances_for_kerf(kerf_mm: float | None) -> tuple[float, float]:
    """Return ``(flatten_tol_mm, simplify_tol_mm)`` for a given kerf width.

    Simplification stays within ~10% of the kerf (bounded), and flattening is
    finer still so the simplifier has clean input to work from.
    """
    if kerf_mm and kerf_mm > 0:
        simplify = min(_MAX_SIMPLIFY_MM, max(_MIN_SIMPLIFY_MM, kerf_mm * _KERF_FRACTION))
    else:
        simplify = _DEFAULT_SIMPLIFY_MM
    return simplify / 2.0, simplify


def analyze_file(
    filepath: str | Path,
    *,
    kerf_mm: float | None = None,
    fallback_unit: str = "mm",
    simplify_tol_mm: float | None = None,
    flatten_tol_mm: float | None = None,
) -> AnalysisReport:
    """Validate a vector file and return an :class:`AnalysisReport`.

    Args:
        filepath: Path to the SVG or DXF file.
        kerf_mm: Kerf width of the chosen cutting method; drives the default
            simplification tolerance when explicit tolerances aren't given.
        fallback_unit: ``"mm"`` or ``"in"`` — used only when the file itself
            declares no units.
        simplify_tol_mm / flatten_tol_mm: Override the kerf-derived defaults.

    Raises:
        ValueError: if the file extension is not supported.
    """
    filepath = Path(filepath)
    ext = filepath.suffix.lstrip(".").lower()

    default_flatten, default_simplify = tolerances_for_kerf(kerf_mm)
    simplify_tol_mm = default_simplify if simplify_tol_mm is None else simplify_tol_mm
    flatten_tol_mm = default_flatten if flatten_tol_mm is None else flatten_tol_mm

    if ext == "svg":
        paths, warnings, unit = load_svg(str(filepath), flatten_tol_mm, fallback_unit)
    elif ext == "dxf":
        paths, warnings, unit = load_dxf(str(filepath), flatten_tol_mm, fallback_unit)
    else:
        raise ValueError(f"unsupported vector format: .{ext}")

    if unit is None:
        unit = UnitInfo(1.0, "units unknown (file could not be read)", ambiguous=True)

    simplify_tol_units = simplify_tol_mm / unit.mm_per_unit
    return model.analyze(
        ext,
        paths,
        warnings,
        simplify_tol=simplify_tol_units,
        unit=unit,
        simplify_tol_mm=simplify_tol_mm,
        flatten_tol_mm=flatten_tol_mm,
    )
