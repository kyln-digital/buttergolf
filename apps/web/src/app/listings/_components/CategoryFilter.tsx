"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { RadioGroup, Radio, RadioIndicator, Label, Row } from "@buttergolf/ui";
import { CATEGORIES } from "@buttergolf/constants";

interface CategoryFilterProps {
  selectedCategory: string | null;
  onChange: (category: string | null) => void;
}

const OPTIONS = [
  { slug: "all", name: "All categories" },
  ...CATEGORIES.map((category) => ({ slug: category.slug, name: category.name })),
];

export function CategoryFilter({ selectedCategory, onChange }: Readonly<CategoryFilterProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
    router.push(buildCategoryUrl(slug));
    onChange(slug);
  };

  const selectedValue = selectedCategory ?? "all";

  return (
    <RadioGroup value={selectedValue} onValueChange={handleCategoryChange} gap={0}>
      {OPTIONS.map((option) => {
        const isSelected = selectedValue === option.slug;
        return (
          <Row key={option.slug} alignItems="center" gap="$sm" minHeight={36}>
            <Radio value={option.slug} size="$3">
              <RadioIndicator />
            </Radio>
            <Label
              htmlFor={option.slug}
              size="$4"
              marginBottom={0}
              cursor="pointer"
              onPress={() => handleCategoryChange(option.slug)}
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
