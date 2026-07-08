"""Resolve the real-world units of an SVG or DXF drawing.

Simplification tolerances are meaningful only in real units (you want "simplify
to within 0.1 mm", not "0.1 user units"). This module maps a file's native
drawing units onto millimetres so the rest of the pipeline can work in mm.

For each format we return a :class:`UnitInfo` with ``mm_per_unit`` (multiply a
coordinate value by this to get millimetres) plus a human-readable description
and an ``ambiguous`` flag for when the file doesn't actually declare its units.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

MM_PER_INCH = 25.4
# CSS/SVG2 reference pixel size: 96 px per inch.
CSS_PX_PER_INCH = 96.0
MM_PER_PX = MM_PER_INCH / CSS_PX_PER_INCH

# Physical CSS length units -> millimetres.
_PHYSICAL = {
    "mm": 1.0,
    "cm": 10.0,
    "in": MM_PER_INCH,
    "pt": MM_PER_INCH / 72.0,
    "pc": MM_PER_INCH / 6.0,
}

# DXF $INSUNITS code -> millimetres per unit (common codes only).
_DXF_INSUNITS = {
    1: MM_PER_INCH,   # inches
    2: MM_PER_INCH * 12,  # feet
    4: 1.0,           # millimetres
    5: 10.0,          # centimetres
    6: 1000.0,        # metres
    8: MM_PER_INCH * 1e-6,  # microinches
    9: MM_PER_INCH * 1e-3,  # mils
}

_LENGTH_RE = re.compile(r"^\s*([+-]?[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)\s*([a-z%]*)\s*$")


@dataclass
class UnitInfo:
    mm_per_unit: float
    description: str
    ambiguous: bool = False


def _fallback_mm_per_unit(fallback_unit: str) -> float:
    return MM_PER_INCH if fallback_unit.lower().startswith("in") else 1.0


def _parse_length(text: str) -> tuple[float, str] | None:
    m = _LENGTH_RE.match(text or "")
    if not m:
        return None
    return float(m.group(1)), (m.group(2) or "px")


def resolve_svg_units(svg_attrs: dict, fallback_unit: str = "mm") -> UnitInfo:
    """Work out mm-per-user-unit for an SVG root element.

    The reliable case is a physical ``width`` (e.g. ``200mm``) combined with a
    ``viewBox`` — then 1 user unit = width_mm / viewBox_width. Otherwise we fall
    back to the SVG default of 96 px/inch and flag the result as ambiguous.
    """
    width = svg_attrs.get("width")
    view_box = svg_attrs.get("viewBox") or svg_attrs.get("viewbox")

    vb_width = None
    if view_box:
        parts = re.split(r"[\s,]+", view_box.strip())
        if len(parts) == 4:
            try:
                vb_width = float(parts[2])
            except ValueError:
                vb_width = None

    parsed = _parse_length(width) if width else None

    if parsed and vb_width:
        value, unit = parsed
        if unit in _PHYSICAL:
            width_mm = value * _PHYSICAL[unit]
            mpu = width_mm / vb_width
            return UnitInfo(mpu, f"width={width}, viewBox width={vb_width:g} → 1 unit = {mpu:.4g} mm")
        # px / unitless width with a viewBox.
        width_mm = value * MM_PER_PX
        mpu = width_mm / vb_width
        return UnitInfo(
            mpu,
            f"width={width} (px, 96 px/in), viewBox width={vb_width:g} → 1 unit = {mpu:.4g} mm",
            ambiguous=True,
        )

    # No usable physical size: assume user units are CSS pixels at 96 px/inch.
    return UnitInfo(
        MM_PER_PX,
        f"no physical width in SVG; assuming 96 px/inch → 1 unit = {MM_PER_PX:.4g} mm",
        ambiguous=True,
    )


def resolve_dxf_units(insunits: int, fallback_unit: str = "mm") -> UnitInfo:
    """Work out mm-per-unit from a DXF ``$INSUNITS`` header code."""
    if insunits in _DXF_INSUNITS:
        mpu = _DXF_INSUNITS[insunits]
        return UnitInfo(mpu, f"$INSUNITS={insunits} → 1 unit = {mpu:.4g} mm")

    mpu = _fallback_mm_per_unit(fallback_unit)
    return UnitInfo(
        mpu,
        f"DXF units unspecified ($INSUNITS={insunits}); assuming {fallback_unit} → 1 unit = {mpu:.4g} mm",
        ambiguous=True,
    )
