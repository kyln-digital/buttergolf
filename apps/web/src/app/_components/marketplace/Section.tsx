"use client";

import type { ReactNode } from "react";
import { Column, Heading, Text } from "@buttergolf/ui";

/** Matches the header's content width. */
export const SECTION_MAX_WIDTH = 1440;

interface SectionProps {
  readonly children: ReactNode;
  /** Accessible name for the landmark. */
  readonly label?: string;
  readonly maxWidth?: number;
}

/**
 * One vertical rhythm and one container for every marketing section on the
 * site: 48px of breathing room on mobile, 64px on desktop, and the same
 * horizontal gutters as the header.
 */
export function Section({ children, label, maxWidth = SECTION_MAX_WIDTH }: SectionProps) {
  return (
    <Column
      tag="section"
      aria-label={label}
      width="100%"
      backgroundColor="$background"
      paddingVertical="$2xl"
      $gtMd={{ paddingVertical: "$3xl" }}
    >
      <Column
        width="100%"
        maxWidth={maxWidth}
        marginHorizontal="auto"
        paddingHorizontal="$md"
        gap="$xl"
        $gtMd={{ paddingHorizontal: "$xl", gap: "$2xl" }}
      >
        {children}
      </Column>
    </Column>
  );
}

interface SectionHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
}

/** Section title + optional strapline on one type scale (32px mobile, 40px desktop). */
export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <Column gap="$sm" alignItems="center" width="100%">
      <Heading level={2} size="$8" $gtMd={{ size: "$9" }} color="$text" textAlign="center">
        {title}
      </Heading>
      {subtitle ? (
        <Text size="$5" $gtMd={{ size: "$6" }} color="$textSecondary" textAlign="center">
          {subtitle}
        </Text>
      ) : null}
    </Column>
  );
}

interface CardGridProps {
  readonly children: ReactNode;
  /** Columns at the widest breakpoint (2 → 3 → 4 → maxColumns). */
  readonly maxColumns?: 4 | 5;
}

/** Responsive product-card grid shared by the home sections and listings. */
export function CardGrid({ children, maxColumns = 4 }: CardGridProps) {
  return (
    <Column
      width="100%"
      style={{ display: "grid" }}
      gridTemplateColumns="repeat(2, 1fr)"
      gap="$md"
      $gtSm={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "$lg" }}
      $gtMd={{ gridTemplateColumns: "repeat(4, 1fr)" }}
      $gtLg={{ gridTemplateColumns: `repeat(${maxColumns}, 1fr)` }}
    >
      {children}
    </Column>
  );
}
