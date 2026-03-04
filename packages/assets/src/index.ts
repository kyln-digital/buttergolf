// Export image paths as constants for type-safe access
// For mobile (React Native), use require() - Metro bundler will handle this
export const images = {
  clubs: {
    club1: require("../images/clubs-1.jpg"),
    club2: require("../images/clubs-2.webp"),
    club3: require("../images/clubs-3.webp"),
    club4: require("../images/clubs-4.jpg"),
    club5: require("../images/clubs-5.webp"),
    club6: require("../images/clubs-6.jpg"),
  },
  hero: {
    golfCourse: require("../images/steven-shircliff-N21z4eG8aKg-unsplash.jpg"),
    background: require("../images/hero-background.avif"),
    butterBackground: require("../images/butter-background.webp"),
    club: require("../images/TM25CWD-TC370-Qi35-Core-3Q-v2 1.png"),
  },
} as const;

// For web (Next.js), you can reference images directly via path
// Copy these to apps/web/public/_assets/images/ or use static imports
export const imagePaths = {
  clubs: {
    club1: "/_assets/images/clubs-1.webp",
    club2: "/_assets/images/clubs-2.webp",
    club3: "/_assets/images/clubs-3.webp",
    club4: "/_assets/images/clubs-4.webp",
    club5: "/_assets/images/clubs-5.webp",
    club6: "/_assets/images/clubs-6.webp",
  },
  hero: {
    golfCourse: "/_assets/images/steven-shircliff-N21z4eG8aKg-unsplash.jpg",
    background: "/_assets/images/hero-background.avif",
    butterBackground: "/_assets/images/butter-background.webp",
    club: "/_assets/images/hero-club.svg",
    clubBottomLeft: "/_assets/images/hero-club-bottom-left.png",
    clubCenter: "/_assets/images/hero-club-center.png",
    clubRightCenter: "/_assets/images/hero-club-right-center.png",
    clubTopRight: "/_assets/images/hero-club-top-right.png",
  },
} as const;

// Type-safe image keys
export type ClubImageKey = keyof typeof images.clubs;

// Re-export icons
export * from "./icons";
