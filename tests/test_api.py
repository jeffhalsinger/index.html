"""Tests for the FastAPI image -> DXF endpoint.

Skipped automatically if the API extras (fastapi/opencv/ezdxf) aren't installed.
"""

from __future__ import annotations

import io

import pytest

pytest.importorskip("cv2")
pytest.importorskip("fastapi")
ezdxf = pytest.importorskip("ezdxf")

import numpy as np  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from cutprep.api import app, vectorize_image  # noqa: E402

client = TestClient(app)


def _png_bytes() -> bytes:
    """A simple high-contrast test image: a filled square with a hole."""
    import cv2

    img = np.full((200, 200), 255, np.uint8)
    cv2.rectangle(img, (40, 40), (160, 160), 0, -1)   # black square
    cv2.rectangle(img, (80, 80), (120, 120), 255, -1)  # white hole
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


def test_vectorize_returns_valid_dxf():
    png = _png_bytes()
    resp = client.post(
        "/vectorize?width_mm=100&epsilon=0.01",
        files={"file": ("square.png", png, "image/png")},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/dxf"
    assert "attachment" in resp.headers["content-disposition"]
    assert int(resp.headers["x-contour-count"]) >= 1

    doc = ezdxf.read(io.StringIO(resp.content.decode("utf-8")))
    ents = list(doc.modelspace())
    assert ents, "DXF has entities"
    assert all(e.dxftype() == "LWPOLYLINE" for e in ents)


def test_low_vertex_count():
    # A square should simplify to very few vertices per contour.
    png = _png_bytes()
    _dxf, contours, vertices = vectorize_image(png, epsilon_frac=0.02)
    assert contours >= 1
    # Average vertices per contour should stay small for a blocky shape.
    assert vertices / contours < 12


def test_scaling_to_mm():
    png = _png_bytes()
    dxf, _c, _v = vectorize_image(png, width_mm=100.0)
    doc = ezdxf.read(io.StringIO(dxf))
    xs = [p[0] for e in doc.modelspace() for p in e.get_points("xy")]
    assert max(xs) <= 100.0 + 1e-6  # scaled into the 100 mm width


def test_bad_image_is_400():
    resp = client.post(
        "/vectorize",
        files={"file": ("x.png", b"not an image", "image/png")},
    )
    assert resp.status_code == 400
