/**
 * Shared fast-check arbitraries for Chidar JavaScript property-based tests.
 *
 * Provides generators for room models, floor plans, furniture objects,
 * openings, and analysis data used across all frontend property tests.
 *
 * Feature: qidar-room-layout-analyzer
 */

import fc from "fast-check";

// ---------------------------------------------------------------------------
// Constants (mirrored from app.js for test generation)
// ---------------------------------------------------------------------------

export const FURNITURE_LABELS = [
  "bed", "couch", "chair", "desk", "bookshelf", "tv stand", "dresser",
  "nightstand", "wardrobe", "toilet", "sink", "bathtub", "shower",
  "bathroom cabinet", "patio table", "patio chair", "lounge chair",
  "planter", "grill", "dining table", "refrigerator", "oven",
  "dishwasher", "kitchen island", "plant", "rug", "lamp", "mirror",
  "side table", "ottoman",
];

export const DEPTH_ZONES = ["front", "center", "back"];
export const SIDE_ZONES = ["left", "center", "right"];
export const OPENING_TYPES = ["door", "window", "entrance"];
export const WALL_NAMES = ["front", "back", "left", "right"];
export const ANCHOR_WALLS = ["left", "right", "back"];
export const LIGHTING_VALUES = [
  "bright daylight",
  "balanced ambient light",
  "soft interior light",
  "dim interior light",
];
export const ROOM_TYPES = [
  "wide living area",
  "furnished bedroom or lounge",
  "compact bedroom",
  "multi-purpose interior room",
];

export const ELEMENT_MAP = {
  wood: ["bed", "couch", "chair", "dresser", "nightstand", "wardrobe", "desk",
    "bookshelf", "bathroom cabinet", "patio chair", "lounge chair", "plant",
    "side table"],
  fire: ["oven", "grill", "lamp"],
  earth: ["dining table", "patio table", "kitchen island", "planter", "rug",
    "ottoman"],
  metal: ["tv stand", "refrigerator", "dishwasher"],
  water: ["sink", "bathtub", "shower", "toilet", "mirror"],
};

export const BAGUA_GRID = [
  ["knowledge", "career", "helpful people"],
  ["family", "health", "creativity"],
  ["wealth", "fame", "relationships"],
];

// ---------------------------------------------------------------------------
// Arbitraries — Room Model
// ---------------------------------------------------------------------------

/** Generates a room model with width, depth, and height in meters. */
export function arbRoomModel() {
  return fc.record({
    width: fc.double({ min: 3.0, max: 8.0, noNaN: true }),
    depth: fc.double({ min: 3.0, max: 10.0, noNaN: true }),
    height: fc.double({ min: 2.2, max: 4.0, noNaN: true }),
  });
}

/** Generates a wall thickness value (typically 0.10–0.25 m). */
export function arbWallThickness() {
  return fc.double({ min: 0.05, max: 0.30, noNaN: true });
}

// ---------------------------------------------------------------------------
// Arbitraries — Furniture Object
// ---------------------------------------------------------------------------

/** Generates a single furniture object with all required fields. */
export function arbFurnitureObject(roomWidth, roomDepth, wallThickness = 0.15) {
  const minX = wallThickness;
  const minZ = wallThickness;
  // Ensure minimum furniture size
  const minDim = 0.2;
  const maxFurnW = Math.max(minDim, (roomWidth || 5) - 2 * wallThickness - 0.1);
  const maxFurnD = Math.max(minDim, (roomDepth || 5) - 2 * wallThickness - 0.1);

  return fc.record({
    label: fc.constantFrom(...FURNITURE_LABELS),
    source: fc.constantFrom("coco", "grid", "fallback", "toolbox"),
    color: fc.tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
    ),
    x: fc.double({ min: minX, max: Math.max(minX + 0.1, (roomWidth || 5) - wallThickness - minDim), noNaN: true }),
    z: fc.double({ min: minZ, max: Math.max(minZ + 0.1, (roomDepth || 5) - wallThickness - minDim), noNaN: true }),
    width: fc.double({ min: minDim, max: Math.min(2.5, maxFurnW), noNaN: true }),
    depth: fc.double({ min: minDim, max: Math.min(2.5, maxFurnD), noNaN: true }),
    height: fc.double({ min: 0.02, max: 2.5, noNaN: true }),
    zone: fc.constantFrom(...DEPTH_ZONES),
    sideZone: fc.constantFrom(...SIDE_ZONES),
    rotation: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
  });
}

