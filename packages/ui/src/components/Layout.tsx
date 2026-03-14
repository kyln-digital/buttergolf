/**
 * Layout Components
 *
 * Semantic layout components - thin wrappers over Tamagui primitives with better naming.
 * Use Row for horizontal layouts (XStack), Column for vertical layouts (YStack).
 *
 * These are intentionally minimal shims that preserve all Tamagui primitive behavior
 * while providing more semantic naming for application code.
 *
 * @example
 * ```tsx
 * <Column gap="$lg">
 *   <Row gap="$md" alignItems="center" justifyContent="space-between">
 *     <Text>Left content</Text>
 *     <Button>Right action</Button>
 *   </Row>
 * </Column>
 * ```
 */

import type { ReactNode, ForwardRefExoticComponent } from "react";
import {
  styled,
  GetProps,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
  View as TamaguiView,
} from "tamagui";

// Export raw primitives for advanced usage
export { XStack, YStack, View } from "tamagui";
export type { XStackProps, YStackProps, ViewProps } from "tamagui";

/**
 * Tamagui v2's styled() incorrectly infers `children` as a theme-token union instead of
 * ReactNode.  This helper restores the correct children type while preserving every other
 * property on the component (staticConfig, styleable, display name, etc.).
 *
 * TODO: remove this workaround once the upstream type regression is fixed in Tamagui v2 stable.
 * Track: https://github.com/tamagui/tamagui/issues (search "children token union type")
 */
type WithReactChildren<C> =
  C extends ForwardRefExoticComponent<infer P>
    ? ForwardRefExoticComponent<Omit<P, "children"> & { children?: ReactNode }> &
        Omit<C, keyof ForwardRefExoticComponent<unknown>>
    : C;

function withReactChildren<C>(component: C): WithReactChildren<C> {
  return component as WithReactChildren<C>;
}

// Row - Semantic name for horizontal layout (XStack)
// Minimal shim - preserves all XStack behavior and props
const _Row = styled(TamaguiXStack, {
  name: "Row",
});

// Column - Semantic name for vertical layout (YStack)
// Minimal shim - preserves all YStack behavior and props
const _Column = styled(TamaguiYStack, {
  name: "Column",
});

// Container - Max-width wrapper for content
// Useful utility for constraining content width
const _Container = styled(TamaguiYStack, {
  name: "Container",

  width: "100%",
  marginHorizontal: "auto",

  variants: {
    size: {
      sm: { maxWidth: 640 },
      md: { maxWidth: 768 },
      lg: { maxWidth: 1024 },
      xl: { maxWidth: 1280 },
      "2xl": { maxWidth: 1536 },
      full: { maxWidth: "100%" },
    },
  } as const,

  defaultVariants: {
    size: "lg",
  },
});

// Spacer - Flexible space component
// Use with flex prop: <Spacer flex={1} />
const _Spacer = styled(TamaguiView, {
  name: "Spacer",
  flex: 1,
});

export const Row = withReactChildren(_Row);
export const Column = withReactChildren(_Column);
export const Container = withReactChildren(_Container);
export const Spacer = withReactChildren(_Spacer);

export type RowProps = GetProps<typeof _Row> & { children?: ReactNode };
export type ColumnProps = GetProps<typeof _Column> & { children?: ReactNode };
export type ContainerProps = GetProps<typeof _Container> & { children?: ReactNode };
export type SpacerProps = GetProps<typeof _Spacer> & { children?: ReactNode };
