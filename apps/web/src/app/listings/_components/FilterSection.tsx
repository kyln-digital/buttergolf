"use client";

import { useId, useState } from "react";
import { ChevronDown } from "@tamagui/lucide-icons";
import { Column, Row, Text, View } from "@buttergolf/ui";

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

/** Collapsible filter group: a real button header with a rotating chevron. */
export function FilterSection({
  title,
  children,
  defaultExpanded = true,
}: Readonly<FilterSectionProps>) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const panelId = useId();

  return (
    <Column width="100%" paddingVertical="$sm" borderTopWidth={1} borderTopColor="$border">
      <Row
        tag="button"
        {...{ type: "button" }}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        alignItems="center"
        justifyContent="space-between"
        width="100%"
        minHeight={40}
        paddingHorizontal={0}
        backgroundColor="transparent"
        borderWidth={0}
        borderRadius="$sm"
        cursor="pointer"
        focusable
        focusVisibleStyle={{
          outlineColor: "$primary",
          outlineStyle: "solid",
          outlineWidth: 2,
          outlineOffset: 2,
        }}
        onPress={() => setIsExpanded((value) => !value)}
      >
        <Text size="$4" fontWeight="600" color="$text">
          {title}
        </Text>
        <View animation="quick" rotate={isExpanded ? "180deg" : "0deg"}>
          <ChevronDown size={16} color="$textSecondary" />
        </View>
      </Row>
      {/* Kept mounted so aria-controls always resolves; hidden when collapsed */}
      <Column id={panelId} paddingBottom="$sm" display={isExpanded ? "flex" : "none"}>
        {children}
      </Column>
    </Column>
  );
}
