import { defineConfig } from "vitest/config";

// Database integration tests: migrations + RPCs against a real Postgres.
// Run with `npm run test:db` (needs TEST_DATABASE_URL, see supabase/tests/README.md).
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/db/**/*.test.ts"],
    globalSetup: ["supabase/tests/db/global-setup.ts"],
    // Every test clones the template database; run files one at a time to keep that simple.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
