"use client";

import { useId } from "react";
import {
  Column,
  Row,
  Text,
  Button,
  SwitchWithLabel,
  Sheet,
  Handle,
  Overlay,
  Frame,
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
  onChange,
  onClearAll,
  onApply,
}: Readonly<MobileFilterSheetProps>) {
  const headingId = useId();

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[85]} dismissOnSnapToBottom>
      <Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
      <Frame
        aria-modal={true}
        aria-labelledby={headingId}
        backgroundColor="$surface"
        borderTopLeftRadius="$2xl"
        borderTopRightRadius="$2xl"
      >
        <Handle backgroundColor="$fieldBorder" />

        {/* Header */}
        <Column
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderBottomWidth={1}
          borderBottomColor="$fieldBorder"
        >
          <Row alignItems="center" justifyContent="space-between">
            <Text id={headingId} weight="bold" size="$6">
              Filters
            </Text>
            <Text color="$primary" size="$3" cursor="pointer" onPress={onClearAll}>
              Clear All
            </Text>
          </Row>
        </Column>

        {/* Body */}
        <SheetScrollView>
          <Column padding="$4" gap="$lg">
            <FilterSection title="Category" defaultExpanded>
              <CategoryFilter
                selectedCategory={filters.category}
                onChange={(category) => onChange({ category })}
              />
            </FilterSection>

            <FilterSection title="Condition" defaultExpanded>
              <ConditionFilter
                selectedConditions={filters.conditions}
                onChange={(conditions) => onChange({ conditions })}
              />
            </FilterSection>

            <FilterSection title="Price Range" defaultExpanded>
              <PriceRangeFilter
                minPrice={priceRange.min}
                maxPrice={priceRange.max}
                selectedMin={filters.minPrice}
                selectedMax={filters.maxPrice}
                onChange={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
              />
            </FilterSection>

            <FilterSection title="Brand" defaultExpanded>
              <BrandFilter
                availableBrands={availableBrands}
                selectedBrands={filters.brands}
                onChange={(brands) => onChange({ brands })}
              />
            </FilterSection>

            <FilterSection title="Favourites" defaultExpanded>
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
        <Column
          paddingHorizontal="$4"
          paddingVertical="$4"
          borderTopWidth={1}
          borderTopColor="$fieldBorder"
        >
          <Row gap="$md">
            <Button size="$4" flex={1} chromeless onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              butterVariant="primary"
              size="$4"
              flex={1}
              onPress={() => {
                onApply();
                onOpenChange(false);
              }}
            >
              Apply Filters
            </Button>
          </Row>
        </Column>
      </Frame>
    </Sheet>
  );
}
