import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["src/cli/**/*.test.ts", "src/lib/**/*.test.ts", "src/server/vercel/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "convex",
          // convex-test runs functions in an environment close to the Convex runtime
          environment: "edge-runtime",
          include: ["src/server/convex/**/*.test.ts"],
          server: { deps: { inline: ["convex-test"] } },
        },
      },
    ],
  },
});
