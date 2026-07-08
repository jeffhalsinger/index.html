import io


def test_index(client):
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["app"] == "CutPrep"
    assert set(data["processes"]) == {"plasma", "laser", "waterjet"}


def test_profiles(client):
    resp = client.get("/profiles")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["laser"]["kerf_mm"] == 0.15


def test_prep_requires_file(client):
    resp = client.post("/prep")
    assert resp.status_code == 400


def test_prep_rejects_unsupported_type(client):
    data = {"file": (io.BytesIO(b"nope"), "notes.txt")}
    resp = client.post("/prep", data=data, content_type="multipart/form-data")
    assert resp.status_code == 415


def test_prep_vector(client):
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
    data = {"file": (io.BytesIO(svg), "part.svg"), "process": "plasma"}
    resp = client.post("/prep", data=data, content_type="multipart/form-data")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["process"] == "plasma"
    assert body["result"]["type"] == "vector"
    assert body["result"]["kerf_mm"] == 1.5
