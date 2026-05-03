/**
 * Smoke test — verifies vitest + fast-check infrastructure works.
 *
 * Feature: qidar-room-layout-analyzer
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  arbRoomModel,
  arbFurnitureObject,
  arbOpening,
  arbFloorPlan,
  arbAnalysis,
  arbMesh,
  arbScrollSequence,
  arbImageDimensions,
  arbPixelGrid,
  FURNITURE_LABELS,
  ELEMENT_MAP,
  BAGUA_GRID,
  brightness,
} from "./helpers.js";

describe("Smoke: vitest + fast-check infrastructure", () => {
  it("should run a trivial assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("should run a trivial fast-check property", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        expect(typeof n).toBe("number");
      }),
      { numRuns: 100 },
    );
  });
});

describe("Smoke: helpers generate valid data", () => {
  it("arbRoomModel produces valid room dimensions", () => {
    fc.assert(
      fc.property(arbRoomModel(), (room) => {
        expect(room.width).toBeGreaterThanOrEqual(3.0);
        expect(room.depth).toBeGreaterThanOrEqual(3.0);
        expect(room.height).toBeGreaterThanOrEqual(2.2);
      }),
      { numRuns: 100 },
    );
  });

  it("arbFurnitureObject produces objects with required fields", () => {
    fc.assert(
      fc.property(arbFurnitureObject(5, 5), (obj) => {
        expect(obj).toHaveProperty("label");
        expect(obj).toHaveProperty("x");
        expect(obj).toHaveProperty("z");
        expect(obj).toHaveProperty("width");
        expect(obj).toHaveProperty("depth");
        expect(obj).toHaveProperty("height");
        expect(obj).toHaveProperty("rotation");
        expect(obj).toHaveProperty("zone");
        expect(obj).toHaveProperty("sideZone");
        expect(obj).toHaveProperty("color");
        expect(obj).toHaveProperty("source");
        expect(FURNITURE_LABELS).toContain(obj.label);
      }),
      { numRuns: 100 },
    );
  });

  it("arbOpening produces openings with required fields", () => {
    fc.assert(
      fc.property(arbOpening(), (opening) => {
        expect(opening).toHaveProperty("type");
        expect(opening).toHaveProperty("wall");
        expect(opening).toHaveProperty("x");
        expect(opening).toHaveProperty("z");
        expect(opening).toHaveProperty("width");
        expect(opening).toHaveProperty("depth");
        expect(["door", "window", "entrance"]).toContain(opening.type);
      }),
      { numRuns: 100 },
    );
  });

  it("arbFloorPlan produces a plan with all required fields", () => {
    fc.assert(
      fc.property(arbFloorPlan(), (plan) => {
        expect(plan).toHaveProperty("width");
        expect(plan).toHaveProperty("depth");
        expect(plan).toHaveProperty("height");
        expect(plan).toHaveProperty("wallThickness");
        expect(plan).toHaveProperty("boundary");
        expect(plan).toHaveProperty("objects");
        expect(plan).toHaveProperty("openings");
        expect(plan).toHaveProperty("colors");
        expect(plan.boundary).toHaveLength(4);
      }),
      { numRuns: 100 },
    );
  });

  it("arbAnalysis produces analysis with all required fields", () => {
    fc.assert(
      fc.property(arbAnalysis(), (analysis) => {
        expect(analysis).toHaveProperty("summary");
        expect(analysis).toHaveProperty("roomType");
        expect(analysis).toHaveProperty("cameraView");
        expect(analysis).toHaveProperty("floorPolygon");
        expect(analysis).toHaveProperty("wallZones");
        expect(analysis).toHaveProperty("avoidZones");
        expect(analysis).toHaveProperty("lighting");
        expect(analysis).toHaveProperty("dominantSide");
        expect(analysis).toHaveProperty("horizonPercent");
      }),
      { numRuns: 100 },
    );
  });

  it("arbMesh produces arrays of triangles", () => {
    fc.assert(
      fc.property(arbMesh(1, 10), (mesh) => {
        expect(mesh.length).toBeGreaterThanOrEqual(1);
        for (const tri of mesh) {
          expect(tri.vertices).toHaveLength(3);
          expect(tri.normal).toHaveLength(3);
          expect(tri.color).toHaveLength(3);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("arbImageDimensions produces valid dimensions", () => {
    fc.assert(
      fc.property(arbImageDimensions(), (dims) => {
        expect(dims.width).toBeGreaterThanOrEqual(24);
        expect(dims.height).toBeGreaterThanOrEqual(24);
      }),
      { numRuns: 100 },
    );
  });

  it("arbPixelGrid produces grids with correct dimensions", () => {
    fc.assert(
      fc.property(arbPixelGrid(10, 10), (grid) => {
        expect(grid.pixels).toHaveLength(grid.height);
        for (const row of grid.pixels) {
          expect(row).toHaveLength(grid.width);
          for (const pixel of row) {
            expect(pixel).toHaveLength(4); // RGBA
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it("brightness helper computes correctly", () => {
    // Pure white
    expect(brightness(255, 255, 255)).toBeCloseTo(255, 1);
    // Pure black
    expect(brightness(0, 0, 0)).toBe(0);
    // Standard formula
    expect(brightness(100, 150, 200)).toBeCloseTo(
      100 * 0.299 + 150 * 0.587 + 200 * 0.114,
      5,
    );
  });

  it("ELEMENT_MAP covers all furniture labels", () => {
    const allMapped = Object.values(ELEMENT_MAP).flat();
    for (const label of FURNITURE_LABELS) {
      expect(allMapped).toContain(label);
    }
  });

  it("BAGUA_GRID is a valid 3x3 grid", () => {
    expect(BAGUA_GRID).toHaveLength(3);
    const allZones = BAGUA_GRID.flat();
    expect(allZones).toHaveLength(9);
    expect(new Set(allZones).size).toBe(9);
  });
});
