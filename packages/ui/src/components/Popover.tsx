/**
 * Popover Component
 *
 * A comprehensive popover component for context menus, tooltips, and quick actions.
 * Built on @tamagui/popover with support for:
 * - 12 placement positions
 * - Optional arrow pointing to trigger
 * - Adaptive behavior (converts to Sheet on mobile)
 * - ScrollView support for long content
 * - Controlled and uncontrolled modes
 *
 * @see https://tamagui.dev/ui/popover
 *
 * @example Basic usage:
 * ```tsx
 * <Popover>
 *   <PopoverTrigger asChild>
 *     <Button>Open Popover</Button>
 *   </PopoverTrigger>
 *   <PopoverContent>
 *     <Column padding="$4" gap="$2">
 *       <Text>Popover content here</Text>
 *       <PopoverClose asChild>
 *         <Button size="$3">Close</Button>
 *       </PopoverClose>
 *     </Column>
 *   </PopoverContent>
 * </Popover>
 * ```
 *
 * @example With arrow and placement:
 * ```tsx
 * <Popover placement="bottom-start">
 *   <PopoverTrigger asChild>
 *     <Button>Open</Button>
 *   </PopoverTrigger>
 *   <PopoverContent>
 *     <PopoverArrow />
 *     <Column padding="$4">
 *       <Text>Content with arrow</Text>
 *     </Column>
 *   </PopoverContent>
 * </Popover>
 * ```
 *
 * @example Adaptive (Sheet on mobile):
 * ```tsx
 * <Popover>
 *   <PopoverTrigger asChild>
 *     <Button>Open</Button>
 *   </PopoverTrigger>
 *
 *   <PopoverAdapt when="sm">
 *     <PopoverSheet modal snapPoints={[50]}>
 *       <PopoverSheetOverlay />
 *       <PopoverSheetFrame>
 *         <PopoverSheetScrollView>
 *           <AdaptContents />
 *         </PopoverSheetScrollView>
 *       </PopoverSheetFrame>
 *     </PopoverSheet>
 *   </PopoverAdapt>
 *
 *   <PopoverContent>
 *     <Column padding="$4">
 *       <Text>This becomes a sheet on mobile!</Text>
 *     </Column>
 *   </PopoverContent>
 * </Popover>
 * ```
 *
 * @example Controlled mode:
 * ```tsx
 * const [open, setOpen] = useState(false)
 *
 * <Popover open={open} onOpenChange={setOpen}>
 *   <PopoverTrigger asChild>
 *     <Button>Toggle</Button>
 *   </PopoverTrigger>
 *   <PopoverContent>
 *     <Text>Controlled popover</Text>
 *   </PopoverContent>
 * </Popover>
 * ```
 */

import { Adapt } from "tamagui";

// Re-export Popover and its components from @tamagui/popover
export { Popover, type PopoverProps } from "@tamagui/popover";

// Individual component exports for granular imports
export {
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverArrow,
  PopoverClose,
} from "@tamagui/popover";

// Sheet-related exports for Adaptive popovers
// These are accessed via Popover.Sheet.* but we export them for convenience
export { Sheet as PopoverSheet } from "@tamagui/sheet";
export type { SheetProps as PopoverSheetProps } from "@tamagui/sheet";

// Re-export Adapt for adaptive popover behavior
export { Adapt as PopoverAdapt } from "tamagui";

// Convenience alias for Adapt.Contents (used inside Sheet.ScrollView)
export const AdaptContents = Adapt.Contents;

// Sheet sub-component aliases for popover sheets
export {
  Overlay as PopoverSheetOverlay,
  Frame as PopoverSheetFrame,
  Handle as PopoverSheetHandle,
  SheetScrollView as PopoverSheetScrollView,
} from "@tamagui/sheet";
