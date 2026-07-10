import { defineConfig } from "vitest/config";

/**
 * Root-level Vitest configuration for the buttergolf monorepo.
 *
 * The starter test set targets pure, dependency-free domain logic
 * (validation, pricing, categories, condition mapping) so tests run fast
 * in a Node environment with no React Native / Next.js / Prisma bootstrap.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
});
