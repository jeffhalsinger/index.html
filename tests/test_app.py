import pytest

from cutprep.processing import profiles


def test_index_lists_methods(client):
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.get_data(as_text=True)
    assert "Plasma (Standard Tip)" in body
    assert "Waterjet" in body


def test_analyze_computes_parameters(client):
    resp = client.post(
        "/analyze",
        data={"method": "laser", "thickness": "0.25", "unit": "in"},
    )
    assert resp.status_code == 200
    body = resp.get_data(as_text=True)
    assert "Kerf width" in body
    assert "Laser" in body


def test_analyze_rejects_bad_input(client):
    resp = client.post("/analyze", data={"method": "laser", "thickness": "-1", "unit": "in"})
    assert resp.status_code == 400


def test_api_parameters_json(client):
    resp = client.get("/api/parameters?method=plasma_standard&thickness=0.25&unit=in")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["method"] == "plasma_standard"
    assert data["kerf_width"]["mm"] == 1.5


# --- unit tests for the derivation logic -------------------------------------


def test_kerf_is_method_default():
    p = profiles.compute_parameters("plasma_fine", thickness=0.25, unit="in")
    assert p.kerf_mm == 0.8


def test_min_feature_scales_with_thickness():
    # 0.5 in = 12.7 mm; plasma standard factor 1.5 -> 19.05 mm feature.
    p = profiles.compute_parameters("plasma_standard", thickness=0.5, unit="in")
    assert round(p.min_feature_mm, 2) == 19.05


def test_min_feature_floored_at_kerf():
    # Very thin material: factor*thickness would be tiny, so kerf wins.
    p = profiles.compute_parameters("laser", thickness=0.1, unit="mm")
    assert p.min_feature_mm == 0.15  # laser kerf floor


def test_unit_conversion():
    p = profiles.compute_parameters("waterjet", thickness=25.4, unit="mm")
    assert round(p.thickness_mm / profiles.MM_PER_INCH, 3) == 1.0


def test_unknown_method_raises():
    with pytest.raises(KeyError):
        profiles.compute_parameters("nope", thickness=1, unit="in")
