"""Low-level 2D geometry helpers shared by the SVG and DXF loaders.

Everything here works on plain ``(x, y)`` float tuples so the loaders can stay
independent of their source libraries.
"""

from __future__ import annotations

import math

Point = tuple[float, float]

# Default tolerances, in the drawing's native units. Curves are flattened finely
# (FLATTEN_TOLERANCE) and then reduced with Ramer-Douglas-Peucker at a coarser
# tolerance (SIMPLIFY_TOLERANCE) to produce a clean polyline.
FLATTEN_TOLERANCE = 0.05
SIMPLIFY_TOLERANCE = 0.1

# How close two points must be to count as the same location (open-path /
# endpoint-chaining checks).
JOIN_TOLERANCE = 1e-3


def distance(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def polyline_length(points: list[Point]) -> float:
    return sum(distance(points[i], points[i + 1]) for i in range(len(points) - 1))


def bounding_box(points: list[Point]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def is_closed(points: list[Point], tol: float = JOIN_TOLERANCE) -> bool:
    """A polyline is closed if it has area and its ends meet."""
    return len(points) > 2 and distance(points[0], points[-1]) <= tol


def _perpendicular_distance(p: Point, a: Point, b: Point) -> float:
    """Distance from ``p`` to the line through ``a`` and ``b``."""
    if a == b:
        return distance(p, a)
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    # |cross product| / |ab|
    return abs(dx * (ay - py) - (ax - px) * dy) / math.hypot(dx, dy)


def rdp(points: list[Point], epsilon: float = SIMPLIFY_TOLERANCE) -> list[Point]:
    """Ramer-Douglas-Peucker polyline simplification (iterative).

    Reduces a dense polyline to the fewest vertices that stay within ``epsilon``
    of the original. Endpoints are always kept.
    """
    n = len(points)
    if n < 3:
        return list(points)

    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        start, end = stack.pop()
        dmax, idx = 0.0, -1
        a, b = points[start], points[end]
        for i in range(start + 1, end):
            d = _perpendicular_distance(points[i], a, b)
            if d > dmax:
                dmax, idx = d, i
        if dmax > epsilon and idx != -1:
            keep[idx] = True
            stack.append((start, idx))
            stack.append((idx, end))

    return [points[i] for i in range(n) if keep[i]]


def dedupe_consecutive(points: list[Point], tol: float = 1e-9) -> list[Point]:
    """Drop consecutive points that sit on top of each other."""
    out: list[Point] = []
    for p in points:
        if not out or distance(out[-1], p) > tol:
            out.append(p)
    return out
