import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only pick up JS test files (*.test.js / *.spec.js) to avoid Python tests
    include: ["tests/js/**/*.test.js", "tests/js/**/*.spec.js"],
    // ES modules — no transformation needed
    environment: "node",
    // Minimum 100 runs for property tests is enforced per-test via fc.assert options
    testTimeout: 30_000,
  },
});
