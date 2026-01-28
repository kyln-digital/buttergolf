# @buttergolf/assets

Shared assets package for ButterGolf web and mobile apps.

## Structure

```
packages/assets/
├── images/          # Image assets (jpg, png, svg, etc.)
│   └── golf/       # Golf-related images
├── src/
│   └── index.ts    # Export image references
└── package.json
```

## Usage

### Mobile (React Native / Expo)

```tsx
import { images } from "@buttergolf/assets";

<Image source={images.golf.hero1} />;
```

### Web (Next.js)

```tsx
import { imagePaths } from "@buttergolf/assets";
import Image from "next/image";

<Image src={imagePaths.golf.hero1} alt="Golf" width={400} height={400} />;
```

Or reference directly from public folder:

```tsx
<Image src="/_assets/images/golf-hero-1.jpg" alt="Golf" width={400} height={400} />
```

## Adding New Images

1. Place image files in `packages/assets/images/`
2. For mobile: Add to `src/index.ts` exports using `require()`
3. For web: Copy to `apps/web/public/_assets/images/` during build OR reference from package
4. Update type definitions

## Build Process

For web, images should be copied to the public folder:

- Add a build script to copy images to `apps/web/public/_assets/`
- Or use Next.js image optimization by importing directly

For mobile, Metro bundler will handle the `require()` statements automatically.
