"use client";

import { useId } from "react";
import {
  Column,
  Row,
  Heading,
  Button,
  SwitchWithLabel,
  Sheet,
  SheetScrollView,
} from "@buttergolf/ui";
import { FilterSection } from "./FilterSection";
import { CategoryFilter } from "./CategoryFilter";
import { ConditionFilter } from "./ConditionFilter";
import { PriceRangeFilter } from "./PriceRangeFilter";
import { BrandFilter } from "./BrandFilter";
import type { FilterState } from "./FilterSidebar";

interface MobileFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  availableBrands: string[];
  priceRange: { min: number; max: number };
  activeFilterCount: number;
  onChange: (filters: Partial<FilterState>) => void;
  onClearAll: () => void;
  onApply: () => void;
}

export function MobileFilterSheet({
  open,
  onOpenChange,
  filters,
  availableBrands,
  priceRange,
  activeFilterCount,
  onChange,
  onClearAll,
  onApply,
}: Readonly<MobileFilterSheetProps>) {
  const headingId = useId();

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[88]} dismissOnSnapToBottom>
      <Sheet.Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
      <Sheet.Frame
        aria-modal={true}
        aria-labelledby={headingId}
        backgroundColor="$background"
        borderTopLeftRadius="$2xl"
        borderTopRightRadius="$2xl"
      >
        <Sheet.Handle backgroundColor="$border" />

        {/* Header */}
        <Row
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$md"
          paddingVertical="$sm"
          minHeight={56}
        >
          <Heading id={headingId} level={2} size="$5">
            Filters
          </Heading>
          {activeFilterCount > 0 && (
            <Button butterVariant="ghost" size="$3" onPress={onClearAll}>
              Clear all
            </Button>
          )}
        </Row>

        {/* Body */}
        <SheetScrollView>
          <Column paddingHorizontal="$md" paddingBottom="$md">
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
        </SheetScrollView>

        {/* Footer */}
        <Row
          gap="$sm"
          paddingHorizontal="$md"
          paddingVertical="$md"
          borderTopWidth={1}
          borderTopColor="$border"
        >
          <Button butterVariant="ghost" size="$5" flex={1} onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            butterVariant="primary"
            size="$5"
            flex={1}
            onPress={() => {
              onApply();
              onOpenChange(false);
            }}
          >
            Apply filters
          </Button>
        </Row>
      </Sheet.Frame>
    </Sheet>
  );
}
