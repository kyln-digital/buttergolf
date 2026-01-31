/**
 * Type augmentation for @testing-library/jest-dom matchers with Vitest v4
 *
 * KNOWN ISSUE: Vitest v4 re-exports `Assertion` from `@vitest/expect`, but
 * @testing-library/jest-dom augments the `vitest` module's `Assertion` interface.
 * Since the re-exported type comes from a different module, the augmentation
 * doesn't apply automatically.
 *
 * WORKAROUND: We extend `@vitest/expect`'s Assertion interface directly with
 * the TestingLibraryMatchers.
 *
 * @see https://github.com/testing-library/jest-dom/issues/546
 * @see https://github.com/vitest-dev/vitest/discussions/8063
 */
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "@vitest/expect" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = unknown> extends TestingLibraryMatchers<
    typeof expect.stringContaining,
    T
  > {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
