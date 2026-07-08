"""Load a DXF file into the shared :class:`VectorPath` model.

Real-world DXF cut files are usually a soup of individual LINE / ARC / SPLINE
entities that only *visually* form closed contours. To detect genuinely open
paths we therefore:

1. Flatten every supported entity to a polyline (via ``ezdxf.path``).
2. Emit entities that are inherently closed (circles, closed polylines, ...) as
   their own closed paths.
3. Chain the remaining open segments together by shared endpoints, then decide
   closed/open on each assembled chain.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass

import ezdxf
from ezdxf import path as ezdxf_path

from . import geometry
from .geometry import Point
from .model import VectorPath

_CURVE_TYPES = {"ARC", "CIRCLE", "ELLIPSE", "SPLINE"}


@dataclass
class _Segment:
    points: list[Point]
    is_curve: bool


def _flatten_entity(entity, tol: float) -> list[Point] | None:
    """Flatten a single DXF entity to points, or ``None`` if unsupported."""
    try:
        p = ezdxf_path.make_path(entity)
    except (TypeError, ValueError):
        return None
    pts = [(v.x, v.y) for v in p.flattening(tol)]
    return geometry.dedupe_consecutive(pts) if len(pts) >= 2 else None


def _is_inherently_closed(entity) -> bool:
    t = entity.dxftype()
    if t == "CIRCLE":
        return True
    if t == "ELLIPSE":
        return abs(abs(entity.dxf.end_param - entity.dxf.start_param) - 2 * math.pi) < 1e-6
    if t == "LWPOLYLINE":
        return bool(entity.closed)
    if t == "POLYLINE":
        return bool(entity.is_closed)
    if t == "SPLINE":
        return bool(entity.closed)
    return False


def _has_bulge(entity) -> bool:
    t = entity.dxftype()
    try:
        if t == "LWPOLYLINE":
            return any(abs(pt[4]) > 1e-9 for pt in entity.get_points("xyseb"))
        if t == "POLYLINE":
            return any(abs(v.dxf.bulge) > 1e-9 for v in entity.vertices)
    except Exception:
        return False
    return False


def _assemble(segments: list[_Segment], tol: float) -> list[tuple[list[Point], bool, int, int]]:
    """Chain open segments by shared endpoints.

    Returns tuples of ``(points, curve_count, source_count)`` — closedness is
    decided by the caller from the geometry.
    """
    n = len(segments)
    used = [False] * n

    def key(pt: Point) -> tuple[int, int]:
        return (round(pt[0] / tol), round(pt[1] / tol))

    index: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, s in enumerate(segments):
        index[key(s.points[0])].append(i)
        index[key(s.points[-1])].append(i)

    def find(pt: Point) -> int | None:
        for j in index.get(key(pt), []):
            if not used[j]:
                return j
        return None

    chains: list[tuple[list[Point], bool, int, int]] = []
    for i in range(n):
        if used[i]:
            continue
        used[i] = True
        pts = list(segments[i].points)
        curve = 1 if segments[i].is_curve else 0
        count = 1

        progress = True
        while progress:
            progress = False
            # extend at the tail
            j = find(pts[-1])
            if j is not None:
                used[j] = True
                seg = segments[j].points
                add = seg if geometry.distance(seg[0], pts[-1]) <= tol else list(reversed(seg))
                pts.extend(add[1:])
                curve += 1 if segments[j].is_curve else 0
                count += 1
                progress = True
                continue
            # extend at the head
            j = find(pts[0])
            if j is not None:
                used[j] = True
                seg = segments[j].points
                add = seg if geometry.distance(seg[-1], pts[0]) <= tol else list(reversed(seg))
                pts = add[:-1] + pts
                curve += 1 if segments[j].is_curve else 0
                count += 1
                progress = True

        chains.append((pts, curve, count))
    return chains


def load_dxf(filepath: str, tol: float = geometry.FLATTEN_TOLERANCE) -> tuple[list[VectorPath], list[str]]:
    """Return ``(paths, warnings)`` parsed from ``filepath``."""
    warnings: list[str] = []
    try:
        doc = ezdxf.readfile(filepath)
    except (OSError, ezdxf.DXFError) as exc:
        return [], [f"Could not parse DXF: {exc}"]

    msp = doc.modelspace()
    result: list[VectorPath] = []
    open_segments: list[_Segment] = []
    skipped: set[str] = set()

    for entity in msp:
        pts = _flatten_entity(entity, tol)
        if pts is None:
            skipped.add(entity.dxftype())
            continue

        is_curve = entity.dxftype() in _CURVE_TYPES or _has_bulge(entity)
        if _is_inherently_closed(entity) or geometry.is_closed(pts):
            result.append(
                VectorPath(
                    id=f"{entity.dxftype().lower()}#{entity.dxf.handle}",
                    points=pts,
                    closed=True,
                    curve_segment_count=1 if is_curve else 0,
                    source_segment_count=1,
                )
            )
        else:
            open_segments.append(_Segment(points=pts, is_curve=is_curve))

    # Chain the loose open segments into contours.
    for idx, (pts, curve_count, seg_count) in enumerate(_assemble(open_segments, geometry.JOIN_TOLERANCE)):
        result.append(
            VectorPath(
                id=f"chain#{idx}",
                points=pts,
                closed=geometry.is_closed(pts),
                curve_segment_count=curve_count,
                source_segment_count=seg_count,
            )
        )

    if skipped:
        warnings.append(
            "Skipped unsupported DXF entities: " + ", ".join(sorted(skipped))
        )

    return result, warnings
