"use client";

import { Column, Row, Button, Heading, SwitchWithLabel } from "@buttergolf/ui";
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
  readonly activeFilterCount: number;
  readonly onChange: (filters: Partial<FilterState>) => void;
  readonly onClearAll: () => void;
}

/** Sticky offset: header bar + category bar. */
const STICKY_TOP = 136;

export function FilterSidebar({
  filters,
  availableBrands,
  priceRange,
  activeFilterCount,
  onChange,
  onClearAll,
}: Readonly<FilterSidebarProps>) {
  return (
    <Column
      tag="aside"
      aria-label="Filters"
      width={260}
      flexShrink={0}
      style={{ position: "sticky" }}
      top={STICKY_TOP}
      display="none"
      $gtLg={{ display: "flex" }}
    >
      <Row alignItems="center" justifyContent="space-between" minHeight={40} paddingBottom="$sm">
        <Heading level={2} size="$5">
          Filters
        </Heading>
        {activeFilterCount > 0 && (
          <Button butterVariant="ghost" size="$3" onPress={onClearAll}>
            Clear all
          </Button>
        )}
      </Row>

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

      <FilterSection title="Price">
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
    </Column>
  );
}
