"""Load an SVG file into the shared :class:`VectorPath` model.

Uses ``svgpathtools`` to parse ``<path>`` elements (and basic shapes, which it
converts to paths). Each continuous subpath becomes one :class:`VectorPath`;
curve segments are flattened to dense polylines so the analyzer can simplify
them uniformly.
"""

from __future__ import annotations

from svgpathtools import Arc, CubicBezier, Line, QuadraticBezier, svg2paths2

from . import geometry
from .geometry import Point
from .model import VectorPath

_CURVE_TYPES = (CubicBezier, QuadraticBezier, Arc)


def _flatten_segment(seg, tol: float) -> list[Point]:
    """Sample a single svgpathtools segment into points."""
    if isinstance(seg, Line):
        return [(seg.start.real, seg.start.imag), (seg.end.real, seg.end.imag)]

    # Curve: sample proportionally to its length.
    try:
        length = seg.length()
    except Exception:
        length = 0.0
    steps = max(2, min(400, int(length / tol) + 1))
    pts: list[Point] = []
    for i in range(steps + 1):
        z = seg.point(i / steps)
        pts.append((z.real, z.imag))
    return pts


def load_svg(filepath: str, tol: float = geometry.FLATTEN_TOLERANCE) -> tuple[list[VectorPath], list[str]]:
    """Return ``(paths, warnings)`` parsed from ``filepath``."""
    warnings: list[str] = []
    try:
        paths, attributes, _svg_attrs = svg2paths2(filepath)
    except Exception as exc:  # malformed SVG, etc.
        return [], [f"Could not parse SVG: {exc}"]

    result: list[VectorPath] = []
    for elem_idx, (path, attr) in enumerate(zip(paths, attributes)):
        base_name = attr.get("id") or f"path{elem_idx}"
        subpaths = path.continuous_subpaths() or [path]
        multi = len(subpaths) > 1
        for sub_idx, sub in enumerate(subpaths):
            pid = f"{base_name}.{sub_idx}" if multi else base_name

            points: list[Point] = []
            curve_count = 0
            seg_count = 0
            for seg in sub:
                seg_count += 1
                if isinstance(seg, _CURVE_TYPES):
                    curve_count += 1
                seg_points = _flatten_segment(seg, tol)
                # avoid duplicating the shared vertex between segments
                points.extend(seg_points if not points else seg_points[1:])

            points = geometry.dedupe_consecutive(points)
            if len(points) < 2:
                continue

            closed = bool(getattr(sub, "isclosed", lambda: False)()) or geometry.is_closed(points)
            result.append(
                VectorPath(
                    id=pid,
                    points=points,
                    closed=closed,
                    curve_segment_count=curve_count,
                    source_segment_count=seg_count,
                )
            )

    return result, warnings
