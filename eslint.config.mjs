import { config as baseConfig } from "@buttergolf/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.expo/**",
      "**/.tamagui/**",
      "**/generated/**",
      "**/coverage/**",
    ],
  },
];
