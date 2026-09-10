"use client";

import { Column, Row, Text, Slider, Input } from "@buttergolf/ui";
import { useState, useEffect, useCallback } from "react";

interface PriceRangeFilterProps {
  minPrice: number;
  maxPrice: number;
  selectedMin: number;
  selectedMax: number;
  onChange: (min: number, max: number) => void;
}

export function PriceRangeFilter({
  minPrice,
  maxPrice,
  selectedMin,
  selectedMax,
  onChange,
}: Readonly<PriceRangeFilterProps>) {
  // Keep displayed and submitted values as whole numbers.
  const normalisedMinPrice = Math.floor(minPrice);
  const normalisedMaxPrice = Math.ceil(maxPrice);

  const normaliseRange = useCallback(
    (nextMinRaw: number, nextMaxRaw: number): [number, number] => {
      const boundedMin = Math.max(
        normalisedMinPrice,
        Math.min(Math.round(nextMinRaw), normalisedMaxPrice)
      );
      const boundedMax = Math.max(
        normalisedMinPrice,
        Math.min(Math.round(nextMaxRaw), normalisedMaxPrice)
      );

      return [Math.min(boundedMin, boundedMax), Math.max(boundedMin, boundedMax)];
    },
    [normalisedMinPrice, normalisedMaxPrice]
  );

  const [initialMin, initialMax] = normaliseRange(selectedMin, selectedMax);
  const [localMin, setLocalMin] = useState(initialMin);
  const [localMax, setLocalMax] = useState(initialMax);
  // What the text fields show while being edited. They may hold "" or a
  // partial number; the committed values above are only updated when the
  // text parses, and the text snaps back to the committed value on blur.
  const [minText, setMinText] = useState(String(initialMin));
  const [maxText, setMaxText] = useState(String(initialMax));

  // Sync with props when they change (e.g., filter reset)
  useEffect(() => {
    const [nextMin, nextMax] = normaliseRange(selectedMin, selectedMax);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalMin(nextMin);
    setLocalMax(nextMax);
    setMinText(String(nextMin));
    setMaxText(String(nextMax));
  }, [selectedMin, selectedMax, normaliseRange]);

  const commit = (nextMinRaw: number, nextMaxRaw: number) => {
    const [nextMin, nextMax] = normaliseRange(nextMinRaw, nextMaxRaw);
    setLocalMin(nextMin);
    setLocalMax(nextMax);
    onChange(nextMin, nextMax);
    return [nextMin, nextMax] as const;
  };

  const handleSliderChange = (values: number[]) => {
    const [nextMin, nextMax] = commit(values[0], values[1]);
    setMinText(String(nextMin));
    setMaxText(String(nextMax));
  };

  const parse = (value: string): number | null => {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // While typing, a value is only committed when it needs no rounding or
  // clamping, so the field never shows something other than the applied
  // filter. Anything else (a partial number, a min above the max, an
  // out-of-range value) commits on blur, where the fields snap to the result.
  const handleMinInputChange = (value: string) => {
    setMinText(value);
    const parsed = parse(value);
    if (
      parsed !== null &&
      Number.isInteger(parsed) &&
      parsed >= normalisedMinPrice &&
      parsed <= localMax
    ) {
      commit(parsed, localMax);
    }
  };

  const handleMaxInputChange = (value: string) => {
    setMaxText(value);
    const parsed = parse(value);
    if (
      parsed !== null &&
      Number.isInteger(parsed) &&
      parsed >= localMin &&
      parsed <= normalisedMaxPrice
    ) {
      commit(localMin, parsed);
    }
  };

  // On blur an empty or invalid field falls back to the catalogue bound and
  // both fields snap to the committed, clamped values.
  const handleMinBlur = () => {
    const [nextMin, nextMax] = commit(parse(minText) ?? normalisedMinPrice, localMax);
    setMinText(String(nextMin));
    setMaxText(String(nextMax));
  };

  const handleMaxBlur = () => {
    const [nextMin, nextMax] = commit(localMin, parse(maxText) ?? normalisedMaxPrice);
    setMinText(String(nextMin));
    setMaxText(String(nextMax));
  };

  return (
    <Column gap="$md" width="100%" paddingTop="$sm">
      <Slider
        min={normalisedMinPrice}
        max={normalisedMaxPrice}
        step={10}
        value={[localMin, localMax]}
        onValueChange={handleSliderChange}
        width="100%"
        aria-label="Price range"
      >
        <Slider.Track>
          <Slider.TrackActive />
        </Slider.Track>
        <Slider.Thumb index={0} aria-label="Minimum price" />
        <Slider.Thumb index={1} aria-label="Maximum price" />
      </Slider>
      <Row gap="$sm" alignItems="flex-end" width="100%">
        <Column gap="$xs" flex={1} minWidth={0}>
          <Text size="$2" color="$textSecondary">
            Min (£)
          </Text>
          <Input
            size="sm"
            type="number"
            inputMode="numeric"
            step={1}
            value={minText}
            onChange={(e) => handleMinInputChange(e.target.value)}
            onBlur={handleMinBlur}
            aria-label="Minimum price in pounds"
            width="100%"
          />
        </Column>
        <Text color="$textSecondary" paddingBottom="$sm" flexShrink={0}>
          –
        </Text>
        <Column gap="$xs" flex={1} minWidth={0}>
          <Text size="$2" color="$textSecondary">
            Max (£)
          </Text>
          <Input
            size="sm"
            type="number"
            inputMode="numeric"
            step={1}
            value={maxText}
            onChange={(e) => handleMaxInputChange(e.target.value)}
            onBlur={handleMaxBlur}
            aria-label="Maximum price in pounds"
            width="100%"
          />
        </Column>
      </Row>
    </Column>
  );
}
