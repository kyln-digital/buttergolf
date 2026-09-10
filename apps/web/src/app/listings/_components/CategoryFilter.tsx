"use client";

import { useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RadioGroup, Radio, RadioIndicator, Label, Row } from "@buttergolf/ui";
import { CATEGORIES } from "@buttergolf/constants";

interface CategoryFilterProps {
  selectedCategory: string | null;
  onChange: (category: string | null) => void;
  /**
   * Navigate to the clean category URL as soon as a radio is chosen (desktop
   * sidebar). The mobile sheet passes false so the choice stays in its draft
   * until Apply.
   */
  navigateOnChange?: boolean;
}

const OPTIONS = [
  { slug: "all", name: "All categories" },
  ...CATEGORIES.map((category) => ({ slug: category.slug, name: category.name })),
];

export function CategoryFilter({
  selectedCategory,
  onChange,
  navigateOnChange = true,
}: Readonly<CategoryFilterProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idPrefix = useId();

  // Build URL preserving other filters when navigating to category
  const buildCategoryUrl = (slug: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("category"); // Clean URLs don't carry the category param
    params.delete("page"); // Reset to page 1
    const queryString = params.toString();
    const base = slug === null ? "/listings" : `/category/${slug}`;
    return queryString ? `${base}?${queryString}` : base;
  };

  const handleCategoryChange = (value: string) => {
    const slug = value === "all" ? null : value;
    if (navigateOnChange) {
      router.push(buildCategoryUrl(slug));
    }
    onChange(slug);
  };

  const selectedValue = selectedCategory ?? "all";

  return (
    <RadioGroup
      value={selectedValue}
      onValueChange={handleCategoryChange}
      gap={0}
      aria-label="Category"
    >
      {OPTIONS.map((option) => {
        const isSelected = selectedValue === option.slug;
        const radioId = `${idPrefix}-${option.slug}`;
        return (
          <Row key={option.slug} alignItems="center" gap="$sm" minHeight={36}>
            <Radio id={radioId} value={option.slug} size="sm">
              <RadioIndicator />
            </Radio>
            {/* htmlFor points at the radio's id, so the label click selects it. */}
            <Label
              htmlFor={radioId}
              size="$4"
              marginBottom={0}
              cursor="pointer"
              color="$text"
              fontWeight={isSelected ? "600" : "400"}
            >
              {option.name}
            </Label>
          </Row>
        );
      })}
    </RadioGroup>
  );
}
