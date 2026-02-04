# Asset Usage Examples

## Mobile (React Native / Expo)

```tsx
import { Image } from '@buttergolf/ui'
import { images } from '@buttergolf/assets'

// Using club images in mobile app
export function ProductCard() {
  return (
    <Image
      source={images.clubs.club1}
      width={200}
      height={200}
      objectFit="cover"
      borderRadius="$lg"
    />
  )
}

// Random club image
const clubKeys = Object.keys(images.clubs) as Array<keyof typeof images.clubs>
const randomClub = images.clubs[clubKeys[Math.floor(Math.random() * clubKeys.length)]]

<Image source={randomClub} width={300} height={300} />
```

## Web (Next.js)

### Option 1: Using Next.js Image with public folder

```tsx
import { Image } from "@buttergolf/ui";
import { imagePaths } from "@buttergolf/assets";

export function HeroSection() {
  return (
    <Image
      source={{ uri: imagePaths.clubs.club1 }}
      width={400}
      height={400}
      objectFit="cover"
      borderRadius="$2xl"
    />
  );
}
```

### Option 2: Using Next.js optimized Image component

```tsx
import NextImage from "next/image";

export function OptimizedImage() {
  return (
    <NextImage
      src="/_assets/images/clubs-1.jpg"
      alt="Golf clubs"
      width={400}
      height={400}
      style={{ borderRadius: "24px", objectFit: "cover" }}
    />
  );
}
```

## Type-Safe Access

```tsx
import { images, type ClubImageKey } from "@buttergolf/assets";

// Type-safe key selection
const imageKey: ClubImageKey = "club1";
const image = images.clubs[imageKey];

// Works with arrays
const allClubImages = Object.values(images.clubs);
const featuredImages = [images.clubs.club1, images.clubs.club4, images.clubs.club6];
```

## Carousel/Slider Example

```tsx
import { images } from "@buttergolf/assets";

const CAROUSEL_ITEMS = [
  {
    id: 1,
    image: images.clubs.club1, // Mobile
    imagePath: "/_assets/images/clubs-1.jpg", // Web
    title: "Premium Driver Set",
  },
  {
    id: 2,
    image: images.clubs.club2,
    imagePath: "/_assets/images/clubs-2.webp",
    title: "Complete Iron Collection",
  },
  // ... more items
];
```
