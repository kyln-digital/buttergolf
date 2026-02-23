import { config as baseConfig } from "@buttergolf/eslint-config/base";

export default [
  ...baseConfig,
  {
    ignores: ["generated/**"],
  },
];
