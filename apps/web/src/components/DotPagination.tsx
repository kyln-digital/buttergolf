"use client";

import { useMemo } from "react";
import { Row, View } from "@buttergolf/ui";
import { useTheme } from "tamagui";

interface DotPaginationProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
  readonly disabled?: boolean;
}

/**
 * Dot-based pagination component
 * - Active dot is elongated pill (48px), inactive is circle (10px)
 * - Uses CSS transitions for smooth animations
 */
export function DotPagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: DotPaginationProps) {
  const theme = useTheme();
  const primaryColor = theme.primary.val;

  const visiblePages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [totalPages, currentPage]);

  return (
    <Row alignItems="center" justifyContent="center" gap="$sm" paddingVertical="$xl">
      {visiblePages.map((pg) => {
        const isActive = pg === currentPage;
        return (
          <View
            key={pg}
            role="button"
            tabIndex={0}
            onPress={() => !disabled && onPageChange(pg)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if ((e.key === "Enter" || e.key === " ") && !disabled) {
                e.preventDefault();
                onPageChange(pg);
              }
            }}
            aria-label={`Go to page ${pg}`}
            aria-current={isActive ? "page" : undefined}
            width={isActive ? 48 : 10}
            height={10}
            borderRadius={5}
            opacity={isActive ? 1 : disabled ? 0.3 : 0.5}
            cursor={disabled ? "wait" : "pointer"}
            style={{ transition: "all 0.3s ease", backgroundColor: primaryColor }}
          />
        );
      })}
    </Row>
  );
}
