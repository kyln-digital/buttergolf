import { config as baseConfig } from "@buttergolf/eslint-config/react-internal";
import { baseImportPatterns, baseImportPaths } from "@buttergolf/eslint-config/base";

/**
 * ESLint configuration for @buttergolf/ui
 *
 * This package is the foundational UI layer that wraps Tamagui components.
 * It NEEDS to import from tamagui directly, so we override the no-restricted-imports
 * rule to remove the tamagui ban while preserving all other restrictions.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  ...baseConfig,
  {
    rules: {
      // Allow tamagui imports since this package IS the wrapper layer.
      // Uses shared constants to preserve base restrictions (Prisma, config)
      // plus jsdom/happy-dom bans, but omits the direct tamagui ban.
      "no-restricted-imports": [
        "error",
        {
          patterns: baseImportPatterns,
          paths: [
            ...baseImportPaths,
            {
              name: "jsdom",
              message:
                "jsdom is web-only and contains SharedArrayBuffer which React Native doesn't support.",
            },
            {
              name: "happy-dom",
              message:
                "happy-dom is web-only and contains SharedArrayBuffer which React Native doesn't support.",
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
