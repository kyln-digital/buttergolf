# Category Constants

This directory contains centralized category definitions for the ButterGolf platform.

## Files

- **`categories.ts`** - The single source of truth for all product categories

## Usage

### Importing Categories

```typescript
import { CATEGORIES, getCategoryBySlug, isValidCategorySlug } from "@buttergolf/db";

// Get all categories
const allCategories = CATEGORIES;

// Find by slug
const driversCategory = getCategoryBySlug("drivers");

// Validate slug
const isValid = isValidCategorySlug("drivers"); // true
```

### Using in Components

```typescript
import { CATEGORIES } from '@buttergolf/db'

function CategorySelect() {
  return (
    <select>
      {CATEGORIES.map(cat => (
        <option key={cat.slug} value={cat.slug}>
          {cat.name}
        </option>
      ))}
    </select>
  )
}
```

### Using in API Routes

```typescript
import { isValidCategorySlug } from "@buttergolf/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categorySlug = searchParams.get("category");

  if (categorySlug && !isValidCategorySlug(categorySlug)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // Proceed with valid category
}
```

## Adding a New Category

1. Edit `categories.ts` and add to the `CATEGORIES` array
2. Run `pnpm db:seed` to sync with database
3. The category will automatically appear in all dropdowns and filters

## Category Properties

Each category has:

- **`name`** - Display name (e.g., "Drivers")
- **`slug`** - URL-friendly identifier (e.g., "drivers")
- **`description`** - Brief description for SEO and UI
- **`imageUrl`** - Path to category image
- **`sortOrder`** - Display order (lower numbers appear first)

## Related Files

- **Database Schema**: `packages/db/prisma/schema.prisma`
- **Seed File**: `packages/db/prisma/seed.ts`
- **API Endpoint**: `apps/web/src/app/api/categories/route.ts`
- **Documentation**: `docs/CENTRALIZED_CATEGORIES.md`
