"use client";

import { useId } from "react";
import { Column, Row, Text, Label, Checkbox } from "@buttergolf/ui";

interface BrandFilterProps {
  availableBrands: string[];
  selectedBrands: string[];
  onChange: (brands: string[]) => void;
}

export function BrandFilter({
  availableBrands,
  selectedBrands,
  onChange,
}: Readonly<BrandFilterProps>) {
  const idPrefix = useId();

  const handleToggle = (brand: string) => {
    if (selectedBrands.includes(brand)) {
      onChange(selectedBrands.filter((b) => b !== brand));
    } else {
      onChange([...selectedBrands, brand]);
    }
  };

  if (availableBrands.length === 0) {
    return (
      <Text size="$4" color="$textSecondary">
        No brands available
      </Text>
    );
  }

  return (
    <Column>
      {availableBrands.map((brand) => {
        const checkboxId = `${idPrefix}-${brand.replace(/\s+/g, "-")}`;
        return (
          <Row key={brand} gap="$sm" alignItems="center" minHeight={36}>
            <Checkbox
              id={checkboxId}
              checked={selectedBrands.includes(brand)}
              onChange={() => handleToggle(brand)}
              size="sm"
            />
            {/* htmlFor points at the checkbox button, so the label click toggles it natively. */}
            <Label
              htmlFor={checkboxId}
              size="$4"
              fontWeight="400"
              marginBottom={0}
              cursor="pointer"
            >
              {brand}
            </Label>
          </Row>
        );
      })}
    </Column>
  );
}