/** Generates a furniture object with a specific label. */
export function arbFurnitureWithLabel(label, roomWidth = 5, roomDepth = 5, wallThickness = 0.15) {
  return arbFurnitureObject(roomWidth, roomDepth, wallThickness).map((obj) => ({
    ...obj,
    label,
  }));
}

/** Generates a list of furniture objects (0 to maxCount). */
export function arbFurnitureList(roomWidth = 5, roomDepth = 5, wallThickness = 0.15, maxCount = 8) {
  return fc.array(arbFurnitureObject(roomWidth, roomDepth, wallThickness), {
    minLength: 0,
    maxLength: maxCount,
  });
}

// ---------------------------------------------------------------------------
// Arbitraries — Opening
// ---------------------------------------------------------------------------

/** Generates a single opening (door, window, or entrance). */
export function arbOpening(roomWidth = 5, roomDepth = 5) {
  return fc.record({
    type: fc.constantFrom(...OPENING_TYPES),
    wall: fc.constantFrom(...WALL_NAMES, "inside"),
    x: fc.double({ min: 0, max: roomWidth, noNaN: true }),
    z: fc.double({ min: 0, max: roomDepth, noNaN: true }),
    width: fc.double({ min: 0.6, max: 1.5, noNaN: true }),
    depth: fc.double({ min: 0.08, max: 0.25, noNaN: true }),
    manual: fc.boolean(),
  });
}

/** Generates a manual opening of a specific type. */
export function arbManualOpening(type, roomWidth = 5, roomDepth = 5) {
  return arbOpening(roomWidth, roomDepth).map((o) => ({
    ...o,
    type,
    manual: true,
  }));
}

/** Generates a list of openings. */
export function arbOpeningList(roomWidth = 5, roomDepth = 5, maxCount = 6) {
  return fc.array(arbOpening(roomWidth, roomDepth), {
    minLength: 0,
    maxLength: maxCount,
  });
}

// ---------------------------------------------------------------------------
// Arbitraries — Floor Plan
// ---------------------------------------------------------------------------

