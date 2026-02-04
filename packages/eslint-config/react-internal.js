import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReact from "eslint-plugin-react";
import globals from "globals";
import { config as baseConfig } from "./base.js";

/**
 * A custom ESLint configuration for libraries that use React.
 *
 * @type {import("eslint").Linter.Config[]} */
export const config = [
  ...baseConfig,
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
      // deprecation: Not compatible with ESLint 9 yet
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      "react/react-in-jsx-scope": "off",
      // Prevent fontSize prop on Text components - use size="$token" instead
      // Using fontSize bypasses Tamagui's variant system and causes lineHeight issues on React Native
      "react/forbid-component-props": [
        "error",
        {
          forbid: [
            {
              propName: "fontSize",
              allowedFor: [],
              message:
                'Use size="$token" instead of fontSize prop on Text components. fontSize bypasses the Tamagui variant system and causes invisible text on React Native (lineHeight becomes 1.5px instead of proper pixel values).',
            },
          ],
        },
      ],
      // Prevent raw HTML elements - use Tamagui components from @buttergolf/ui
      // Start as warnings to allow gradual migration, can be promoted to errors later
      "react/forbid-elements": [
        "warn",
        {
          forbid: [
            {
              element: "button",
              message:
                "Use <Button> from @buttergolf/ui instead of raw <button>. Tamagui Button provides consistent styling, accessibility, and cross-platform support.",
            },
            {
              element: "input",
              message:
                "Use <Input> from @buttergolf/ui instead of raw <input>. Tamagui Input provides size variants, semantic tokens, and consistent form styling.",
            },
            {
              element: "select",
              message:
                "Use <Select> from @buttergolf/ui instead of raw <select>. Tamagui Select provides size variants and matches Input styling.",
            },
            {
              element: "textarea",
              message:
                "Use <TextArea> from @buttergolf/ui instead of raw <textarea>. Tamagui TextArea provides auto-resize, size variants, and consistent styling.",
            },
          ],
        },
      ],
      // Prevent direct tamagui imports - use @buttergolf/ui instead
      // This ensures consistent component behavior and custom variants
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "tamagui",
              importNames: [
                "Spinner",
                "Button",
                "Input",
                "Text",
                "Heading",
                "Card",
                "Image",
                "ScrollView",
                "View",
                "XStack",
                "YStack",
              ],
              message:
                "Import UI components from '@buttergolf/ui' instead of 'tamagui' directly. Our UI package provides custom variants and consistent theming.",
            },
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
    },
  },
];
