import {
  config as reactInternalConfig,
  reactImportPatterns,
  reactImportPaths,
} from "@buttergolf/eslint-config/react-internal";

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
    // Expo-specific overrides — merged with base + React restrictions
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: reactImportPatterns,
          paths: [
            ...reactImportPaths,
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
