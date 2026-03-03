"use client";

import { Column, Button, Text, SwitchWithLabel } from "@buttergolf/ui";
import { FilterSection } from "./FilterSection";
import { CategoryFilter } from "./CategoryFilter";
import { ConditionFilter } from "./ConditionFilter";
import { PriceRangeFilter } from "./PriceRangeFilter";
import { BrandFilter } from "./BrandFilter";

export interface FilterState {
  category: string | null;
  conditions: string[];
  minPrice: number;
  maxPrice: number;
  brands: string[];
  showFavouritesOnly: boolean;
}

interface FilterSidebarProps {
  readonly filters: FilterState;
  readonly availableBrands: string[];
  readonly priceRange: { readonly min: number; readonly max: number };
  readonly onChange: (filters: Partial<FilterState>) => void;
  readonly onClearAll: () => void;
}

export function FilterSidebar({
  filters,
  availableBrands,
  priceRange,
  onChange,
  onClearAll,
}: Readonly<FilterSidebarProps>) {
  return (
    <Column
      width={280}
      style={{ position: "sticky" }}
      top={140}
      minHeight={200}
      backgroundColor="$surface"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      padding="$lg"
      gap="$lg"
      display="none"
      $gtLg={{ display: "flex" }}
    >
      <Text weight="bold" size="$6">
        Filters
      </Text>

      <FilterSection title="Category">
        <CategoryFilter
          selectedCategory={filters.category}
          onChange={(category) => onChange({ category })}
        />
      </FilterSection>

      <FilterSection title="Condition">
        <ConditionFilter
          selectedConditions={filters.conditions}
          onChange={(conditions) => onChange({ conditions })}
        />
      </FilterSection>

      <FilterSection title="Price Range">
        <PriceRangeFilter
          minPrice={priceRange.min}
          maxPrice={priceRange.max}
          selectedMin={filters.minPrice}
          selectedMax={filters.maxPrice}
          onChange={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
        />
      </FilterSection>

      <FilterSection title="Brand">
        <BrandFilter
          availableBrands={availableBrands}
          selectedBrands={filters.brands}
          onChange={(brands) => onChange({ brands })}
        />
      </FilterSection>

      <FilterSection title="Favourites">
        <SwitchWithLabel
          label="Show favourites only"
          checked={filters.showFavouritesOnly}
          onCheckedChange={(checked) => onChange({ showFavouritesOnly: checked })}
          size="$3"
        />
      </FilterSection>

      <Button chromeless size="$4" onPress={onClearAll}>
        Clear All
      </Button>
    </Column>
  );
}
