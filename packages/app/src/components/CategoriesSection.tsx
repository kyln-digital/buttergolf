"use client";

import { Row, ScrollView } from "@buttergolf/ui";
import { CategoryButton } from "./CategoryButton";
import { CATEGORIES } from "@buttergolf/constants";

export function CategoriesSection() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      paddingVertical="$4"
      paddingHorizontal="$4"
      borderBottomWidth={1}
      borderBottomColor="$border"
    >
      <Row gap="$xs">
        <CategoryButton key="all" label="All" active={true} />
        {CATEGORIES.map((category) => (
          <CategoryButton key={category.slug} label={category.name} active={false} />
        ))}
      </Row>
    </ScrollView>
  );
}
