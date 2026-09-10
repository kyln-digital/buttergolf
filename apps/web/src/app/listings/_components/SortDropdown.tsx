"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { TamaguiElement } from "tamagui";
import { Check, ChevronDown } from "@tamagui/lucide-icons";
import {
  AdaptContents,
  Button,
  Column,
  Popover,
  PopoverAdapt,
  PopoverSheet,
  PopoverSheetFrame,
  PopoverSheetHandle,
  PopoverSheetOverlay,
} from "@buttergolf/ui";

export interface SortOption {
  value: string;
  label: string;
}

interface SortDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options?: SortOption[];
}

const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "popular", label: "Most popular" },
];

const MENU_ITEM_SELECTOR = '[role="menuitemradio"]';

/**
 * Sort control: a tonal button that opens a menu of radio items (a bottom
 * sheet on touch screens). Built on Popover rather than Select so the option
 * list is never laid out off-screen. Follows the ARIA menu pattern: the
 * current option takes focus on open, arrows move between items, Home/End
 * jump, Enter/Space choose, Escape closes.
 */
export function SortDropdown({
  value,
  onChange,
  options = DEFAULT_SORT_OPTIONS,
}: Readonly<SortDropdownProps>) {
  const [open, setOpen] = useState(false);
  // Tamagui refs resolve to the DOM node on web; narrow at the point of use.
  const menuRef = useRef<TamaguiElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const getItems = (): HTMLElement[] => {
    const menu = menuRef.current as HTMLElement | null;
    return Array.from(menu?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []);
  };

  // Move focus into the menu when it opens, landing on the current choice.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const items = getItems();
      const current = items.find((item) => item.getAttribute("aria-checked") === "true");
      (current ?? items[0])?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const items = getItems();
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    switch (event.key) {
      case "ArrowDown":
        next = index < 0 ? 0 : (index + 1) % items.length;
        break;
      case "ArrowUp":
        next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" allowFlip>
      <Popover.Trigger asChild>
        <Button
          butterVariant="secondary"
          size="$4"
          iconAfter={ChevronDown}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {`Sort: ${selected?.label ?? "Newest first"}`}
        </Button>
      </Popover.Trigger>

      <PopoverAdapt when="sm">
        <PopoverSheet modal dismissOnSnapToBottom snapPoints={[45]}>
          <PopoverSheetOverlay
            animation="lazy"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <PopoverSheetFrame
            backgroundColor="$background"
            borderTopLeftRadius="$2xl"
            borderTopRightRadius="$2xl"
            padding="$md"
            gap="$sm"
          >
            <PopoverSheetHandle backgroundColor="$border" />
            <AdaptContents />
          </PopoverSheetFrame>
        </PopoverSheet>
      </PopoverAdapt>

      <Popover.Content
        backgroundColor="$background"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$lg"
        padding="$xs"
        elevate
        zIndex={200000}
      >
        <Column
          ref={menuRef}
          role="menu"
          aria-label="Sort by"
          minWidth={220}
          gap={2}
          {...{ onKeyDown: handleMenuKeyDown }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Button
                key={option.value}
                butterVariant="ghost"
                size="$4"
                width="100%"
                justifyContent="space-between"
                borderRadius="$md"
                role="menuitemradio"
                aria-checked={isSelected}
                iconAfter={isSelected ? Check : undefined}
                onPress={() => choose(option.value)}
              >
                {option.label}
              </Button>
            );
          })}
        </Column>
      </Popover.Content>
    </Popover>
  );
}
