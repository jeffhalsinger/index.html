"""FastAPI image → cut-ready DXF endpoint.

Uploads any image, converts it to a high-contrast binary via adaptive
thresholding, extracts contours with OpenCV, simplifies them (low vertex
count) and returns a downloadable, cut-ready DXF.

Run locally:
    pip install -e ".[api]"
    uvicorn cutprep.api:app --reload
    # open http://localhost:8000  (simple upload form) or POST /vectorize
"""

from __future__ import annotations

import io

import cv2
import ezdxf
import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse

app = FastAPI(title="CutPrep Vectorizer", version="0.1.0")

MM_PER_INCH = 25.4


def vectorize_image(
    data: bytes,
    *,
    width_mm: float | None = None,
    block_size: int = 35,
    c: float = 5.0,
    epsilon_frac: float = 0.002,
    invert: bool = False,
    min_area_px: float = 50.0,
) -> tuple[str, int, int]:
    """Turn image bytes into a DXF document string.

    Args:
        data: Raw image file bytes (PNG/JPG/etc.).
        width_mm: Real-world width of the output; scales pixels to millimetres.
            If ``None``, 1 px = 1 mm.
        block_size: Neighbourhood size for adaptive thresholding (odd, >= 3).
        c: Constant subtracted from the local mean in adaptive thresholding.
        epsilon_frac: Douglas-Peucker tolerance as a fraction of each contour's
            perimeter — larger keeps fewer vertices.
        invert: Flip foreground/background (use for light shapes on dark).
        min_area_px: Drop contours smaller than this pixel area (speckle).

    Returns:
        ``(dxf_text, contour_count, vertex_count)``.

    Raises:
        ValueError: If the image cannot be decoded.
    """
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Could not decode image (unsupported or corrupt file).")

    img = cv2.medianBlur(img, 3)
    block = max(3, block_size | 1)  # force odd
    mode = cv2.THRESH_BINARY if invert else cv2.THRESH_BINARY_INV
    binary = cv2.adaptiveThreshold(
        img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, mode, block, c
    )

    contours, _ = cv2.findContours(binary, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

    h, w = img.shape
    mm_per_px = (width_mm / w) if width_mm else 1.0

    doc = ezdxf.new("R2000")
    doc.units = ezdxf.units.MM
    msp = doc.modelspace()

    kept = 0
    vertices = 0
    for cnt in contours:
        if cv2.contourArea(cnt) < min_area_px:
            continue
        peri = cv2.arcLength(cnt, True)
        eps = max(epsilon_frac * peri, 0.5)
        approx = cv2.approxPolyDP(cnt, eps, True)
        if len(approx) < 3:
            continue
        # Flip Y (image is y-down, DXF is y-up) and scale to millimetres.
        pts = [(float(p[0][0]) * mm_per_px, float(h - p[0][1]) * mm_per_px) for p in approx]
        msp.add_lwpolyline(pts, close=True, dxfattribs={"layer": "CUT"})
        kept += 1
        vertices += len(pts)

    stream = io.StringIO()
    doc.write(stream)
    return stream.getvalue(), kept, vertices


@app.post("/vectorize")
async def vectorize(
    file: UploadFile = File(...),
    width_mm: float | None = Query(None, description="Real-world output width in mm."),
    block_size: int = Query(35, ge=3, description="Adaptive-threshold block size (odd)."),
    c: float = Query(5.0, description="Adaptive-threshold constant."),
    epsilon: float = Query(0.002, ge=0.0, description="Simplification tolerance (fraction of perimeter)."),
    invert: bool = Query(False, description="Light shapes on dark background."),
    min_area: float = Query(50.0, ge=0.0, description="Drop contours smaller than this px area."),
):
    """Accept an image and return a downloadable cut-ready DXF."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload.")
    try:
        dxf_text, contours, vertices = vectorize_image(
            data,
            width_mm=width_mm,
            block_size=block_size,
            c=c,
            epsilon_frac=epsilon,
            invert=invert,
            min_area_px=min_area,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    stem = (file.filename or "image").rsplit(".", 1)[0]
    buf = io.BytesIO(dxf_text.encode("utf-8"))
    return StreamingResponse(
        buf,
        media_type="application/dxf",
        headers={
            "Content-Disposition": f'attachment; filename="{stem}-cut.dxf"',
            "X-Contour-Count": str(contours),
            "X-Vertex-Count": str(vertices),
        },
    )


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    """Minimal upload form for manual testing."""
    return """<!doctype html><meta charset="utf-8"><title>CutPrep Vectorizer</title>
<h1>CutPrep — image to cut-ready DXF</h1>
<form action="/vectorize" method="post" enctype="multipart/form-data">
  <p><input type="file" name="file" accept="image/*" required></p>
  <p>Output width (mm): <input type="number" name="width_mm" step="any" value="200"></p>
  <p>Simplify (epsilon): <input type="number" name="epsilon" step="any" value="0.002"></p>
  <p><label><input type="checkbox" name="invert" value="true"> invert</label></p>
  <p><button type="submit">Vectorize &rarr; download DXF</button></p>
</form>
<p>API: <code>POST /vectorize</code> (multipart <code>file</code>). Docs at <a href="/docs">/docs</a>.</p>
"""
