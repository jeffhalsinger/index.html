"""Cutting-process profiles.

Each profile captures the machine-specific defaults that influence how a file
should be prepped: kerf width (material removed by the beam/stream), and
lead-in/lead-out lengths for pierce points. Values are sensible starting
points in millimetres, not calibrated shop settings.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Profile:
    """Defaults for a single cutting process."""

    name: str
    #: Width of material removed by the cut, in millimetres.
    kerf_mm: float
    #: Length of the lead-in move before the cut proper, in millimetres.
    lead_in_mm: float
    #: Length of the lead-out move after the cut, in millimetres.
    lead_out_mm: float

    def as_dict(self) -> dict:
        return asdict(self)


PROFILES: dict[str, Profile] = {
    "plasma": Profile("plasma", kerf_mm=1.5, lead_in_mm=5.0, lead_out_mm=3.0),
    "laser": Profile("laser", kerf_mm=0.15, lead_in_mm=1.0, lead_out_mm=1.0),
    "waterjet": Profile("waterjet", kerf_mm=1.0, lead_in_mm=4.0, lead_out_mm=2.0),
}
