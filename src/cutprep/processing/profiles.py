"""Cutting-method profiles and derived cutting parameters.

Each :class:`Method` captures machine defaults that drive how a file gets
prepped. From a chosen method plus a material thickness we derive two numbers:

* **kerf width** — the width of material removed by the cut. For a given tip /
  process this is roughly constant, so we treat it as a per-method default.
* **minimum safe feature size** — the smallest hole/slot/tab that will cut
  cleanly. As a rule of thumb this scales with material thickness, with a floor
  at the kerf width (you can't reliably cut a feature narrower than the kerf).

The exact numbers below are reasonable industry starting points, not calibrated
shop values — they are meant to be refined later.
"""

from __future__ import annotations

from dataclasses import dataclass

MM_PER_INCH = 25.4


@dataclass(frozen=True)
class Method:
    """Defaults for a single cutting method."""

    key: str
    label: str
    #: Kerf width in millimetres (canonical unit).
    kerf_mm: float
    #: Minimum safe feature size expressed as a multiple of material thickness.
    min_feature_thickness_factor: float


# Keyed by a stable slug used in forms and URLs.
METHODS: dict[str, Method] = {
    "plasma_standard": Method(
        "plasma_standard", "Plasma (Standard Tip)", kerf_mm=1.5, min_feature_thickness_factor=1.5
    ),
    "plasma_fine": Method(
        "plasma_fine", "Plasma (Fine-Cut Tip)", kerf_mm=0.8, min_feature_thickness_factor=1.0
    ),
    "laser": Method("laser", "Laser", kerf_mm=0.15, min_feature_thickness_factor=0.5),
    "waterjet": Method("waterjet", "Waterjet", kerf_mm=0.9, min_feature_thickness_factor=0.5),
}


def to_mm(value: float, unit: str) -> float:
    """Convert a length in inches or millimetres to millimetres."""
    unit = unit.lower()
    if unit in ("mm", "millimeter", "millimetre"):
        return value
    if unit in ("in", "inch", "inches", '"'):
        return value * MM_PER_INCH
    raise ValueError(f"unknown unit: {unit!r}")


@dataclass(frozen=True)
class CuttingParameters:
    """The derived values shown to the user for a method + thickness choice."""

    method: str
    method_label: str
    thickness_mm: float
    kerf_mm: float
    min_feature_mm: float

    def as_dict(self) -> dict:
        """Serialise with both metric and imperial values for display."""
        return {
            "method": self.method,
            "method_label": self.method_label,
            "thickness": {"mm": round(self.thickness_mm, 4), "in": round(self.thickness_mm / MM_PER_INCH, 4)},
            "kerf_width": {"mm": round(self.kerf_mm, 4), "in": round(self.kerf_mm / MM_PER_INCH, 4)},
            "min_feature_size": {
                "mm": round(self.min_feature_mm, 4),
                "in": round(self.min_feature_mm / MM_PER_INCH, 4),
            },
        }


def compute_parameters(method_key: str, thickness: float, unit: str) -> CuttingParameters:
    """Derive kerf width and minimum safe feature size.

    Args:
        method_key: One of the keys in :data:`METHODS`.
        thickness: Material thickness in ``unit``.
        unit: ``"in"`` or ``"mm"``.

    Returns:
        A :class:`CuttingParameters` with everything in canonical millimetres.

    Raises:
        KeyError: If ``method_key`` is unknown.
        ValueError: If ``thickness`` is not positive or ``unit`` is unknown.
    """
    if method_key not in METHODS:
        raise KeyError(method_key)
    if thickness <= 0:
        raise ValueError("thickness must be positive")

    method = METHODS[method_key]
    thickness_mm = to_mm(thickness, unit)

    # Minimum safe feature scales with thickness but never goes below the kerf.
    min_feature_mm = max(method.kerf_mm, method.min_feature_thickness_factor * thickness_mm)

    return CuttingParameters(
        method=method.key,
        method_label=method.label,
        thickness_mm=thickness_mm,
        kerf_mm=method.kerf_mm,
        min_feature_mm=min_feature_mm,
    )
