"""Tests for the SVG/DXF vector validation pipeline."""

from __future__ import annotations

import ezdxf
import pytest

from cutprep.processing import units, vector

# --- SVG fixtures ------------------------------------------------------------

CLEAN_SVG = """<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100">
  <path id="square" d="M0,0 L10,0 L10,10 L0,10 Z"/>
</svg>
"""

MESSY_SVG = """<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100">
  <path id="square" d="M0,0 L10,0 L10,10 L0,10 Z"/>
  <path id="square_dup" d="M0,0 L10,0 L10,10 L0,10 Z"/>
  <path id="openL" d="M20,0 L30,0 L30,10"/>
  <path id="curve" d="M0,20 C5,30 15,30 20,20"/>
</svg>
"""

# No physical width -> units are ambiguous.
UNITLESS_SVG = """<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path id="square" d="M0,0 L10,0 L10,10 L0,10 Z"/>
</svg>
"""


def _write(tmp_path, name, content):
    p = tmp_path / name
    p.write_text(content)
    return p


def test_svg_clean(tmp_path):
    report = vector.analyze_file(_write(tmp_path, "clean.svg", CLEAN_SVG))
    assert report.path_count == 1
    assert report.open_paths == []
    assert report.duplicate_groups == []
    assert not report.has_issues


def test_svg_detects_open_paths(tmp_path):
    report = vector.analyze_file(_write(tmp_path, "messy.svg", MESSY_SVG))
    # openL and the (open) bezier curve are not closed.
    assert "openL" in report.open_paths
    assert "curve" in report.open_paths
    assert "square" not in report.open_paths


def test_svg_detects_duplicates(tmp_path):
    report = vector.analyze_file(_write(tmp_path, "messy.svg", MESSY_SVG))
    dup_group = next((g for g in report.duplicate_groups if "square" in g), None)
    assert dup_group is not None
    assert set(dup_group) == {"square", "square_dup"}


def test_svg_simplifies_curves(tmp_path):
    report = vector.analyze_file(_write(tmp_path, "messy.svg", MESSY_SVG))
    curve = next((f for f in report.simplified_paths if f.id == "curve"), None)
    assert curve is not None
    assert curve.curve_segments == 1
    # A single bezier flattens to many points but simplifies to far fewer.
    assert curve.simplified_points < curve.flattened_points


# --- DXF fixtures ------------------------------------------------------------


def _build_dxf(path):
    doc = ezdxf.new()
    doc.units = ezdxf.units.MM  # $INSUNITS = 4
    msp = doc.modelspace()
    # Closed square from four separate LINE entities.
    msp.add_line((0, 0), (10, 0))
    msp.add_line((10, 0), (10, 10))
    msp.add_line((10, 10), (0, 10))
    msp.add_line((0, 10), (0, 0))
    # Open contour: two lines that don't close.
    msp.add_line((20, 0), (30, 0))
    msp.add_line((30, 0), (30, 10))
    # A closed circle and an open arc (both curves).
    msp.add_circle((50, 5), 3)
    msp.add_arc((70, 5), 3, start_angle=0, end_angle=90)
    doc.saveas(path)


def test_dxf_chains_lines_into_closed_contour(tmp_path):
    p = tmp_path / "part.dxf"
    _build_dxf(p)
    report = vector.analyze_file(p)
    # Exactly one closed contour should come from the four square lines.
    closed = [f for f in report.paths if f.closed and not report.open_paths.count(f.id)]
    assert any(f.closed and f.source_segments == 4 for f in report.paths)


def test_dxf_detects_open_contour(tmp_path):
    p = tmp_path / "part.dxf"
    _build_dxf(p)
    report = vector.analyze_file(p)
    # The two-line chain and the lone arc are open.
    open_findings = [f for f in report.paths if not f.closed]
    assert any(f.source_segments == 2 for f in open_findings)  # the 2-line chain
    assert report.open_paths  # non-empty


def test_dxf_circle_is_closed_curve(tmp_path):
    p = tmp_path / "part.dxf"
    _build_dxf(p)
    report = vector.analyze_file(p)
    circles = [f for f in report.paths if f.id.startswith("circle")]
    assert len(circles) == 1
    assert circles[0].closed
    assert circles[0].curve_segments == 1


def test_unsupported_extension(tmp_path):
    p = tmp_path / "notes.txt"
    p.write_text("hello")
    with pytest.raises(ValueError):
        vector.analyze_file(p)


# --- unit-aware tolerance tests ---------------------------------------------


def test_svg_physical_units_resolve_to_mm(tmp_path):
    report = vector.analyze_file(_write(tmp_path, "clean.svg", CLEAN_SVG))
    # width=100mm over a 100-unit viewBox -> 1 user unit == 1 mm.
    assert report.mm_per_unit == pytest.approx(1.0)
    assert not report.unit_ambiguous


def test_svg_unitless_is_flagged_ambiguous(tmp_path):
    report = vector.analyze_file(_write(tmp_path, "unitless.svg", UNITLESS_SVG))
    assert report.unit_ambiguous
    # 96 px/inch assumption.
    assert report.mm_per_unit == pytest.approx(units.MM_PER_PX)
    assert any("ambiguous" in w.lower() for w in report.warnings)


def test_dxf_units_from_insunits():
    assert units.resolve_dxf_units(4).mm_per_unit == pytest.approx(1.0)      # mm
    assert units.resolve_dxf_units(1).mm_per_unit == pytest.approx(25.4)     # inch
    assert units.resolve_dxf_units(0).ambiguous                              # unspecified


def test_kerf_drives_simplification_tolerance(tmp_path):
    svg = _write(tmp_path, "messy.svg", MESSY_SVG)
    # Fine kerf (laser ~0.15mm) vs coarse kerf (plasma ~1.5mm).
    fine = vector.analyze_file(svg, kerf_mm=0.15)
    coarse = vector.analyze_file(svg, kerf_mm=1.5)

    assert fine.simplify_tolerance_mm < coarse.simplify_tolerance_mm
    fine_curve = next(f for f in fine.simplified_paths if f.id == "curve")
    coarse_curve = next(f for f in coarse.simplified_paths if f.id == "curve")
    # A coarser tolerance keeps fewer or equal points.
    assert coarse_curve.simplified_points <= fine_curve.simplified_points


def test_fallback_unit_used_for_unitless_dxf(tmp_path):
    doc = ezdxf.new()
    doc.header["$INSUNITS"] = 0  # force "unspecified"
    doc.modelspace().add_circle((0, 0), 5)
    p = tmp_path / "nounits.dxf"
    doc.saveas(p)

    mm = vector.analyze_file(p, fallback_unit="mm")
    inch = vector.analyze_file(p, fallback_unit="in")
    assert mm.mm_per_unit == pytest.approx(1.0)
    assert inch.mm_per_unit == pytest.approx(25.4)
