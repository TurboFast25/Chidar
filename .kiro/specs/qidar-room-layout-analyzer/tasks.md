# Implementation Plan: Qidar Room Layout Analyzer — Property-Based Test Suite

## Overview

This plan sets up a comprehensive property-based testing infrastructure for the existing Qidar/Chidar application and implements tests for all 25 correctness properties defined in the design document. Python backend tests use `hypothesis`; JavaScript frontend tests use `fast-check` with `vitest`. Each property test runs a minimum of 100 iterations and includes a tag comment referencing its design document property.

## Tasks

- [x] 1. Set up Python test infrastructure for backend property tests
  - [x] 1.1 Create Python test configuration and install hypothesis
    - Create `Chidar/tests/` directory with `__init__.py` and `conftest.py`
    - Add a `requirements-test.txt` (or `pyproject.toml` test section) with `hypothesis>=6.0` and `pytest>=7.0`
    - Configure hypothesis settings in `conftest.py` with `max_examples=100` default profile
    - Add shared hypothesis strategies for generating valid room analysis payloads (imageWidth, imageHeight, rowBrightness, columnEnergy, overallBrightness, brightnessGrid, calibration)
    - Verify pytest discovers and runs a trivial smoke test
    - _Requirements: 3.1–3.14_

- [x] 2. Set up JavaScript test infrastructure for frontend property tests
  - [x] 2.1 Create JavaScript test configuration with vitest and fast-check
    - Initialize `package.json` in `Chidar/` with vitest and fast-check as dev dependencies
    - Create `vitest.config.js` configured for the project (no build step, ES modules)
    - Create `Chidar/tests/` directory for JS test files
    - Create a shared test utilities module (`Chidar/tests/helpers.js`) with fast-check arbitraries for generating room models, floor plans, furniture objects, openings, and analysis data
    - Verify vitest discovers and runs a trivial smoke test
    - _Requirements: 1.1–1.4, 2.1–2.3, 5.1–5.7, 6.1–6.5, 7.1–7.7, 8.1, 9.1–9.11, 11.1–11.4_

- [x] 3. Checkpoint — Ensure test infrastructure works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Write Python backend property tests (Properties 4–10)
  - [x] 4.1 Write property test for horizon line range (Property 4)
    - **Property 4: Horizon line is within valid range**
    - Test that for any row brightness array of length H >= 10, `find_horizon_row` returns a value between `max(4, floor(H*0.28))` and `min(H-4, floor(H*0.78))`
    - Use hypothesis strategies to generate row brightness arrays of varying lengths (10–500) with values in [0, 255]
    - **Validates: Requirements 3.1**

  - [x] 4.2 Write property test for occupied zone grouping invariants (Property 5)
    - **Property 5: Occupied zone grouping invariants**
    - Test that for any column energy array, `group_occupied_columns` produces zones each spanning at least `max(2, round(W*0.03))` columns, and total zones ≤ 8
    - Generate column energy arrays of varying lengths (10–500) with non-negative float values
    - **Validates: Requirements 3.2**

  - [x] 4.3 Write property test for dominant side classification (Property 6)
    - **Property 6: Dominant side classification follows threshold rule**
    - Test that for any column energy array, if left-half average exceeds right-half by >10% → "left", right exceeds left by >10% → "right", otherwise → "center"
    - Verify against the `analyze_room` output's `dominantSide` field
    - **Validates: Requirements 3.4**

  - [x] 4.4 Write property test for lighting classification (Property 7)
    - **Property 7: Lighting classification matches brightness thresholds**
    - Test that `describe_lighting(B)` returns "bright daylight" if B >= 190, "balanced ambient light" if 145 <= B < 190, "soft interior light" if 105 <= B < 145, "dim interior light" if B < 105
    - Generate overall brightness values in [0, 255]
    - **Validates: Requirements 3.7**

  - [x] 4.5 Write property test for room type classification (Property 8)
    - **Property 8: Room type classification is deterministic**
    - Test that `describe_room_type(W, H, zones)` returns the correct room type based on aspect ratio and zone count
    - Generate image dimensions and avoid zone lists
    - **Validates: Requirements 3.8**

  - [x] 4.6 Write property test for room dimension clamping (Property 9)
    - **Property 9: Room dimension estimates are within clamped ranges**
    - Test that `estimate_room_width_meters` returns [3.2, 7.5] without calibration / [2.8, 10] with calibration
    - Test that `estimate_room_depth_meters` returns [3.5, 9] without calibration / [3, 12] with calibration
    - Test that `estimate_room_height_meters` returns 2.7 without calibration / [2.2, 4] with calibration
    - Generate floor polygons, calibration objects, and display dimensions
    - **Validates: Requirements 3.10, 3.11, 3.12**

  - [x] 4.7 Write property test for response field completeness (Property 10)
    - **Property 10: Room analysis response contains all required fields**
    - Test that `analyze_room(payload)` returns a dict with `analysis` containing all 10 required fields and `roomModel` containing all 5 required fields
    - Generate valid payloads with varying dimensions and brightness data
    - **Validates: Requirements 3.13**

