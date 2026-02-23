"use client";

import { Slider as TamaguiSlider, styled, GetProps } from "tamagui";

/**
 * Slider Component
 *
 * A range slider built on @tamagui/slider for selecting numeric values.
 * Uses compound component pattern (Slider.Track, Slider.TrackActive, Slider.Thumb).
 *
 * IMPORTANT: Do NOT use the `circular` prop on Slider.Thumb - our styled component
 * already handles the circular appearance with proper sizing and brand colours.
 *
 * @example
 * // Single value slider
 * <Slider defaultValue={[50]} max={100} step={1}>
 *   <Slider.Track>
 *     <Slider.TrackActive />
 *   </Slider.Track>
 *   <Slider.Thumb index={0} />
 * </Slider>
 *
 * @example
 * // Range slider (two thumbs)
 * <Slider defaultValue={[25, 75]} max={100} step={1}>
 *   <Slider.Track>
 *     <Slider.TrackActive />
 *   </Slider.Track>
 *   <Slider.Thumb index={0} />
 *   <Slider.Thumb index={1} />
 * </Slider>
 */

// Styled Slider root with brand colours
const SliderFrame = styled(TamaguiSlider, {
  name: "Slider",
  width: "100%",
});

// Styled Track with proper overflow handling
const SliderTrack = styled(TamaguiSlider.Track, {
  name: "SliderTrack",
  backgroundColor: "$cloudMist",
  height: 4,
  borderRadius: "$full",
  overflow: "hidden",
});

// Styled TrackActive with primary colour
const SliderTrackActive = styled(TamaguiSlider.TrackActive, {
  name: "SliderTrackActive",
  backgroundColor: "$primary",
  height: "100%",
  borderRadius: "$full",
});

// Styled Thumb with consistent brand colours - compact, clean design
// NOTE: Do NOT use `circular` prop - it overrides our explicit sizing
const SliderThumb = styled(TamaguiSlider.Thumb, {
  name: "SliderThumb",

  // Explicit sizing - must use !important pattern via size: undefined to prevent Tamagui size inheritance
  size: undefined,
  width: 20,
  height: 20,
  minWidth: 20,
  minHeight: 20,
  maxWidth: 20,
  maxHeight: 20,

  // Circular shape
  borderRadius: 10,

  // Primary colour - consistent across all states
  backgroundColor: "$primary",

  // White border for clean separation from track
  borderWidth: 2,
  borderColor: "$pureWhite",

  // Subtle shadow for depth and visibility
  shadowColor: "rgba(0,0,0,0.2)",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 1,
  shadowRadius: 3,
  elevation: 3,

  cursor: "grab",

  // Hover - slight grow, deeper shadow
  hoverStyle: {
    width: 22,
    height: 22,
    minWidth: 22,
    minHeight: 22,
    maxWidth: 22,
    maxHeight: 22,
    borderRadius: 11,
    shadowColor: "rgba(0,0,0,0.25)",
    shadowRadius: 4,
  },

  // Press/active - grabbing cursor
  pressStyle: {
    cursor: "grabbing",
    width: 22,
    height: 22,
    minWidth: 22,
    minHeight: 22,
    maxWidth: 22,
    maxHeight: 22,
    borderRadius: 11,
    shadowColor: "rgba(0,0,0,0.3)",
    shadowRadius: 5,
  },

  // Focus - primary glow ring effect
  focusStyle: {
    width: 22,
    height: 22,
    minWidth: 22,
    minHeight: 22,
    maxWidth: 22,
    maxHeight: 22,
    borderRadius: 11,
    borderColor: "$primary",
    borderWidth: 3,
    shadowColor: "rgba(244,83,20,0.4)",
    shadowRadius: 6,
  },
});

// Main Slider component as compound component
// Cast through unknown to restore the base TamaguiSlider prop types (value, defaultValue, etc.)
// that styled() loses in this Tamagui version.
export const Slider = SliderFrame as unknown as typeof TamaguiSlider & {
  Track: typeof SliderTrack;
  TrackActive: typeof SliderTrackActive;
  Thumb: typeof SliderThumb;
};

Slider.Track = SliderTrack;
Slider.TrackActive = SliderTrackActive;
Slider.Thumb = SliderThumb;

// Export types
export type SliderProps = GetProps<typeof Slider>;
export type SliderTrackProps = GetProps<typeof SliderTrack>;
export type SliderTrackActiveProps = GetProps<typeof SliderTrackActive>;
export type SliderThumbProps = GetProps<typeof SliderThumb>;

/**
 * RangeSlider - Convenience wrapper for dual-thumb range selection
 *
 * @example
 * <RangeSlider
 *   min={0}
 *   max={500}
 *   value={[100, 400]}
 *   onValueChange={([min, max]) => console.log(min, max)}
 * />
 */
export interface RangeSliderProps {
  min?: number;
  max?: number;
  step?: number;
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  disabled?: boolean;
}

export function RangeSlider({
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
}: RangeSliderProps) {
  return (
    <Slider
      min={min}
      max={max}
      step={step}
      value={value}
      defaultValue={defaultValue ?? [min, max]}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <Slider.Track>
        <Slider.TrackActive />
      </Slider.Track>
      <Slider.Thumb index={0} />
      <Slider.Thumb index={1} />
    </Slider>
  );
}
