# Qidar — Room Layout & Feng Shui Analyzer

Qidar is a browser-based tool that turns a room photograph into a 2D floor plan, scores the layout against Feng Shui principles, renders a live 3D preview, and exports the model as STL or OBJ.

![Qidar](../Qi_dar_logo.png)

## How It Works

1. **Upload** a photo of your room (JPEG, PNG, or HEIC)
2. **AI analyzes** walls, floor, horizon line, and furniture
3. **2D floor plan** is generated with detected objects placed automatically
4. **Feng Shui scoring** evaluates command position, five elements, Bagua map, qi flow, and more
5. **Drag, resize, rotate** furniture on the interactive floor plan
6. **3D preview** with orbit controls, then export as STL or OBJ

## Architecture

```
Browser (vanilla JS, no build step)
├── Image Processor — downscales photo, extracts brightness data
├── Object Detector — TensorFlow.js COCO-SSD for furniture detection
├── Floor Plan Builder — 2D Canvas with drag/resize/rotate
├── Feng Shui Scorer — scores layout against 10 categories
├── 3D Renderer — Three.js with orbit controls and wall color sampling
└── Mesh Exporter — binary STL (with color) and Wavefront OBJ

Server (Python)
└── Room Analyzer — horizon detection, zone grouping, dimension estimation
```

The frontend is a single-page app using ES modules with an import map for Three.js (no bundler required). The Python backend receives pre-extracted brightness/energy arrays — not raw images — keeping payloads small.

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 18+ (for running tests only)

### Run Locally

```bash
cd Chidar
python server.py
```

The app will be available at [http://127.0.0.1:4173](http://127.0.0.1:4173).

### Deploy to Vercel

The project is configured for Vercel out of the box:

- Python API endpoints (`/api/model-room`, `/api/health`) run as serverless functions
- Frontend is served as static files with clean URLs
- See `vercel.json` for configuration

## Project Structure

```
Chidar/
├── index.html              # Landing page + app shell
├── styles.css              # Full stylesheet (dark/light theme)
├── src/
│   ├── app.js              # All frontend logic (~2700 lines)
│   └── logic.js            # Shared utility functions
├── api/
│   ├── model-room.py       # Vercel serverless endpoint
│   └── health.py           # Health check endpoint
├── room_analysis.py        # Core room analysis (shared by server + Vercel)
├── server.py               # Local development server
├── tests/
│   ├── js/                 # JavaScript property-based tests (fast-check + vitest)
│   └── test_property_*.py  # Python property-based tests (hypothesis + pytest)
├── package.json            # JS dev dependencies (vitest, fast-check)
├── vitest.config.js        # Vitest configuration
├── requirements-test.txt   # Python test dependencies (hypothesis, pytest)
└── vercel.json             # Vercel deployment config
```

## Features

- **Image format support** — JPEG, PNG, and HEIC/HEIF (auto-converted via heic2any)
- **Room geometry detection** — horizon line, occupied zones, wall zones, floor polygon
- **Dimension estimation** — width, depth, and height in meters (with optional calibration object)
- **Furniture detection** — COCO-SSD identifies up to 20 objects; ~30 preset furniture types in the toolbox
- **Interactive floor plan** — drag, resize, rotate furniture; pan and zoom the canvas
- **Opening management** — inferred doors/windows with manual override (click to place, click to remove)
- **Feng Shui scoring** — 10 categories including command position, five elements, Bagua map, qi flow, yin/yang balance, mirror placement, clutter, and lighting
- **3D preview** — Three.js with image-sampled wall colors, type-specific furniture meshes, and orbit controls
- **Export** — binary STL with per-face color or Wavefront OBJ, with configurable scale factor
- **Dark/light theme** — synced across landing page and app

## Running Tests

### Python (property-based)

```bash
pip install -r requirements-test.txt
pytest tests/
```

### JavaScript (property-based)

```bash
npm install
npm test
```

## Feng Shui Scoring Categories

| Category | Max Impact |
|---|---|
| Command position (bed/couch backed by wall, sightline to door) | +12 / -10 |
| Five elements balance (wood, fire, earth, metal, water) | +6 / -6 |
| Bagua map zones (health center, wealth corner) | +5 / -8 |
| Qi flow (entry corridor unblocked) | +6 / -10 |
| Yin/yang balance (tall vs low items) | +4 / -4 |
| Mirror placement (not facing bed, facing windows) | +3 / -6 |
| Kitchen work triangle (stove, sink, fridge) | +4 / -4 |
| Bathroom rules (toilet placement) | -6 |
| Clutter & symmetry (coverage ratio, left-right balance) | +4 / -8 |
| Lighting conditions | +3 / -4 |

Final score is clamped between 10 and 98.

## License

Private project.