- [x] 5. Checkpoint — Ensure all Python property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Extract testable functions from app.js for JavaScript property tests
  - [x] 6.1 Create a testable module exporting pure functions from app.js
    - Extract and export the following pure functions into a separate module (e.g., `Chidar/src/logic.js`): `clamp`, `findObjectAtPlanPoint`, `getObjectFootprintBounds`, `getObjectFootprintCenter`, `overlapsRect`, `resolveObjectCollisions`, `snapObjectToZone`, `buildLayoutModel`, `inferOpenings`, `buildManualDoor`, `buildManualWindow`, `objectElement`, `baguaZone`, `entryCorridor`, `buildFengShuiModel`, `cleanMesh`, `buildMeshFromFloorPlan`, `normalizeLabel`, `deriveDepthZone`, `deriveSideZone`, `isAgainstWall`, `isAgainstAnyWall`, `objCenter`, `doorPoint`, `distToPoint`
    - Update `app.js` to import these functions from the new module
    - Ensure the application still works correctly after the refactor
    - _Requirements: All frontend requirements_

- [ ] 7. Write JavaScript frontend property tests — State and Image Processing (Properties 1–3)
  - [x] 7.1 Write property test for state reset (Property 1)
    - **Property 1: State reset clears all derived data**
    - Test that after any state mutation (setting analysis, roomModel, floorPlan, fengShui, mesh to non-null values), calling the reset logic sets all derived fields to null/empty
    - Generate arbitrary state configurations
    - **Validates: Requirements 1.3, 1.4**

  - [ ] 7.2 Write property test for image downscaling (Property 2)
    - **Property 2: Image downscaling preserves aspect ratio with max dimension 160**
    - Test that for any (width, height) pair, the downscaled dimensions have max dimension = 160 (or original if smaller) and aspect ratio preserved within ±1 pixel
    - Generate image dimensions from 24×24 to 8000×8000
    - **Validates: Requirements 2.1**

  - [ ] 7.3 Write property test for brightness extraction (Property 3)
    - **Property 3: Brightness extraction correctness**
    - Test that for a pixel grid of W×H, row brightness equals the average brightness per row, overall brightness equals the mean of all pixels, and the brightness grid contains per-pixel values
    - Generate small pixel grids (up to 40×40) with RGBA values
    - **Validates: Requirements 2.2**

- [ ] 8. Write JavaScript frontend property tests — Floor Plan and Furniture (Properties 11–16)
  - [ ] 8.1 Write property test for furniture boundary containment (Property 11)
    - **Property 11: Furniture placement is always within room boundaries**
    - Test that after any placement operation (snap, collision resolve, toolbox add), furniture satisfies `x >= wallThickness`, `x + effectiveWidth <= roomWidth - wallThickness`, `z >= wallThickness`, `z + effectiveDepth <= roomDepth - wallThickness`
    - Generate room dimensions, wall thickness, and furniture objects with random positions/sizes
    - **Validates: Requirements 5.2, 5.3, 7.2, 7.4, 7.5**

  - [ ] 8.2 Write property test for collision resolution (Property 12)
    - **Property 12: Collision resolution produces non-overlapping objects**
    - Test that after `resolveObjectCollisions`, no two objects have overlapping AABBs (with 0.04m padding)
    - Generate sets of 2–8 furniture objects with random positions and dimensions
    - **Validates: Requirements 5.5**

  - [ ] 8.3 Write property test for detected object count limit (Property 13)
    - **Property 13: Floor plan limits detected objects to 8**
    - Test that the floor plan builder slices detected objects to at most 8 before fallback additions
    - Generate detection arrays of varying lengths (0–20)
    - **Validates: Requirements 5.7**

  - [ ] 8.4 Write property test for manual opening override (Property 14)
    - **Property 14: Manual openings override inferred openings by type**
    - Test that when manual doors exist, `inferOpenings` returns only manual doors (no inferred doors), and similarly for windows
    - Generate combinations of manual and inferred openings
    - **Validates: Requirements 6.3**

  - [ ] 8.5 Write property test for opening wall snapping (Property 15)
    - **Property 15: Opening placement snaps to nearest wall**
    - Test that `buildManualDoor` and `buildManualWindow` place the opening on the wall with minimum perpendicular distance from the click point
    - Generate click points across the room area and verify the assigned wall
    - **Validates: Requirements 6.2**

  - [ ] 8.6 Write property test for furniture hit detection (Property 16)
    - **Property 16: Furniture hit detection is geometrically correct**
    - Test that `findObjectAtPlanPoint` returns a hit if and only if the point, transformed into the object's local coordinate space, falls within the object's bounds
    - Generate furniture objects with various rotations and test points inside/outside
    - **Validates: Requirements 7.1**

