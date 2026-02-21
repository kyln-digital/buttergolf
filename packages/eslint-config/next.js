import js from "@eslint/js";
import { globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReact from "eslint-plugin-react";
import globals from "globals";
import pluginNext from "@next/eslint-plugin-next";
import { config as baseConfig } from "./base.js";
import { reactImportPatterns, reactImportPaths } from "./react-internal.js";

/**
 * A custom ESLint configuration for Next.js apps.
 * Includes base rules, React-specific rules, and Next.js plugin rules.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const nextJsConfig = [
  ...baseConfig,
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".tamagui/**"]),
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    plugins: {
      "@next/next": pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      "react/react-in-jsx-scope": "off",
      // Prevent fontSize prop - use size="$token" instead
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
      // Prevent raw HTML form elements - use Tamagui components from @buttergolf/ui
      "react/forbid-elements": [
        "warn",
        {
          forbid: [
            {
              element: "button",
              message: "Use <Button> from @buttergolf/ui instead of raw <button>.",
            },
            {
              element: "input",
              message: "Use <Input> from @buttergolf/ui instead of raw <input>.",
            },
            {
              element: "select",
              message: "Use <Select> from @buttergolf/ui instead of raw <select>.",
            },
            {
              element: "textarea",
              message: "Use <TextArea> from @buttergolf/ui instead of raw <textarea>.",
            },
          ],
        },
      ],
      // Merged import restrictions: base + React-specific
      "no-restricted-imports": [
        "error",
        {
          patterns: reactImportPatterns,
          paths: reactImportPaths,
        },
      ],
    },
  },
];
