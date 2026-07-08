"""Shared data model + analysis logic for vector file validation.

Both the SVG and DXF loaders produce a list of :class:`VectorPath`. The
:func:`analyze` function then runs the format-independent checks the user
asked for:

* open (non-closed) paths, listed by id
* duplicate / coincident (overlapping) paths, grouped
* curve simplification: how many source curve segments each path had and how
  many polyline vertices it reduces to

This is **report-only** — nothing here writes a modified file.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from . import geometry
from .geometry import Point


@dataclass
class VectorPath:
    """One contour, normalized from either SVG or DXF."""

    id: str
    #: Densely-flattened polyline approximating the contour.
    points: list[Point]
    #: True if the contour's ends meet (a real closed loop).
    closed: bool
    #: Number of source segments that were curves (bezier / arc / spline).
    curve_segment_count: int = 0
    #: Total number of source segments that make up this path.
    source_segment_count: int = 0

    def simplified(self, epsilon: float = geometry.SIMPLIFY_TOLERANCE) -> list[Point]:
        return geometry.rdp(self.points, epsilon)


@dataclass
class PathFinding:
    """Per-path summary shown in the report."""

    id: str
    closed: bool
    source_segments: int
    curve_segments: int
    flattened_points: int
    simplified_points: int

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "closed": self.closed,
            "source_segments": self.source_segments,
            "curve_segments": self.curve_segments,
            "flattened_points": self.flattened_points,
            "simplified_points": self.simplified_points,
        }


@dataclass
class AnalysisReport:
    file_format: str
    path_count: int
    open_paths: list[str]
    duplicate_groups: list[list[str]]
    simplified_paths: list[PathFinding]
    paths: list[PathFinding]
    warnings: list[str] = field(default_factory=list)

    @property
    def has_issues(self) -> bool:
        return bool(self.open_paths or self.duplicate_groups or self.warnings)

    def as_dict(self) -> dict:
        return {
            "file_format": self.file_format,
            "path_count": self.path_count,
            "open_paths": self.open_paths,
            "duplicate_groups": self.duplicate_groups,
            "simplified_paths": [f.as_dict() for f in self.simplified_paths],
            "paths": [f.as_dict() for f in self.paths],
            "warnings": self.warnings,
            "has_issues": self.has_issues,
        }


def _signature(path: VectorPath) -> tuple:
    """Location-and-shape signature used to spot duplicate / coincident paths.

    Built from the simplified polyline, rounded and made order-independent so it
    matches regardless of start vertex or winding direction (the usual ways a
    double-drawn contour differs).
    """
    pts = geometry.rdp(path.points)
    rounded = frozenset((round(x, 3), round(y, 3)) for x, y in pts)
    return (round(geometry.polyline_length(path.points), 2), rounded)


def analyze(file_format: str, paths: list[VectorPath], warnings: list[str] | None = None) -> AnalysisReport:
    """Run the validation checks over the loaded paths."""
    warnings = list(warnings or [])

    open_paths = [p.id for p in paths if not p.closed]

    # Group paths by geometric signature; any group with >1 member is a set of
    # duplicate / coincident contours.
    by_sig: dict[tuple, list[str]] = defaultdict(list)
    for p in paths:
        by_sig[_signature(p)].append(p.id)
    duplicate_groups = [ids for ids in by_sig.values() if len(ids) > 1]

    findings: list[PathFinding] = []
    simplified: list[PathFinding] = []
    for p in paths:
        finding = PathFinding(
            id=p.id,
            closed=p.closed,
            source_segments=p.source_segment_count,
            curve_segments=p.curve_segment_count,
            flattened_points=len(p.points),
            simplified_points=len(p.simplified()),
        )
        findings.append(finding)
        if p.curve_segment_count > 0:
            simplified.append(finding)

    if not paths:
        warnings.append("No vector paths were found in the file.")

    return AnalysisReport(
        file_format=file_format,
        path_count=len(paths),
        open_paths=open_paths,
        duplicate_groups=duplicate_groups,
        simplified_paths=simplified,
        paths=findings,
        warnings=warnings,
    )
