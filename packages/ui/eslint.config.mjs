import { config as baseConfig } from "@buttergolf/eslint-config/react-internal";

/**
 * ESLint configuration for @buttergolf/ui
 *
 * This package is the foundational UI layer that wraps Tamagui components.
 * It NEEDS to import from tamagui directly, so we override the no-restricted-imports
 * rule that blocks tamagui imports in other packages.
 *
 * IMPORTANT: We preserve patterns from base configs:
 * - Circular dependency prevention (don't import from ../index in components/)
 * - Cross-package restrictions (packages cannot import from apps)
 * - Tamagui config import rule (@buttergolf/config is source of truth)
 * - @prisma/client import rule (use @buttergolf/db instead)
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  ...baseConfig,
  {
    // Override rules specifically for the UI package
    rules: {
      // Allow tamagui imports since this package IS the wrapper layer
      // Preserves other restrictions from base config (Prisma, config imports)
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@buttergolf/ui/tamagui.config*"],
              message:
                "Import Tamagui config from '@buttergolf/config' instead of '@buttergolf/ui/tamagui.config'. The config source of truth lives in packages/config/src/tamagui.config.ts",
            },
          ],
          paths: [
            {
              name: "@buttergolf/ui",
              importNames: ["config"],
              message:
                "Import Tamagui config from '@buttergolf/config' instead of '@buttergolf/ui'. Use: import { config } from '@buttergolf/config'",
            },
            {
              name: "@prisma/client",
              message:
                "Import from '@buttergolf/db' instead of '@prisma/client'. Direct imports cause build failures in pnpm monorepos. Use: import { prisma, Prisma, ProductCondition } from '@buttergolf/db'",
            },
            // Keep restrictions on web-only testing libraries
            {
              name: "jsdom",
              message:
                "jsdom is web-only and contains SharedArrayBuffer which React Native doesn't support. Use React Native Testing Library instead.",
            },
            {
              name: "@testing-library/jest-dom",
              message:
                "@testing-library/jest-dom is web-only. Use @testing-library/react-native for mobile testing.",
            },
            {
              name: "happy-dom",
              message:
                "happy-dom is web-only and contains SharedArrayBuffer which React Native doesn't support. Use React Native Testing Library instead.",
            },
            {
              name: "@vitest/browser",
              message:
                "@vitest/browser is web-only. Use vitest with environment: 'node' for cross-platform testing.",
            },
          ],
        },
      ],
      // Allow raw <input> in Checkbox since it's a hidden form integration element
      "react/forbid-elements": [
        "warn",
        {
          forbid: [
            {
              element: "button",
              message: "Use <Button> from @buttergolf/ui instead of raw <button>.",
            },
            {
              element: "select",
              message: "Use <Select> from @buttergolf/ui instead of raw <select>.",
            },
            {
              element: "textarea",
              message: "Use <TextArea> from @buttergolf/ui instead of raw <textarea>.",
            },
            // Note: <input> is allowed for hidden form integration (e.g., Checkbox)
          ],
        },
      ],
    },
  },
];
