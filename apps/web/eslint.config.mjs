import { nextJsConfig } from "@buttergolf/eslint-config/next-js";
import globals from "globals";

const eslintConfig = [
  ...nextJsConfig,
  {
    files: ["*.config.js", "*.config.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];

export default eslintConfig;
