"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { GestureResponderEvent } from "react-native";

interface PressLikeEvent {
  preventDefault?: () => void;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  button?: number;
  nativeEvent?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; button?: number };
}

/** Modifier clicks (cmd/ctrl/shift, middle button) should keep native link behaviour. */
export function isModifiedPress(gesture: GestureResponderEvent): boolean {
  const event = gesture as unknown as PressLikeEvent;
  const native = event.nativeEvent ?? {};
  return Boolean(
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    native.metaKey ||
    native.ctrlKey ||
    native.shiftKey ||
    (event.button ?? native.button ?? 0) !== 0
  );
}

/**
 * Press handler factory for Buttons rendered as real anchors (`tag="a" href`).
 * Plain clicks navigate client-side; modified clicks fall through to the
 * browser so open-in-new-tab and copy-link keep working.
 *
 * @example
 * const linkPress = useLinkPress();
 * <Button tag="a" href="/sell" onPress={linkPress("/sell")}>Sell now</Button>
 */
export function useLinkPress() {
  const router = useRouter();

  return useCallback(
    (href: string, onNavigate?: () => void) => (gesture: GestureResponderEvent) => {
      if (isModifiedPress(gesture)) return;
      (gesture as unknown as PressLikeEvent).preventDefault?.();
      onNavigate?.();
      router.push(href);
    },
    [router]
  );
}
