"use client";

import { useEffect, useId, useMemo, useState } from "react";
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
  /** Committed filters; the sheet edits a draft copy until Apply. */
  filters: FilterState;
  availableBrands: string[];
  priceRange: { min: number; max: number };
  onApply: (next: FilterState) => void;
}

/**
 * Mobile filters edit a draft: Apply commits it to the listings, Cancel (or
 * swiping the sheet away) discards it, so nothing refetches mid-edit.
 */
export function MobileFilterSheet({
  open,
  onOpenChange,
  filters,
  availableBrands,
  priceRange,
  onApply,
}: Readonly<MobileFilterSheetProps>) {
  const headingId = useId();

  const priceBounds = useMemo(
    () => ({ min: Math.floor(priceRange.min), max: Math.ceil(priceRange.max) }),
    [priceRange.min, priceRange.max]
  );

  const [draft, setDraft] = useState<FilterState>(filters);

  // Start every session from the committed filters.
  useEffect(() => {
    if (open) {
      setDraft(filters); // eslint-disable-line react-hooks/set-state-in-effect -- reset the draft when the sheet opens
    }
  }, [open, filters]);

  const updateDraft = (patch: Partial<FilterState>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const clearDraft = () => {
    setDraft({
      category: null,
      conditions: [],
      minPrice: priceBounds.min,
      maxPrice: priceBounds.max,
      brands: [],
      showFavouritesOnly: false,
    });
  };

  const draftCount =
    (draft.category ? 1 : 0) +
    draft.conditions.length +
    draft.brands.length +
    (draft.minPrice !== priceBounds.min || draft.maxPrice !== priceBounds.max ? 1 : 0);

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

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
          {draftCount > 0 && (
            <Button butterVariant="ghost" size="$3" onPress={clearDraft}>
              Clear all
            </Button>
          )}
        </Row>

        {/* Body */}
        <SheetScrollView>
          <Column paddingHorizontal="$md" paddingBottom="$md">
            <FilterSection title="Category">
              <CategoryFilter
                selectedCategory={draft.category}
                onChange={(category) => updateDraft({ category })}
              />
            </FilterSection>

            <FilterSection title="Condition">
              <ConditionFilter
                selectedConditions={draft.conditions}
                onChange={(conditions) => updateDraft({ conditions })}
              />
            </FilterSection>

            <FilterSection title="Price">
              <PriceRangeFilter
                minPrice={priceRange.min}
                maxPrice={priceRange.max}
                selectedMin={draft.minPrice}
                selectedMax={draft.maxPrice}
                onChange={(minPrice, maxPrice) => updateDraft({ minPrice, maxPrice })}
              />
            </FilterSection>

            <FilterSection title="Brand">
              <BrandFilter
                availableBrands={availableBrands}
                selectedBrands={draft.brands}
                onChange={(brands) => updateDraft({ brands })}
              />
            </FilterSection>

            <FilterSection title="Favourites">
              <SwitchWithLabel
                label="Show favourites only"
                checked={draft.showFavouritesOnly}
                onCheckedChange={(checked) => updateDraft({ showFavouritesOnly: checked })}
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
          <Button butterVariant="primary" size="$5" flex={1} onPress={handleApply}>
            Apply filters
          </Button>
        </Row>
      </Sheet.Frame>
    </Sheet>
  );
}
