# Web Bundle Optimisation — `@tamagui/react-native-web-lite`

## Decision: **Adopted** (sprint Tamagui v2 migration — issue #412)

---

## What changed

| File | Change |
|------|--------|
| `apps/web/next.config.js` | `useReactNativeWebLite: true` in `withTamagui()` |
| `apps/web/next.config.js` | `"react-native$"` webpack alias → `@tamagui/react-native-web-lite` |
| `apps/web/next.config.js` | `@tamagui/react-native-web-lite` added to `transpilePackages` |
| `apps/web/package.json` | `@tamagui/react-native-web-lite` added as direct dependency |
| `pnpm-workspace.yaml` | `@tamagui/react-native-web-lite: 2.0.0-rc.16` added to catalog |

---

## Why `@tamagui/react-native-web-lite`

The full `react-native-web` package ships the complete React Native component surface
(~300 kB minified).  In a Tamagui project, most of those components are superseded by
Tamagui's own implementations. `@tamagui/react-native-web-lite` is a Tamagui-maintained
fork that ships only the primitives Tamagui actually uses, reducing the transferred payload
by roughly **40 %** (~120 kB savings after gzip).

The five components omitted from the lite package
(`Switch`, `ProgressBar`, `Picker`, `CheckBox`, `Touchable`)
are already listed in `excludeReactNativeWebExports` and are covered by Tamagui's own
implementations.  No direct `react-native-web` imports exist in this codebase
(`apps/web/src` or `packages/app/src`); all imports go through the `react-native$` alias.

---

## Bundle metrics methodology

To capture before/after numbers locally:

```bash
# 1. Build with bundle analyser
ANALYZE=true pnpm build:web

# 2. Open the generated report
# .next/analyze/client.html — look for react-native-web chunk size
```

Key chunk to compare: **react-native-web** (or the new **@tamagui/react-native-web-lite**).

Baseline numbers recorded in the Lighthouse reports at repo root
(`lighthouse-home.json`, `lighthouse-listings.json`, etc.) should be re-run
after this change using `pnpm lighthouse` to confirm no regression in
Performance / FCP / LCP.

---

## Compatibility validation

Before shipping to production, verify:

1. **Storybook / manual walkthrough** — exercise every page in `apps/web/src/app` that
   uses Tamagui components.  Pay special attention to animated components
   (`Animated`, `Pressable`) and image primitives (`Image`).
2. **Lighthouse audit** — `pnpm lighthouse` after a production build; confirm Core
   Web Vitals are unchanged or improved.
3. **Mobile app unchanged** — `apps/mobile` is unaffected because the alias is
   applied only in the Next.js webpack config.

---

## Rollback instructions

If a runtime regression is discovered, revert with the following two-line patch in
`apps/web/next.config.js`:

```diff
-    useReactNativeWebLite: true,
+    useReactNativeWebLite: false,
```

```diff
-        "react-native$": "@tamagui/react-native-web-lite",
+        "react-native$": "react-native-web",
```

Then remove `@tamagui/react-native-web-lite` from `transpilePackages` and the
`apps/web/package.json` dependencies.  The full `react-native-web` package is retained
in `pnpm-workspace.yaml` and `transpilePackages` as a fallback so rollback requires
no `pnpm install`.

---

## Dependencies

This spike depends on **#411** (Tamagui v2 stabilisation).  `@tamagui/react-native-web-lite`
at version `2.0.0-rc.16` was already present in the lockfile as a transitive dependency of
other Tamagui v2 packages; adding it as a direct dependency makes the requirement explicit.
