"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "@tamagui/lucide-icons";
import { Button, Column, Input, Row, Text } from "@buttergolf/ui";
import { SearchDropdown } from "./SearchDropdown";

interface HeaderSearchProps {
  /** Autofocus the field (used by the mobile search sheet) */
  autoFocus?: boolean;
  /** Called after a navigation is triggered (close menus etc.) */
  onNavigate?: () => void;
}

// Rotating hints for the site search. Each line is a true facet of what the
// search covers, so any single frame still reads accurately on its own.
const SEARCH_HINTS = [
  "Search clubs, brands, balls...",
  "Try a brand: Titleist, Callaway, Ping",
  "Find a model, e.g. Qi10 or Pro V1",
  "Search wedges, bags and apparel",
];

const HINT_INTERVAL_MS = 3000;

/** Cycles through the search hints while `active`; pauses in background tabs. */
function useRotatingHint(active: boolean): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(() => {
        setIndex((current) => (current + 1) % SEARCH_HINTS.length);
      }, HINT_INTERVAL_MS);
    };
    const stop = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active]);

  return index;
}

/**
 * Site-wide search field for the header. Pill input with an inline icon, a
 * rotating placeholder, live results dropdown (via /api/search) and
 * Enter → /listings?q=… .
 */
export function HeaderSearch({ autoFocus = false, onNavigate }: HeaderSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // An auto-focused field (mobile menu) should not pop the dropdown until the user engages.
  const skipInitialFocusRef = useRef(autoFocus);

  const isEmpty = query.length === 0;
  const hintIndex = useRotatingHint(isEmpty);

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
          aria-label="Search listings by club, brand, model or category"
          aria-expanded={open}
          role="combobox"
        />

        {/* Rotating placeholder - purely decorative, the input carries the aria-label */}
        {isEmpty && (
          <Row
            position="absolute"
            left={44}
            right={20}
            top={0}
            bottom={0}
            alignItems="center"
            overflow="hidden"
            pointerEvents="none"
            aria-hidden
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={hintIndex}
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{ width: "100%" }}
              >
                <Text size="$4" fontWeight="500" color="$textSecondary" numberOfLines={1}>
                  {SEARCH_HINTS[hintIndex]}
                </Text>
              </motion.div>
            </AnimatePresence>
          </Row>
        )}

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
