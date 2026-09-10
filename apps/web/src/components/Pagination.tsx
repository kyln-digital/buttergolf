"use client";

import { ChevronLeft, ChevronRight } from "@tamagui/lucide-icons";
import { Button, Row, Text } from "@buttergolf/ui";

interface PaginationProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
  readonly disabled?: boolean;
}

type PageItem = number | "gap";

/**
 * First, last, and a window around the current page. Near either edge the
 * window widens to the first / last four pages so the list never reads
 * "1 2 … 4"; a run of exactly one missing page is shown as the page itself
 * rather than an ellipsis.
 */
function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set<number>([1, total]);
  const from = current <= 3 ? 2 : current >= total - 2 ? total - 4 : current - 1;
  const to = current <= 3 ? 5 : current >= total - 2 ? total - 1 : current + 1;
  for (let page = from; page <= to; page++) wanted.add(page);
  const pages = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const items: PageItem[] = [];
  let previous = 0;
  for (const page of pages) {
    if (page - previous === 2) items.push(previous + 1);
    else if (page - previous > 2) items.push("gap");
    items.push(page);
    previous = page;
  }
  return items;
}

/**
 * Numbered pagination built from the Button family: ghost pages, a tonal
 * current page, and previous / next arrows.
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const items = getPageItems(currentPage, totalPages);

  return (
    <Row
      tag="nav"
      aria-label="Pagination"
      alignItems="center"
      justifyContent="center"
      flexWrap="wrap"
      gap="$xs"
      paddingVertical="$lg"
    >
      <Button
        butterVariant="ghost"
        size="$4"
        circular
        aria-label="Previous page"
        disabled={disabled || currentPage <= 1}
        onPress={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft size={18} color="$text" />
      </Button>

      {items.map((item, index) =>
        item === "gap" ? (
          <Text
            key={`gap-${index}`}
            size="$4"
            color="$textSecondary"
            paddingHorizontal="$xs"
            aria-hidden
          >
            …
          </Text>
        ) : (
          <Button
            key={item}
            butterVariant={item === currentPage ? "secondary" : "ghost"}
            size="$4"
            circular
            aria-label={`Page ${item}`}
            aria-current={item === currentPage ? "page" : undefined}
            disabled={disabled}
            onPress={() => onPageChange(item)}
          >
            {String(item)}
          </Button>
        )
      )}

      <Button
        butterVariant="ghost"
        size="$4"
        circular
        aria-label="Next page"
        disabled={disabled || currentPage >= totalPages}
        onPress={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight size={18} color="$text" />
      </Button>
    </Row>
  );
}