/** Generates a complete floor plan object. */
export function arbFloorPlan() {
  return arbRoomModel().chain((room) => {
    const wt = 0.15;
    return fc.record({
      width: fc.constant(room.width),
      depth: fc.constant(room.depth),
      height: fc.constant(room.height),
      wallThickness: fc.constant(wt),
      boundary: fc.constant([
        { x: 0, y: 0 },
        { x: room.width, y: 0 },
        { x: room.width, y: room.depth },
        { x: 0, y: room.depth },
      ]),
      objects: arbFurnitureList(room.width, room.depth, wt, 8),
      openings: arbOpeningList(room.width, room.depth, 4),
      colors: fc.constant({
        floor: [180, 160, 140],
        leftWall: [200, 195, 190],
        backWall: [210, 205, 200],
        rightWall: [200, 195, 190],
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Arbitraries — Analysis Data
// ---------------------------------------------------------------------------

/** Generates a room analysis object (as returned by the Python backend). */
export function arbAnalysis() {
  return fc.record({
    summary: fc.constant("Test room analysis"),
    roomType: fc.constantFrom(...ROOM_TYPES),
    cameraView: fc.constantFrom(
      "eye-level wide shot",
      "upright phone capture",
      "slightly elevated angle",
      "straight-on interior view",
    ),
    floorPolygon: fc.tuple(
      fc.record({ x: fc.double({ min: 5, max: 25, noNaN: true }), y: fc.double({ min: 50, max: 85, noNaN: true }) }),
      fc.record({ x: fc.double({ min: 75, max: 95, noNaN: true }), y: fc.double({ min: 50, max: 85, noNaN: true }) }),
      fc.record({ x: fc.double({ min: 75, max: 100, noNaN: true }), y: fc.double({ min: 85, max: 100, noNaN: true }) }),
      fc.record({ x: fc.double({ min: 0, max: 25, noNaN: true }), y: fc.double({ min: 85, max: 100, noNaN: true }) }),
    ).map(([a, b, c, d]) => [a, b, c, d]),
    wallZones: fc.constant([
      { name: "left wall", x: 0, y: 0, width: 20, height: 60 },
      { name: "back wall", x: 20, y: 0, width: 60, height: 60 },
      { name: "right wall", x: 80, y: 0, width: 20, height: 60 },
    ]),
    avoidZones: fc.array(
      fc.record({
        x: fc.double({ min: 0, max: 100, noNaN: true }),
        width: fc.double({ min: 3, max: 30, noNaN: true }),
      }),
      { minLength: 0, maxLength: 8 },
    ),
    placementGuidance: fc.constant(["Place furniture along walls"]),
    lighting: fc.constantFrom(...LIGHTING_VALUES),
    dominantSide: fc.constantFrom("left", "center", "right"),
    horizonPercent: fc.double({ min: 28, max: 78, noNaN: true }),
  });
}

/** Generates a layout model. */
export function arbLayoutModel() {
  return arbRoomModel().chain((room) =>
    fc.record({
      width: fc.constant(room.width),
      depth: fc.constant(room.depth),
      height: fc.constant(room.height),
      anchorWall: fc.constantFrom(...ANCHOR_WALLS),
      zoneBands: fc.constant([
        { name: "front", start: 0.05, end: 0.32 },
        { name: "center", start: 0.32, end: 0.68 },
        { name: "back", start: 0.68, end: 0.95 },
      ]),
      sideBands: fc.constant([
        { name: "left", start: 0.04, end: 0.34 },
        { name: "center", start: 0.25, end: 0.75 },
        { name: "right", start: 0.66, end: 0.96 },
      ]),
      openings: arbOpeningList(room.width, room.depth, 4),
    }),
  );
}

// ---------------------------------------------------------------------------
// Arbitraries — Image / Pixel Data
// ---------------------------------------------------------------------------

/** Generates image dimensions (width, height) within given bounds. */
export function arbImageDimensions(minDim = 24, maxDim = 8000) {
  return fc.record({
    width: fc.integer({ min: minDim, max: maxDim }),
    height: fc.integer({ min: minDim, max: maxDim }),
  });
}

/** Generates a small pixel grid (RGBA) for brightness extraction tests. */
export function arbPixelGrid(maxW = 40, maxH = 40) {
  return fc.integer({ min: 2, max: maxW }).chain((w) =>
    fc.integer({ min: 2, max: maxH }).chain((h) =>
      fc.array(
        fc.array(
          fc.tuple(
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
          ),
          { minLength: w, maxLength: w },
        ),
        { minLength: h, maxLength: h },
      ).map((grid) => ({ width: w, height: h, pixels: grid })),
    ),
  );
}

// ---------------------------------------------------------------------------
// Arbitraries — Mesh / Export Data
// ---------------------------------------------------------------------------

/** Generates a 3D vertex [x, y, z]. */
export function arbVertex() {
  return fc.tuple(
    fc.double({ min: -10, max: 10, noNaN: true }),
    fc.double({ min: -10, max: 10, noNaN: true }),
    fc.double({ min: -10, max: 10, noNaN: true }),
  );
}

/** Generates a single triangle (3 vertices + normal + color). */
export function arbTriangle() {
  return fc.record({
    vertices: fc.tuple(arbVertex(), arbVertex(), arbVertex()),
    normal: arbVertex(),
    color: fc.tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
    ),
  });
}

/** Generates a non-degenerate triangle (vertices not collinear). */
export function arbNonDegenerateTriangle() {
  return arbTriangle().filter((tri) => {
    const [a, b, c] = tri.vertices;
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
    const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    return Math.sqrt(cx * cx + cy * cy + cz * cz) > 1e-10;
  });
}

/** Generates a mesh (array of triangles). */
export function arbMesh(minTris = 1, maxTris = 50) {
  return fc.array(arbTriangle(), { minLength: minTris, maxLength: maxTris });
}

/** Generates an export scale factor. */
export function arbScaleFactor() {
  return fc.double({ min: 0.01, max: 10, noNaN: true });
}

// ---------------------------------------------------------------------------
// Arbitraries — Scroll / Zoom
// ---------------------------------------------------------------------------

/** Generates a sequence of scroll deltaY values for zoom testing. */
export function arbScrollSequence(maxLen = 50) {
  return fc.array(
    fc.double({ min: -500, max: 500, noNaN: true }),
    { minLength: 1, maxLength: maxLen },
  );
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Computes brightness from RGBA tuple using the standard formula. */
export function brightness(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}
