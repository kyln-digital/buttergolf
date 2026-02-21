import { nextJsConfig } from "@buttergolf/eslint-config/next-js";

const eslintConfig = [
  ...nextJsConfig,
  {
    files: ["*.config.js", "*.config.mjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];

export default eslintConfig;
