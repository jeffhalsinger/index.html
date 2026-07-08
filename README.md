# CutPrep

A web app that preps images and vector files for CNC cutting — plasma, laser, and waterjet.

Upload a raster image (PNG/JPG) or vector file (SVG/DXF) and CutPrep cleans it up
into a cut-ready toolpath source: normalized units, closed paths, simplified
geometry, and machine-appropriate defaults for each cutting process.

## Features (planned)

- **Raster prep** — thresholding, background removal, and vectorization (bitmap → paths)
- **Vector prep** — path cleanup, closing open contours, node simplification, unit normalization
- **Process profiles** — plasma / laser / waterjet presets (kerf, lead-in/out, feed defaults)
- **Export** — cut-ready SVG/DXF output

## Tech stack

- Python 3.11+
- [Flask](https://flask.palletsprojects.com/) web framework
- [Pillow](https://python-pillow.org/) for raster image handling
- [svgwrite](https://github.com/mozman/svgwrite) / [svgpathtools](https://github.com/mathandy/svgpathtools) for vector handling

## Getting started

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. Install the project (editable) with dev extras
pip install -e ".[dev]"

# 3. Run the development server
flask --app cutprep.app run --debug
```

Then open http://localhost:5000.

## Development

```bash
pytest            # run the test suite
ruff check .      # lint
ruff format .     # format
```

## Project layout

```
src/cutprep/
├── __init__.py
├── app.py              # Flask application factory
├── config.py           # configuration objects
├── routes.py           # HTTP routes / views
└── processing/
    ├── __init__.py
    ├── raster.py       # image (PNG/JPG) prep
    ├── vector.py       # vector (SVG/DXF) prep
    └── profiles.py     # plasma / laser / waterjet process profiles
tests/                  # pytest test suite
```

## License

MIT — see [LICENSE](LICENSE).
