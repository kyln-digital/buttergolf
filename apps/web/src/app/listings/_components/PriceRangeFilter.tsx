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

  // Sync with props when they change (e.g., filter reset)
  useEffect(() => {
    const [nextMin, nextMax] = normaliseRange(selectedMin, selectedMax);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalMin(nextMin);
    setLocalMax(nextMax);
  }, [selectedMin, selectedMax, normaliseRange]);

  const handleSliderChange = (values: number[]) => {
    const [nextMin, nextMax] = normaliseRange(values[0], values[1]);
    setLocalMin(nextMin);
    setLocalMax(nextMax);
    onChange(nextMin, nextMax);
  };

  const handleMinInputChange = (value: string) => {
    const parsed = Number(value);
    const inputMin = Number.isFinite(parsed) ? parsed : normalisedMinPrice;
    const [nextMin, nextMax] = normaliseRange(inputMin, localMax);
    setLocalMin(nextMin);
    setLocalMax(nextMax);
    onChange(nextMin, nextMax);
  };

  const handleMaxInputChange = (value: string) => {
    const parsed = Number(value);
    const inputMax = Number.isFinite(parsed) ? parsed : normalisedMaxPrice;
    const [nextMin, nextMax] = normaliseRange(localMin, inputMax);
    setLocalMin(nextMin);
    setLocalMax(nextMax);
    onChange(nextMin, nextMax);
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
            value={localMin.toString()}
            onChange={(e) => handleMinInputChange(e.target.value)}
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
            value={localMax.toString()}
            onChange={(e) => handleMaxInputChange(e.target.value)}
            aria-label="Maximum price in pounds"
            width="100%"
          />
        </Column>
      </Row>
    </Column>
  );
}
