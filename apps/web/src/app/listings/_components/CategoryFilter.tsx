"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { RadioGroup, Radio, RadioIndicator, Label, Row } from "@buttergolf/ui";
import { CATEGORIES } from "@buttergolf/db";

interface CategoryFilterProps {
  selectedCategory: string | null;
  onChange: (category: string | null) => void;
}

export function CategoryFilter({ selectedCategory, onChange }: Readonly<CategoryFilterProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Build URL preserving other filters when navigating to category
  const buildCategoryUrl = (slug: string | null) => {
    if (slug === null) {
      // "All Categories" → go to /listings with current filters (except category)
      const params = new URLSearchParams(searchParams.toString());
      params.delete("category");
      const queryString = params.toString();
      return queryString ? `/listings?${queryString}` : "/listings";
    }

    // Navigate to clean category URL with filters preserved
    const params = new URLSearchParams(searchParams.toString());
    params.delete("category"); // Clean URLs don't need category param
    params.delete("page"); // Reset to page 1
    const queryString = params.toString();
    return queryString ? `/category/${slug}?${queryString}` : `/category/${slug}`;
  };

  const handleCategoryChange = (value: string) => {
    const slug = value === "all" ? null : value;
    // Navigate to the appropriate URL
    router.push(buildCategoryUrl(slug));
    // Also call onChange for local state (used by parent components)
    onChange(slug);
  };

  return (
    <RadioGroup value={selectedCategory ?? "all"} onValueChange={handleCategoryChange} gap="$xs">
      <Row alignItems="center" gap="$sm" paddingVertical="$xs">
        <Radio value="all" size="$3">
          <RadioIndicator />
        </Radio>
        <Label
          htmlFor="all"
          size="$3"
          cursor="pointer"
          color={selectedCategory === null ? "$primary" : "$text"}
          fontWeight={selectedCategory === null ? "600" : "400"}
        >
          All Categories
        </Label>
      </Row>
      {CATEGORIES.map((category) => (
        <Row key={category.slug} alignItems="center" gap="$sm" paddingVertical="$xs">
          <Radio value={category.slug} size="$3">
            <RadioIndicator />
          </Radio>
          <Label
            htmlFor={category.slug}
            size="$3"
            cursor="pointer"
            color={selectedCategory === category.slug ? "$primary" : "$text"}
            fontWeight={selectedCategory === category.slug ? "600" : "400"}
          >
            {category.name}
          </Label>
        </Row>
      ))}
    </RadioGroup>
  );
}
