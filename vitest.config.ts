import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["contracts/**", "dist/**", "node_modules/**"],
  },
});
