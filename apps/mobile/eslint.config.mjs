import { config as reactInternalConfig } from "@buttergolf/eslint-config/react-internal";

const eslintConfig = [
  ...reactInternalConfig,
  {
    files: ["*.config.js", "*.config.mjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off", // Config files run in Node.js
      "turbo/no-undeclared-env-vars": "off",
    },
  },
  {
    // Expo-specific overrides
    rules: {
      // Mobile-specific: Block web-only APIs and libraries
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "jsdom",
              message:
                "CRITICAL: jsdom contains SharedArrayBuffer which crashes React Native/Hermes. Use @testing-library/react-native instead.",
            },
            {
              name: "@testing-library/jest-dom",
              message:
                "CRITICAL: @testing-library/jest-dom is web-only. Use @testing-library/react-native for mobile.",
            },
            {
              name: "happy-dom",
              message:
                "CRITICAL: happy-dom contains SharedArrayBuffer which crashes React Native/Hermes.",
            },
            {
              name: "vitest",
              message:
                "Mobile app should not import vitest directly. Tests belong in packages/ui or packages/app.",
            },
            {
              name: "expo-secure-store",
              message:
                "CRITICAL: Direct SecureStore imports cause TurboModule race conditions. Import from './lib/secureStore' or './lib/apiClient' instead. See lib/secureStore.ts for details.",
            },
          ],
        },
      ],
    },
  },
  {
    // Allow expo-secure-store ONLY in the centralized wrapper module
    files: ["lib/secureStore.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
