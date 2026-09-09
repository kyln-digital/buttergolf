"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "@tamagui/lucide-icons";
import { Button, Column, Input, Row } from "@buttergolf/ui";
import { SearchDropdown } from "./SearchDropdown";

interface HeaderSearchProps {
  /** Autofocus the field (used by the mobile search sheet) */
  autoFocus?: boolean;
  /** Called after a navigation is triggered (close menus etc.) */
  onNavigate?: () => void;
}

/**
 * Site-wide search field for the header. Pill input with an inline icon,
 * live results dropdown (via /api/search) and Enter → /listings?q=… .
 */
export function HeaderSearch({ autoFocus = false, onNavigate }: HeaderSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // An auto-focused field (mobile menu) should not pop the dropdown until the user engages.
  const skipInitialFocusRef = useRef(autoFocus);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };

  const submit = () => {
    const term = query.trim();
    if (!term) return;
    close();
    router.push(`/listings?q=${encodeURIComponent(term)}`);
  };

  return (
    <Column
      ref={(node) => {
        containerRef.current = node as unknown as HTMLDivElement | null;
      }}
      position="relative"
      width="100%"
      maxWidth={640}
      zIndex={open ? 1001 : undefined}
    >
      <Row alignItems="center" position="relative" width="100%">
        <Row position="absolute" left={16} zIndex={1} pointerEvents="none">
          <Search size={18} color="$textSecondary" />
        </Row>

        <Input
          size="md"
          width="100%"
          height={44}
          paddingLeft={44}
          paddingRight={query ? 44 : 20}
          borderRadius="$full"
          borderWidth={1.5}
          borderColor="$border"
          backgroundColor="$surface"
          fontWeight="500"
          placeholder="Search clubs, brands, balls..."
          placeholderTextColor="$textSecondary"
          value={query}
          autoFocus={autoFocus}
          onChangeText={(text) => {
            setQuery(text);
            setOpen(true);
          }}
          onFocus={() => {
            if (skipInitialFocusRef.current) {
              skipInitialFocusRef.current = false;
              return;
            }
            setOpen(true);
          }}
          onPointerDown={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          hoverStyle={{ borderColor: "$borderHover" }}
          focusStyle={{ borderColor: "$primary", borderWidth: 1.5 }}
          aria-label="Search listings"
          aria-expanded={open}
          role="combobox"
        />

        {query.length > 0 && (
          <Button
            butterVariant="ghost"
            circular
            size="$3"
            position="absolute"
            right={6}
            aria-label="Clear search"
            onPress={() => setQuery("")}
          >
            <X size={16} color="$textSecondary" />
          </Button>
        )}
      </Row>

      {open && (
        <Column
          position="absolute"
          top="100%"
          left={0}
          right={0}
          marginTop="$sm"
          backgroundColor="$surface"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          overflow="hidden"
          zIndex={1001}
          shadowColor="$shadowColorHover"
          shadowOffset={{ width: 0, height: 12 }}
          shadowRadius={32}
          shadowOpacity={1}
        >
          <SearchDropdown query={query} onSelect={close} />
        </Column>
      )}
    </Column>
  );
}
