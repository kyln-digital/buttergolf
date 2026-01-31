"use client";

import { Button } from "@buttergolf/ui";

export interface CategoryButtonProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function CategoryButton({ label, active = false, onPress }: Readonly<CategoryButtonProps>) {
  return (
    <Button
      size="$3"
      paddingHorizontal="$4"
      borderRadius="$10"
      backgroundColor={active ? "$primary" : "$backgroundPress"}
      borderColor={active ? "$primary" : "$border"}
      color={active ? "$textInverse" : "$text"}
      fontWeight={active ? "600" : "400"}
      hoverStyle={{
        backgroundColor: active ? "$primaryHover" : "$backgroundHover",
        borderColor: active ? "$primaryHover" : "$borderHover",
      }}
      pressStyle={{
        scale: 0.97,
        backgroundColor: active ? "$primaryPress" : "$backgroundPress",
      }}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}
