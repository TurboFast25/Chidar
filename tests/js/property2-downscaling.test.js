/**
 * Property 2: Image downscaling preserves aspect ratio with max dimension 160
 *
 * For any image with natural dimensions (width, height), the downscaled output
 * SHALL have its maximum dimension equal to 160 pixels (or the original if
 * smaller) and the aspect ratio (width/height) SHALL be preserved within ±1
 * pixel of rounding.
 *
 * Feature: qidar-room-layout-analyzer, Property 2: Image downscaling preserves aspect ratio with max dimension 160
 *
 * **Validates: Requirements 2.1**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { arbImageDimensions } from "./helpers.js";

// ---------------------------------------------------------------------------
// Pure downscaling dimension calculation — mirrors extractImagePayload logic
// in app.js without Canvas/DOM dependencies.
// ---------------------------------------------------------------------------

/**
 * Computes the downscaled dimensions for a given (width, height) pair.
 * Reproduces the exact formula from extractImagePayload() in app.js:
 *   scale = Math.min(1, 160 / Math.max(iw, ih))
 *   w = Math.max(24, Math.round(iw * scale))
 *   h = Math.max(24, Math.round(ih * scale))
 */
function computeDownscaledDimensions(iw, ih) {
  const scale = Math.min(1, 160 / Math.max(iw, ih));
  const w = Math.max(24, Math.round(iw * scale));
  const h = Math.max(24, Math.round(ih * scale));
  return { w, h };
}

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe("Property 2: Image downscaling preserves aspect ratio with max dimension 160", () => {
  it("downscaled max dimension is 160 or original if smaller, and aspect ratio is preserved within ±1 pixel", () => {
    fc.assert(
      fc.property(arbImageDimensions(24, 8000), ({ width, height }) => {
        const { w, h } = computeDownscaledDimensions(width, height);

        // Both dimensions must be at least 24 (the Math.max(24, ...) floor)
        expect(w).toBeGreaterThanOrEqual(24);
        expect(h).toBeGreaterThanOrEqual(24);

        const maxOriginal = Math.max(width, height);

        if (maxOriginal <= 160) {
          // No downscaling needed — dimensions should stay the same
          expect(w).toBe(width);
          expect(h).toBe(height);
        } else {
          // Max dimension of the downscaled image should be exactly 160
          // (unless the min-24 clamp kicks in for the other dimension)
          const maxDownscaled = Math.max(w, h);
          // The max dimension should be 160, unless the 24-pixel floor
          // on the smaller dimension forces the larger one to also be
          // clamped (only possible for extreme aspect ratios).
          const scale = 160 / maxOriginal;
          const expectedSmaller = Math.round(Math.min(width, height) * scale);
          if (expectedSmaller >= 24) {
            // Normal case: max dimension is exactly 160
            expect(maxDownscaled).toBe(160);
          } else {
            // Extreme aspect ratio: the smaller dimension was floored to 24,
            // so the larger dimension is Math.round(largerDim * scale) which
            // should still be <= 160
            expect(maxDownscaled).toBeLessThanOrEqual(160);
          }
        }

        // Aspect ratio preservation: each downscaled dimension should be
        // within ±1 pixel of the ideal scaled value (rounding tolerance).
        {
          const s = Math.min(1, 160 / Math.max(width, height));
          const idealW = width * s;
          const idealH = height * s;
          const rawW = Math.round(idealW);
          const rawH = Math.round(idealH);
          // When neither dimension is floored to 24, both should be within
          // ±1 pixel of the ideal continuous value.
          if (rawW >= 24 && rawH >= 24) {
            expect(Math.abs(w - idealW)).toBeLessThanOrEqual(1);
            expect(Math.abs(h - idealH)).toBeLessThanOrEqual(1);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
