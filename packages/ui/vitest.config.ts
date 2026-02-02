import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "@buttergolf/ui",
      // Using node environment - component tests can use React Testing Library's renderHook
      // For full DOM tests, move them to apps/web
      environment: "node",
    },
    esbuild: {
      // Let esbuild handle TypeScript without resolving tsconfig extends
      tsconfigRaw: {
        compilerOptions: {
          jsx: "react-jsx",
          skipLibCheck: true,
        },
      },
    },
  })
);
