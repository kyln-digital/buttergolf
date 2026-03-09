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
  // This is a legitimate use of setState in effect - syncing local state with prop changes
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
    <Column gap="$md" width="100%">
      <Slider
        min={normalisedMinPrice}
        max={normalisedMaxPrice}
        step={10}
        value={[localMin, localMax]}
        onValueChange={handleSliderChange}
        width="100%"
      >
        <Slider.Track>
          <Slider.TrackActive />
        </Slider.Track>
        <Slider.Thumb index={0} />
        <Slider.Thumb index={1} />
      </Slider>
      <Row gap="$sm" alignItems="center" width="100%">
        <Column gap="$xs" flex={1} minWidth={0}>
          <Text size="$2" color="$textSecondary">
            Min
          </Text>
          <Input
            size="$3"
            type="number"
            step={1}
            value={localMin.toString()}
            onChange={(e) => handleMinInputChange(e.target.value)}
            placeholder="Min"
            width="100%"
          />
        </Column>
        <Text color="$textSecondary" paddingTop="$lg" flexShrink={0}>
          −
        </Text>
        <Column gap="$xs" flex={1} minWidth={0}>
          <Text size="$2" color="$textSecondary">
            Max
          </Text>
          <Input
            size="$3"
            type="number"
            step={1}
            value={localMax.toString()}
            onChange={(e) => handleMaxInputChange(e.target.value)}
            placeholder="Max"
            width="100%"
          />
        </Column>
      </Row>
      <Text size="$2" color="$textSecondary">
        ${localMin.toLocaleString("en-GB")} - ${localMax.toLocaleString("en-GB")}
      </Text>
    </Column>
  );
}
