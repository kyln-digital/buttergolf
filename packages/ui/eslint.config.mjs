import { config as baseConfig } from "@buttergolf/eslint-config/react-internal";

/**
 * ESLint configuration for @buttergolf/ui
 *
 * This package is the foundational UI layer that wraps Tamagui components.
 * It NEEDS to import from tamagui directly, so we override the no-restricted-imports
 * rule that blocks tamagui imports in other packages.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  ...baseConfig,
  {
    // Override rules specifically for the UI package
    rules: {
      // Allow tamagui imports since this package IS the wrapper layer
      "no-restricted-imports": [
        "error",
        {
          paths: [
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
              message:
                "Use <Button> from @buttergolf/ui instead of raw <button>.",
            },
            {
              element: "select",
              message:
                "Use <Select> from @buttergolf/ui instead of raw <select>.",
            },
            {
              element: "textarea",
              message:
                "Use <TextArea> from @buttergolf/ui instead of raw <textarea>.",
            },
            // Note: <input> is allowed for hidden form integration (e.g., Checkbox)
          ],
        },
      ],
    },
  },
];
