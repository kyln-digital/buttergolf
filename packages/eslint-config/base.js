import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";

// ========================================================================
// SHARED IMPORT RESTRICTIONS - Exported for composition in other configs.
// Each config that redefines no-restricted-imports must include these
// because ESLint flat config replaces (not merges) same-named rules.
// ========================================================================
export const baseImportPatterns = [
  {
    group: ["@buttergolf/ui/tamagui.config*"],
    message:
      "Import Tamagui config from '@buttergolf/config' instead of '@buttergolf/ui/tamagui.config'. The config source of truth lives in packages/config/src/tamagui.config.ts",
  },
];

export const baseImportPaths = [
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
];

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    rules: {
      // ========================================================================
      // UNUSED VARIABLES - Allow underscore-prefixed variables as intentionally unused
      // ========================================================================
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // ========================================================================
      // IMPORT RESTRICTIONS - Enforce correct import paths in monorepo
      // ========================================================================
      "no-restricted-imports": [
        "error",
        {
          patterns: baseImportPatterns,
          paths: baseImportPaths,
        },
      ],
      // ========================================================================
      // CONSOLE STATEMENTS - Prevent debug logs in production code
      // Allow console.error and console.warn for legitimate error handling
      // ========================================================================
      "no-console": [
        "warn",
        {
          allow: ["warn", "error", "info"],
        },
      ],
      // ========================================================================
      // BRITISH SPELLING ENFORCEMENT
      // Use British spellings in identifiers. Note: CSS properties (color, center)
      // and JavaScript APIs (behavior in scrollIntoView) cannot be changed.
      // ========================================================================
      "no-restricted-syntax": [
        "warn",
        {
          // Flag 'favorite' in identifiers (variables, functions, properties)
          selector: "Identifier[name=/favorite/i]",
          message: "Use British spelling 'favourite' instead of 'favorite'.",
        },
        {
          // Flag 'favorites' in identifiers
          selector: "Identifier[name=/favorites/i]",
          message: "Use British spelling 'favourites' instead of 'favorites'.",
        },
      ],
    },
  },
  {
    ignores: ["dist/**"],
  },
  // ========================================================================
  // CIRCULAR DEPENDENCY PREVENTION FOR UI COMPONENTS
  // Components in packages/ui/src/components should import siblings directly,
  // not through the barrel index, to avoid circular dependencies.
  // NOTE: Must include baseImportPatterns/Paths because no-restricted-imports
  // is replaced (not merged) in ESLint flat config.
  // ========================================================================
  {
    files: ["**/packages/ui/src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...baseImportPatterns,
            {
              group: ["../index", "../index.ts", "../index.tsx"],
              message:
                "Do not import from the barrel index inside components/ to avoid circular dependencies. Use direct sibling imports instead, e.g.: import { Button } from './Button'",
            },
          ],
          paths: baseImportPaths,
        },
      ],
    },
  },
  // ========================================================================
  // CROSS-PACKAGE IMPORT RESTRICTIONS
  // Enforce proper dependency direction in the monorepo:
  // - packages/* cannot import from apps/*
  // - packages/app can import from packages/ui but not vice versa
  // NOTE: Must include baseImportPatterns/Paths because no-restricted-imports
  // is replaced (not merged) in ESLint flat config.
  // ========================================================================
  {
    files: ["**/packages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...baseImportPatterns,
            {
              group: ["**/apps/web/**", "**/apps/mobile/**"],
              message:
                "Packages cannot import from apps. Move shared code to a package (e.g., @buttergolf/app or @buttergolf/ui).",
            },
          ],
          paths: baseImportPaths,
        },
      ],
    },
  },
  // ========================================================================
  // PRISMA SINGLETON ENFORCEMENT
  // Only packages/db should create PrismaClient instances.
  // All other code must import the singleton from @buttergolf/db.
  // ========================================================================
  {
    files: [
      "**/apps/**/*.{ts,tsx}",
      "**/packages/app/**/*.{ts,tsx}",
      "**/packages/ui/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='PrismaClient']",
          message:
            "Do not create new PrismaClient instances. Import the singleton from '@buttergolf/db': import { prisma } from '@buttergolf/db'",
        },
      ],
    },
  },
];
