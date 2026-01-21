/**
 * Butter Golf UI Component Library
 *
 * A production-ready, cross-platform component library built on Tamagui.
 * Provides consistent, accessible, and themeable components for web and mobile.
 */

// Re-export all Tamagui primitives
export * from "tamagui";

// Button Components
export { Button } from "./components/Button";
export type { ButtonProps } from "./components/Button";
export { BuySellToggle } from "./components/BuySellToggle";
export type {
  BuySellToggleProps,
  BuySellMode,
} from "./components/BuySellToggle";

// Typography Components
export { Text, Heading, Label } from "./components/Text";
export type { TextProps, HeadingProps, LabelProps } from "./components/Text";

// Layout Components (semantic components with variants)
export {
  Row,
  Column,
  Container,
  Spacer,
  XStack,
  YStack,
  View,
} from "./components/Layout";
export type {
  RowProps,
  ColumnProps,
  ContainerProps,
  SpacerProps,
  XStackProps,
  YStackProps,
  ViewProps,
} from "./components/Layout";

// Brand Background Components
export {
  VanillaCreamBackground,
  LemonHazeBackground,
  LemonHazeCard,
  VanillaCreamCard,
} from "./components/BrandBackgrounds";
export type {
  VanillaCreamBackgroundProps,
  LemonHazeBackgroundProps,
  LemonHazeCardProps,
  VanillaCreamCardProps,
} from "./components/BrandBackgrounds";

// Card Components
export { Card, CardHeader, CardBody, CardFooter } from "./components/Card";
export type {
  CardProps,
  CardHeaderProps,
  CardBodyProps,
  CardFooterProps,
} from "./components/Card";
export {
  GlassmorphismCard,
  getGlassmorphismStyles,
} from "./components/GlassmorphismCard";
export type { GlassmorphismCardProps } from "./components/GlassmorphismCard";

// Form Components
export { Input } from "./components/Input";
export type { InputProps } from "./components/Input";
export { Select } from "./components/Select";
export type { SelectProps } from "./components/Select";
export { TextArea } from "./components/TextArea";
export type { TextAreaProps } from "./components/TextArea";
export { Radio, RadioGroup, RadioIndicator } from "./components/Radio";
export type { RadioProps, RadioGroupProps } from "./components/Radio";
export { Autocomplete } from "./components/Autocomplete";
export type {
  AutocompleteProps,
  AutocompleteSuggestion,
} from "./components/Autocomplete";
export { Checkbox } from "./components/Checkbox";
export type { CheckboxProps } from "./components/Checkbox";
export { Slider, RangeSlider } from "./components/Slider";
export type {
  SliderProps,
  SliderTrackProps,
  SliderTrackActiveProps,
  SliderThumbProps,
  RangeSliderProps,
} from "./components/Slider";
export { Switch, SwitchWithLabel } from "./components/Switch";
export type {
  SwitchProps,
  SwitchThumbProps,
  SwitchWithLabelProps,
} from "./components/Switch";

// Feedback Components
export { Badge } from "./components/Badge";
export type { BadgeProps } from "./components/Badge";
export { Spinner } from "./components/Spinner";
export type { SpinnerProps } from "./components/Spinner";

// Navigation Components
export { CategorySelector } from "./components/CategorySelector";
export type {
  CategorySelectorProps_Type,
  Category,
} from "./components/CategorySelector";

// Media Components
export { Image } from "./components/Image";
export type { ImageProps } from "./components/Image";
export { ScrollView } from "./components/ScrollView";
export type { ScrollViewProps } from "./components/ScrollView";

// Error Handling
export { ErrorBoundary, useErrorBoundary } from "./components/ErrorBoundary";
export type {
  ErrorBoundaryProps,
  ErrorBoundaryState,
} from "./components/ErrorBoundary";

// Sheet Components
export {
  Sheet,
  Handle as SheetHandle,
  Overlay as SheetOverlay,
  Frame as SheetFrame,
  SheetScrollView,
} from "./components/Sheet";
export type { SheetProps } from "./components/Sheet";

// Popover Components
export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverArrow,
  PopoverClose,
  PopoverAdapt,
  PopoverSheet,
  PopoverSheetOverlay,
  PopoverSheetFrame,
  PopoverSheetHandle,
  PopoverSheetScrollView,
  AdaptContents,
} from "./components/Popover";
export type { PopoverProps, PopoverSheetProps } from "./components/Popover";

// Theme Components
export { ThemeSwitcher, ThemeToggleButton } from "./components/ThemeSwitcher";
export type {
  ThemeSwitcherProps,
  ThemeToggleButtonProps,
} from "./components/ThemeSwitcher";
