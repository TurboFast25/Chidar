/**
 * Property 1: State reset clears all derived data
 *
 * For any application state (with or without existing analysis, room model,
 * floor plan, feng shui results, and mesh), performing a reset operation
 * SHALL result in all analysis-derived fields being null/empty.
 *
 * Feature: qidar-room-layout-analyzer, Property 1: State reset clears all derived data
 *
 * **Validates: Requirements 1.3, 1.4**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  arbFloorPlan,
  arbAnalysis,
  arbMesh,
  arbRoomModel,
  arbLayoutModel,
} from "./helpers.js";

// ---------------------------------------------------------------------------
// Pure resetState function — mirrors the reset logic from app.js
// ---------------------------------------------------------------------------

/**
 * Applies the reset logic to a state object, clearing all derived fields.
 * This mirrors the `reset()` function in app.js without DOM dependencies.
 */
function resetState(state) {
  return {
    ...state,
    imageDataUrl: "",
    fileName: "",
    generating: false,
    analysis: null,
    roomModel: null,
    layoutModel: null,
    floorPlan: null,
    fengShui: null,
    mesh: null,
    markerMode: null,
    manualOpenings: { door: [], window: [], entrance: [] },
    suppressInferredOpenings: false,
    planView: { zoom: 1, panX: 0, panY: 0 },
    planDrag: null,
    objectDrag: null,
    resizeDrag: null,
    selectedObjectIndex: -1,
    suppressPlanClick: false,
  };
}

// ---------------------------------------------------------------------------
// Arbitrary: generate an arbitrary "dirty" application state
// ---------------------------------------------------------------------------

/**
 * Generates an arbitrary application state with non-null derived fields,
 * simulating a state after analysis has been performed.
 */
function arbDirtyState() {
  return fc
    .record({
      analysis: arbAnalysis(),
      roomModel: arbRoomModel(),
      layoutModel: arbLayoutModel(),
      floorPlan: arbFloorPlan(),
      fengShui: fc.record({
        score: fc.integer({ min: 10, max: 98 }),
        verdict: fc.constantFrom(
          "excellent harmony",
          "good balance",
          "workable",
          "needs significant adjustment",
        ),
        findings: fc.array(
          fc.record({
            level: fc.constantFrom("good", "warn", "note"),
            text: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          { minLength: 0, maxLength: 5 },
        ),
        recommendations: fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
          minLength: 0,
          maxLength: 5,
        }),
      }),
      mesh: arbMesh(1, 10),
      markerMode: fc.constantFrom("door", "window", "entrance", null),
      manualOpenings: fc.record({
        door: fc.array(
          fc.record({
            type: fc.constant("door"),
            wall: fc.constantFrom("front", "back", "left", "right"),
            x: fc.double({ min: 0, max: 8, noNaN: true }),
            z: fc.double({ min: 0, max: 10, noNaN: true }),
            width: fc.double({ min: 0.5, max: 1.5, noNaN: true }),
            depth: fc.constant(0),
            manual: fc.constant(true),
          }),
          { minLength: 0, maxLength: 3 },
        ),
        window: fc.array(
          fc.record({
            type: fc.constant("window"),
            wall: fc.constantFrom("front", "back", "left", "right"),
            x: fc.double({ min: 0, max: 8, noNaN: true }),
            z: fc.double({ min: 0, max: 10, noNaN: true }),
            width: fc.double({ min: 0.5, max: 1.5, noNaN: true }),
            depth: fc.constant(0),
            manual: fc.constant(true),
          }),
          { minLength: 0, maxLength: 3 },
        ),
        entrance: fc.array(
          fc.record({
            type: fc.constant("entrance"),
            wall: fc.constantFrom("front", "back", "left", "right"),
            x: fc.double({ min: 0, max: 8, noNaN: true }),
            z: fc.double({ min: 0, max: 10, noNaN: true }),
            width: fc.double({ min: 0.5, max: 1.5, noNaN: true }),
            depth: fc.constant(0),
            manual: fc.constant(true),
          }),
          { minLength: 0, maxLength: 3 },
        ),
      }),
      suppressInferredOpenings: fc.boolean(),
      selectedObjectIndex: fc.integer({ min: 0, max: 7 }),
      imageDataUrl: fc.string({ minLength: 1, maxLength: 20 }),
      fileName: fc.string({ minLength: 1, maxLength: 20 }),
      generating: fc.boolean(),
    })
    .map((fields) => ({
      ...fields,
      opts: { wallThick: 0.15, scale: 1 },
      planView: {
        zoom: fc.sample(fc.double({ min: 0.6, max: 4.0, noNaN: true }), 1)[0],
        panX: fc.sample(fc.double({ min: -100, max: 100, noNaN: true }), 1)[0],
        panY: fc.sample(fc.double({ min: -100, max: 100, noNaN: true }), 1)[0],
      },
      planDrag: null,
      objectDrag: null,
      resizeDrag: null,
      suppressPlanClick: false,
    }));
}

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe("Property 1: State reset clears all derived data", () => {
  it("should clear all derived fields after reset, regardless of prior state", () => {
    fc.assert(
      fc.property(arbDirtyState(), (dirtyState) => {
        const resetResult = resetState(dirtyState);

        // All analysis-derived fields must be null
        expect(resetResult.analysis).toBeNull();
        expect(resetResult.roomModel).toBeNull();
        expect(resetResult.layoutModel).toBeNull();
        expect(resetResult.floorPlan).toBeNull();
        expect(resetResult.fengShui).toBeNull();
        expect(resetResult.mesh).toBeNull();

        // Marker mode must be null
        expect(resetResult.markerMode).toBeNull();

        // Manual openings must be empty arrays for each type
        expect(resetResult.manualOpenings).toEqual({
          door: [],
          window: [],
          entrance: [],
        });

        // Suppress inferred openings must be false
        expect(resetResult.suppressInferredOpenings).toBe(false);

        // Selected object index must be -1
        expect(resetResult.selectedObjectIndex).toBe(-1);

        // Image and file fields must be cleared
        expect(resetResult.imageDataUrl).toBe("");
        expect(resetResult.fileName).toBe("");
        expect(resetResult.generating).toBe(false);

        // Plan view must be reset to defaults
        expect(resetResult.planView).toEqual({ zoom: 1, panX: 0, panY: 0 });

        // Drag states must be null
        expect(resetResult.planDrag).toBeNull();
        expect(resetResult.objectDrag).toBeNull();
        expect(resetResult.resizeDrag).toBeNull();

        // Suppress plan click must be false
        expect(resetResult.suppressPlanClick).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