- [ ] 9. Checkpoint — Ensure all floor plan and furniture property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Write JavaScript frontend property tests — Navigation and Feng Shui (Properties 17–21)
  - [ ] 10.1 Write property test for zoom clamping (Property 17)
    - **Property 17: Zoom is clamped between 0.6x and 4x**
    - Test that for any sequence of zoom operations (multiplying by `1 - deltaY * 0.0012`), the result is always within [0.6, 4.0]
    - Generate sequences of scroll deltaY values
    - **Validates: Requirements 8.1**

  - [ ] 10.2 Write property test for five elements counting (Property 18)
    - **Property 18: Five elements count matches element mapping**
    - Test that for any set of furniture objects, the element counts from `objectElement` match the predefined ELEMENT_MAP
    - Generate furniture sets with labels from the MAJOR_OBJECTS catalog
    - **Validates: Requirements 9.2**

  - [ ] 10.3 Write property test for bagua zone assignment (Property 19)
    - **Property 19: Bagua zone assignment follows grid division**
    - Test that `baguaZone(obj, plan)` assigns the correct zone based on object center position relative to room thirds
    - Generate objects at various positions in rooms of various dimensions
    - **Validates: Requirements 9.3**

  - [ ] 10.4 Write property test for qi flow corridor blocking (Property 20)
    - **Property 20: Qi flow corridor blocking detection**
    - Test that a furniture object is detected as blocking qi flow if and only if its bounding box overlaps the entry corridor (22% width × 55% depth from door position)
    - Generate door positions, furniture positions, and room dimensions
    - **Validates: Requirements 9.4**

  - [ ] 10.5 Write property test for feng shui score clamping (Property 21)
    - **Property 21: Feng Shui score is always within [10, 98]**
    - Test that `buildFengShuiModel` always returns a score in [10, 98] regardless of input configuration
    - Generate floor plans with varying furniture counts (0–15), room types, lighting conditions, and opening configurations
    - **Validates: Requirements 9.11**

- [ ] 11. Write JavaScript frontend property tests — Mesh and Export (Properties 22–25)
  - [ ] 11.1 Write property test for mesh cleaning (Property 22)
    - **Property 22: Mesh cleaning removes degenerate triangles**
    - Test that after `cleanMesh`, every remaining triangle has cross-product magnitude > 1e-10, and all non-degenerate input triangles are preserved
    - Generate meshes with a mix of valid and degenerate triangles
    - **Validates: Requirements 11.4**

  - [ ] 11.2 Write property test for STL binary format (Property 23)
    - **Property 23: STL export binary format correctness**
    - Test that for a mesh with N triangles, the STL binary is exactly 84 + N×50 bytes, triangle count at offset 80 matches N, and each record has 12 bytes normal + 36 bytes vertices + 2 bytes color
    - Generate meshes with 1–50 triangles
    - **Validates: Requirements 11.1**

  - [ ] 11.3 Write property test for OBJ format (Property 24)
    - **Property 24: OBJ export vertex and face count correctness**
    - Test that for a mesh with N triangles, the OBJ output has exactly N×3 vertex lines and N face lines with sequential 1-indexed triples
    - Generate meshes with 1–50 triangles
    - **Validates: Requirements 11.2**

  - [ ] 11.4 Write property test for export scale factor (Property 25)
    - **Property 25: Export scale factor is applied uniformly**
    - Test that for any mesh and scale factor S, every vertex coordinate equals the scale-1 coordinate multiplied by S
    - Generate floor plans and scale factors from 0.01 to 10
    - **Validates: Requirements 11.3**

- [ ] 12. Write integration and smoke tests
  - [ ] 12.1 Write Python integration test for the /api/model-room endpoint
    - Test that a POST to `/api/model-room` with a valid payload returns 200 with correct JSON structure
    - Test that a POST with invalid/malformed payload returns 400 with error message
    - Test the `/api/health` endpoint returns `{"ok": true}`
    - _Requirements: 3.13, 3.14, 16.1_

  - [ ] 12.2 Write JavaScript smoke tests for application constants and configuration
    - Verify all 30 furniture presets in MAJOR_OBJECTS have valid dimensions (w, h, d > 0), a 3-element color array, and a valid zone
    - Verify the five element categories in ELEMENT_MAP cover all furniture labels
    - Verify the bagua grid is a valid 3×3 mapping with 9 unique zone names
    - Verify vercel.json has maxDuration: 60 for API functions
    - _Requirements: 7.7, 9.2, 9.3, 15.1_

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each property test references its design document property number and validated requirements
- Python tests use `hypothesis` with `@settings(max_examples=100)` minimum
- JavaScript tests use `fast-check` with `fc.assert(fc.property(...), { numRuns: 100 })` minimum
- Each property test file must include the tag comment: `// Feature: qidar-room-layout-analyzer, Property {N}: {property_text}` (JS) or `# Feature: qidar-room-layout-analyzer, Property {N}: {property_text}` (Python)
- Task 6.1 (extracting pure functions) is a prerequisite for all JavaScript property tests — it makes the functions importable without a DOM environment
- Checkpoints ensure incremental validation throughout the test suite build-out
