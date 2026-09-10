"use client";

import { Column, Row, Text, Checkbox } from "@buttergolf/ui";

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
      {availableBrands.map((brand) => (
        <Row key={brand} gap="$sm" alignItems="center" minHeight={36}>
          <Checkbox
            checked={selectedBrands.includes(brand)}
            onChange={() => handleToggle(brand)}
            size="sm"
          />
          <Text size="$4" cursor="pointer" onPress={() => handleToggle(brand)}>
            {brand}
          </Text>
        </Row>
      ))}
    </Column>
  );
}
