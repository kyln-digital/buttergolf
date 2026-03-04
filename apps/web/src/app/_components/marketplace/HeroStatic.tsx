"use client";

import { HeroRedesign } from "./HeroRedesign";

/**
 * Hero section wrapper for the web marketplace homepage.
 * Delegates to HeroRedesign which implements the Figma-matched layout
 * with centered text, butter-texture background, and scattered club images.
 */
export function HeroStatic() {
  return <HeroRedesign />;
}
