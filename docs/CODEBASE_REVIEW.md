# ButterGolf — Full Codebase Review

**Date:** 9 June 2026
**Scope:** Entire monorepo — `apps/web`, `apps/mobile`, `packages/*`, database schema, tooling, CI/CD
**Method:** Static review of all major code paths (payments, auth/security, web quality, mobile + shared packages, data model + infra), grounded by running the repo's own quality gates.

---

## 1. Executive summary

_(to be completed after all review passes)_

---

## 2. Baseline validation (what actually runs today)

| Check                     | Result                | Notes                                                                                                                                                                                                                                                       |
| ------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`            | ✅ Pass               | Clean install, Prisma client generated via postinstall                                                                                                                                                                                                      |
| `pnpm typecheck`          | ❌ **Fail**           | `web#check-types` fails: `packages/assets/src/icons.ts` — TS2307 `Cannot find module '../icons/golfball.svg'` (×4). The `svg.d.ts` ambient declaration exists at `packages/assets/types/svg.d.ts` but is not included by the web `tsconfig`. Mobile passes. |
| `pnpm lint`               | ✅ Pass (12 warnings) | Raw `<img>` in `HeroRedesign.tsx` (×4), unescaped entities, `APP_URL` undeclared in `turbo.json`, missing `jsx-a11y` rule definition. Note: both lint scripts run `eslint --fix` — a "lint" that mutates source.                                            |
| `pnpm format:check`       | ❌ **Fail**           | Prettier flags `packages/db/generated/client/*.d.ts` — generated Prisma output is not in `.prettierignore`, so `pnpm check` (the repo's REQUIRED validation command) fails on generated code.                                                               |
| `pnpm build --filter=web` | _(running)_           |                                                                                                                                                                                                                                                             |
| Secret scan               | ✅ Clean              | No live keys committed; only `sk_test_...` placeholders in docs. No `.env` files tracked.                                                                                                                                                                   |

**Headline:** the repo's own mandated quality gate (`pnpm check`) **fails at HEAD** — and since there are **no tests and no CI**, nothing would have caught it.

---

## 3. Findings

_(to be completed)_

---

## 4. Prioritised action list

_(to be completed)_
