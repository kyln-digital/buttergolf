# ButterGolf - Claude Code Instructions

## Project Overview

ButterGolf is a cross-platform golf course management and booking application built with a modern monorepo architecture. It supports both web (Next.js) and mobile (Expo) platforms with shared business logic and UI components.

## Architecture

### Monorepo Structure

This is a **Turborepo monorepo** using **pnpm workspaces**:

```
buttergolf/
├── apps/
│   ├── web/          # Next.js 16 web application (App Router)
│   └── mobile/       # Expo mobile application (iOS/Android)
├── packages/
│   ├── ui/           # Tamagui cross-platform components
│   ├── app/          # Shared screens & business logic (Solito-based)
│   ├── db/           # Prisma database client & schema
│   ├── config/       # Tamagui configuration
│   ├── constants/    # Shared constants
│   └── assets/       # Shared assets
└── .claude/          # Claude Code configuration
```

### Technology Stack

- **Build System**: Turborepo 2.6.0 for orchestration and caching
- **Package Manager**: pnpm 10.20.0 with workspace protocol
- **UI Framework**: Tamagui 2.0.0-rc.16 for cross-platform UI
  - Migrated from v1 — see `docs/tamagui-v2-migration.md` for changelog and break-fix guide
- **Database**: Prisma 6.x with PostgreSQL
- **React**: 19.1.0 (aligned across web and mobile)
- **TypeScript**: 5.9.2 (strict mode enabled)
- **Styling**:
  - Web: Tailwind CSS v4 + Tamagui
  - Mobile: Tamagui only
- **Navigation**: Solito 5.0.0 for unified routing
- **Auth**: Clerk 6.34.1 (`@clerk/nextjs` for web, `@clerk/clerk-expo` for mobile)
- **Payments**: Stripe 19.2.1 (platform-specific implementations)
- **Image CDN**: Cloudinary for uploads and transformations

## Critical Conventions

### Package Naming

All internal packages use the `@buttergolf/` namespace:

- `@buttergolf/ui`
- `@buttergolf/app`
- `@buttergolf/db`
- `@buttergolf/config`
- Use `workspace:*` protocol for internal dependencies

### Next.js 16+ Middleware Convention

**CRITICAL**: Next.js 16+ uses `src/proxy.ts` NOT `src/middleware.ts`

- The middleware file convention was renamed
- Always use `proxy.ts` for route protection and middleware logic

### 🚨 NEVER Use Tamagui Components in Server Components

**CRITICAL**: Tamagui uses `React.createContext()` at module load time. This BREAKS during Next.js "Collecting page data" phase in server components.

```tsx
// ❌ WRONG - Server component importing Tamagui (CAUSES BUILD FAILURE)
import { Column } from "@buttergolf/ui";

export default async function Layout({ children }) {
  const { userId } = await auth(); // Server-only code
  return <Column>{children}</Column>; // 💥 TypeError: createContext is not a function
}

// ✅ CORRECT - Use plain HTML in server components
export default async function Layout({ children }) {
  const { userId } = await auth();
  return <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>;
}
```

**The Rule**: NEVER import ANY Tamagui component (Column, Row, Text, Button, Card, etc.) in:

- `layout.tsx` without `"use client"`
- `page.tsx` without `"use client"`
- Server Actions
- API routes

**Why**: Tamagui was designed for React Native + Web where everything is client-side. Next.js App Router server components are a completely different execution model.

### Navigation Architecture (IMPORTANT)

**This is a Solito-based monorepo, NOT Expo Router**

#### How Navigation Works:

- **Web**: Next.js App Router (file-based routing in `app/` directory)
- **Mobile**: Expo + React Navigation (manual route registration in `App.tsx`)
- **Shared**: Solito translates between platforms automatically

#### Package Structure:

- `packages/app/` - Shared cross-platform screens and business logic
  - Uses `solito/link` and `solito/navigation` for platform-agnostic navigation
  - Example: `packages/app/src/features/categories/category-list-screen.tsx`
- `apps/web/` - Next.js routes import shared screens
  - Example: `apps/web/src/app/category/[slug]/page.tsx`
- `apps/mobile/` - Manual screen registration in `App.tsx`
  - Must register screens in Stack Navigator
  - Must define linking config

#### Adding a New Screen:

1. **Define route** in `packages/app/src/navigation/routes.ts`
2. **Create screen** in `packages/app/src/features/[feature]/[screen-name].tsx`
   - Must be platform-agnostic (use Tamagui, not web/native-specific APIs)
3. **Export** from `packages/app/src/index.ts`
4. **Web (automatic)**: Create matching route in `apps/web/src/app/[route]/page.tsx`
5. **Mobile (manual)**: Register in `apps/mobile/App.tsx`:

   ```typescript
   // Add to linking config
   const linking = {
     config: {
       screens: {
         MyNewScreen: { path: "my-route/:param" }
       }
     }
   }

   // Add to Stack Navigator
   <Stack.Screen name="MyNewScreen">
     {({ route }) => (
       <MyNewScreen
         param={route.params?.param}
         onFetchData={fetchDataFunction}
       />
     )}
   </Stack.Screen>
   ```

### Common Navigation Mistakes to Avoid

- ❌ Don't expect Expo Router file-based routing in `apps/mobile/`
- ❌ Don't create separate screens for web and mobile
- ❌ Don't forget to register new routes in BOTH linking config AND Stack Navigator
- ❌ Don't use Next.js-specific APIs in `packages/app/`
- ✅ DO use Solito's `useLink` and `Link` components
- ✅ DO use Tamagui components for UI
- ✅ DO pass data fetching functions as props

## Tamagui Design System

### Core Configuration

- **Config Package**: `packages/config/src/tamagui.config.ts` (source of truth)
- **Base Config**: Extends `@tamagui/config/v4` (Tamagui v2 package — config schema is still named v4)
- **Re-export**: `packages/ui/tamagui.config.ts` for backward compatibility

### Color Tokens

#### Brand Colors (Figma Specification)

```tsx
// Primary
$spicedClementine: #F45314  // Main brand color
$primary: $spicedClementine

// Primary Light
$vanillaCream: #FFFAD2      // Light backgrounds
$primaryLight: $vanillaCream

// Secondary
$burntOlive: #3E3B2C        // Dark accent
$secondary: $burntOlive
$secondaryLight: $lemonHaze

// Tertiary
$lemonHaze: #EDECC3         // Subtle accent

// Neutrals
$cloudMist: #EDEDED         // Borders/dividers
$slateSmoke: #545454        // Secondary text
$ironstone: #323232         // Primary text
$pureWhite: #FFFFFF         // Base white
```

#### Semantic Tokens (USE IN APP CODE)

**ALWAYS prefer semantic tokens for theme support:**

```tsx
// Text colors
$text; // Primary text
$textSecondary; // Secondary text
$textTertiary; // Tertiary text
$textMuted; // Muted/placeholder text
$textInverse; // Text on dark backgrounds

// Backgrounds
$background; // Main app background
$surface; // Surface/card backgrounds
$card; // Card-specific background

// Borders
$border; // Default borders
$borderHover; // Hover state borders
$borderFocus; // Focus state borders

// Status colors
$success; // Positive actions/states
$error; // Error states
$warning; // Warning states
$info; // Informational states
```

### Component Usage Patterns

#### ✅ ALWAYS Use Standard Tamagui Button

```tsx
// ✅ CORRECT - Use standard Tamagui Button with numeric size tokens
import { Button } from "@buttergolf/ui";

<Button
  size="$5"
  backgroundColor="$primary"
  color="$textInverse"
  paddingHorizontal="$6"
  borderRadius="$full"
>
  View all listings
</Button>

// ❌ WRONG - Never create manual HTML buttons
<button style={{ /* inline styles */ }}>View all</button>
```

#### ✅ ALWAYS Use Semantic Color Tokens

```tsx
// ✅ CORRECT - Semantic tokens (preferred in app code)
<Button backgroundColor="$primary" color="$textInverse">Submit</Button>
<Text color="$text">Primary text</Text>
<Text color="$textSecondary">Secondary text</Text>
<View borderColor="$border" backgroundColor="$background">Content</View>

// ⚠️ USE SPARINGLY - Brand tokens (only in component libraries)
<Text color="$ironstone">Always dark gray (no theme switching)</Text>

// ❌ WRONG - Never use raw hex values
<Button backgroundColor="#F45314">Submit</Button>
```

#### Understanding 'size' - Two Different Meanings

**CRITICAL: The `size` prop has TWO DIFFERENT meanings:**

##### 1️⃣ Font Size Tokens (Text/Typography)

```tsx
// ✅ CORRECT - Use size with numeric tokens on Text
<Text size="$4">Small (14px)</Text>
<Text size="$5">Medium (15px) - DEFAULT</Text>
<Text size="$6">Large (16px)</Text>
<Text size="$7">XL (18px)</Text>

// ❌ WRONG
<Text fontSize="$5">Wrong!</Text>  // Use size, not fontSize
<Text size="md">Wrong!</Text>       // Named sizes don't exist
```

##### 2️⃣ Component Size Variants (UI Components)

```tsx
// ✅ CORRECT - Numeric size tokens on UI components
<Button size="$4">Click me</Button>
<Input size="$5" />
<Badge size="$3">NEW</Badge>
<Spinner size="$4" />

// ❌ WRONG
<Button size="md">Wrong!</Button>  // Use numeric tokens like $4
```

##### 🛡️ ESLint Enforcement

**IMPORTANT: Using `fontSize` directly on Text components is now blocked by ESLint.**

```tsx
// ❌ BLOCKED BY LINTER - Will show error
<Text fontSize={14}>This will fail linting</Text>

// ✅ CORRECT - Use size tokens
<Text size="$4">This passes linting</Text>
```

**Why this matters:** Using `fontSize` bypasses Tamagui's variant system and causes invisible text on React Native (lineHeight becomes 1.5px instead of proper pixel values from the font config). The ESLint rule `react/forbid-component-props` catches this mistake at development time.

**Error message you'll see:**

```
Use size="$token" instead of fontSize prop on Text components.
fontSize bypasses the Tamagui variant system and causes invisible
text on React Native (lineHeight becomes 1.5px instead of proper
pixel values).
```

**Rule location:** `packages/eslint-config/react-internal.js`

#### ✅ Use Layout Components (Row/Column)

**CRITICAL: Row and Column are minimal shims over Tamagui primitives. They expose the FULL Tamagui API.**

Row and Column components do NOT have custom variants. Always use native Tamagui props directly.

##### ✅ CORRECT - Use Native Tamagui Props

```tsx
// ✅ Gap with $ prefix (Tamagui token)
<Row gap="$md">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</Row>

// ✅ Alignment with native React Native flexbox props
<Row alignItems="center" justifyContent="space-between">
  <Text>Left</Text>
  <Text>Right</Text>
</Row>

// ✅ Full example with all common props
<Column
  gap="$lg"
  padding="$md"
  alignItems="stretch"
  justifyContent="flex-start"
  width="100%"
>
  <Heading level={2}>Title</Heading>
  <Text>Description</Text>
  <Button>Action</Button>
</Column>

// ✅ Media queries work naturally
<Row
  gap="$sm"
  $gtMd={{ gap: "$lg" }}
  flexDirection="row"
  $gtMd={{ flexDirection: "row-reverse" }}
>
  <Text>Responsive content</Text>
</Row>
```

##### ❌ WRONG - Old Patterns (REMOVED)

```tsx
// ❌ NEVER use custom variants (these were removed)
<Row align="center">          // WRONG! Use alignItems="center"
<Row justify="between">        // WRONG! Use justifyContent="space-between"
<Column align="stretch">       // WRONG! Use alignItems="stretch"

// ❌ NEVER use gap without $ prefix
<Row gap="md">                 // WRONG! Use gap="$md"

// ❌ NEVER use type assertions to bypass errors
<Row {...{ gap: "md" as any }}>  // WRONG! This means you're using wrong prop

// ❌ Don't use XStack/YStack directly when Row/Column exist
<XStack gap="$4">              // Use <Row> instead
<YStack gap="$4">              // Use <Column> instead
```

##### Common Layout Patterns

```tsx
// Horizontal spacing
<Row gap="$md">
  <Button>One</Button>
  <Button>Two</Button>
</Row>

// Vertical stack
<Column gap="$lg">
  <Heading level={2}>Title</Heading>
  <Text>Content</Text>
</Column>

// Centered content
<Column gap="$md" alignItems="center" justifyContent="center">
  <Spinner />
  <Text>Loading...</Text>
</Column>

// Space between with alignment
<Row alignItems="center" justifyContent="space-between" width="100%">
  <Text>Label</Text>
  <Badge>Status</Badge>
</Row>

// Nested layouts
<Column gap="$xl" fullWidth>
  <Row alignItems="center" justifyContent="space-between">
    <Heading level={2}>Section Title</Heading>
    <Button>Action</Button>
  </Row>
  <Column gap="$md">
    <Text>Content here</Text>
  </Column>
</Column>
```

##### Why This Approach?

1. **Type Safety**: No custom variants means no TypeScript conflicts
2. **Full API Access**: All Tamagui/React Native flexbox props available
3. **Better IntelliSense**: IDEs autocomplete all available props
4. **Cross-Platform**: Works identically on web and mobile
5. **Future-Proof**: No breaking changes when Tamagui updates

#### ✅ Use Compound Components for Cards

```tsx
// ✅ CORRECT - Compound components
<Card variant="elevated">
  <Card.Header>
    <Heading level={3}>Title</Heading>
  </Card.Header>
  <Card.Body>
    <Text>Content</Text>
  </Card.Body>
  <Card.Footer align="right">
    <Button>Action</Button>
  </Card.Footer>
</Card>
```

#### ✅ Theme Switching for State-Based Styling

```tsx
// ✅ CORRECT - Use Theme component for state-based styling
<Theme name={isActive ? "active" : null}>
  <Text>Menu Item</Text>  {/* Automatically gets active theme colors */}
</Theme>

// ❌ WRONG - Don't use conditional variant props
<Text color={isActive ? "primary" : "default"}>Menu Item</Text>
```

## Design System Compliance Guidelines

### Overview

ButterGolf has achieved **95%+ design system compliance** through systematic refactoring and enforcement of Tamagui best practices. All new code MUST follow these guidelines to maintain consistency and code quality.

### ✅ DO: Required Patterns

#### 1. Always Use Semantic Color Tokens

```tsx
// ✅ CORRECT - Semantic tokens (always preferred)
<Button backgroundColor="$primary" color="$textInverse">Submit</Button>
<Text color="$text">Primary text</Text>
<Text color="$textSecondary">Secondary text</Text>
<View borderColor="$border" backgroundColor="$surface">Content</View>

// ⚠️ USE SPARINGLY - Brand tokens (only in component libraries)
<Text color="$spicedClementine">Always orange (no theme support)</Text>

// ❌ NEVER - Raw hex values
<Button backgroundColor="#F45314">Submit</Button>
<Text color="#323232">Wrong!</Text>
```

**Available Semantic Tokens:**

- Text: `$text`, `$textSecondary`, `$textTertiary`, `$textMuted`, `$textInverse`
- Backgrounds: `$background`, `$surface`, `$card`
- Borders: `$border`, `$borderHover`, `$borderFocus`, `$fieldBorder`
- Status: `$success`, `$error`, `$warning`, `$info`
- Brand: `$primary`, `$primaryLight`, `$secondary`, `$secondaryLight`

#### 2. Use Size Tokens on Text Components

```tsx
// ✅ CORRECT - Use size with numeric tokens
<Text size="$4">Small (14px)</Text>
<Text size="$5">Medium (15px) - DEFAULT</Text>
<Text size="$6">Large (16px)</Text>
<Heading level={2} size="$9">Page Title (40px)</Heading>

// ❌ NEVER - fontSize prop is blocked by ESLint
<Text fontSize="$5">Wrong!</Text>
<Text fontSize={14}>Wrong!</Text>
```

#### 3. Use Spacing Tokens

```tsx
// ✅ CORRECT - Token-based spacing
<Column gap="$md" padding="$lg">
  <Text>Content</Text>
</Column>

<Row paddingHorizontal="$xl" paddingVertical="$md">
  <Button>Action</Button>
</Row>

// ❌ NEVER - Raw pixel values
<Column style={{ padding: "20px", gap: "16px" }}>Wrong!</Column>
```

**Available Spacing Tokens:**

- `$xs` = 4px
- `$sm` = 8px
- `$md` = 16px
- `$lg` = 24px
- `$xl` = 32px
- `$2xl` = 48px
- `$3xl` = 64px

#### 4. Use Tamagui Components (Never Raw HTML)

```tsx
// ✅ CORRECT - Tamagui components
<Column gap="$md">
  <Heading level={2}>Title</Heading>
  <Text>Description</Text>
  <Button onPress={handleClick}>Action</Button>
</Column>

// ❌ NEVER - Raw HTML elements
<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
  <h2>Title</h2>
  <p>Description</p>
  <button onClick={handleClick}>Action</button>
</div>
```

#### 5. Use Brand Background Helpers

```tsx
// ✅ CORRECT - Brand color backgrounds for visual distinctiveness
<VanillaCreamBackground padding="$2xl">
  <Heading level={2}>Trust & Safety</Heading>
  <Text>We verify all sellers...</Text>
</VanillaCreamBackground>

<LemonHazeCard size="md">
  <Text weight="semibold">Pro Tip</Text>
  <Text>Upload high-quality photos!</Text>
</LemonHazeCard>

// ❌ WRONG - Plain white everywhere
<Column backgroundColor="$surface">
  <Text>Generic section</Text>
</Column>
```

**When to Use:**

- VanillaCreamBackground: Section alternation, hero sections, empty states, trust sections
- LemonHazeBackground: Sidebars, selected states, callout sections
- LemonHazeCard: Tip cards, info callouts, highlighted content
- VanillaCreamCard: Empty states, placeholder content, featured content

### ❌ DON'T: Anti-Patterns to Avoid

#### 1. Never Use Raw HTML in App Code

```tsx
// ❌ WRONG
<div style={{ padding: "20px" }}>
  <h2 style={{ fontSize: "24px", color: "#323232" }}>Title</h2>
  <p style={{ color: "#545454" }}>Text</p>
  <button style={{ background: "#F45314" }}>Click</button>
</div>

// ✅ CORRECT
<Column padding="$lg">
  <Heading level={2} color="$text">Title</Heading>
  <Text color="$textSecondary">Text</Text>
  <Button backgroundColor="$primary">Click</Button>
</Column>
```

#### 2. Never Use fontSize Prop on Text

```tsx
// ❌ WRONG - ESLint will error
<Text fontSize="$5">This fails linting</Text>
<Text fontSize={16}>Also fails</Text>

// ✅ CORRECT
<Text size="$5">This passes linting</Text>
```

#### 3. Never Hardcode Colors

```tsx
// ❌ WRONG
<Text color="#323232">Dark text</Text>
<Button backgroundColor="#F45314">Orange button</Button>
<View borderColor="#EDEDED">Content</View>

// ✅ CORRECT
<Text color="$text">Dark text</Text>
<Button backgroundColor="$primary">Orange button</Button>
<View borderColor="$border">Content</View>
```

#### 4. Never Use Raw Pixel Values for Spacing

```tsx
// ❌ WRONG
<Column style={{ padding: "20px", gap: "16px", margin: "24px" }}>

// ✅ CORRECT
<Column padding="$lg" gap="$md" margin="$lg">
```

### Component-Specific Guidelines

#### Form Components

Always use design system form components:

```tsx
// ✅ CORRECT
<Input size="md" placeholder="Email" />
<Select size="md" value={value} onValueChange={setValue}>
  <option value="option1">Option 1</option>
</Select>
<TextArea size="md" placeholder="Description" rows={4} />
<RadioGroup value={selected} onValueChange={setSelected}>
  <Radio value="option1" label="Option 1" />
  <Radio value="option2" label="Option 2" />
</RadioGroup>

// ❌ NEVER use raw HTML
<input type="text" placeholder="Email" />
<select><option>Option 1</option></select>
<textarea placeholder="Description" />
```

#### Buttons

```tsx
// ✅ CORRECT - Tamagui Button with tokens
<Button
  size="$5"
  backgroundColor="$primary"
  color="$textInverse"
  onPress={handleClick}
>
  Submit
</Button>

// ❌ WRONG - Raw HTML button
<button style={{ background: "#F45314" }} onClick={handleClick}>
  Submit
</button>
```

#### Headings

```tsx
// ✅ CORRECT - Heading component with size tokens
<Heading level={2} size="$9" color="$text">
  Page Title
</Heading>

// ❌ WRONG - Raw HTML with inline styles
<h2 style={{ fontSize: "clamp(28px, 5vw, 40px)", color: "#323232" }}>
  Page Title
</h2>
```

### Pre-Commit Checklist

Before committing code, verify:

- [ ] No raw HTML elements (`<div>`, `<h1>-<h6>`, `<p>`, `<button>`, `<input>`, `<select>`, `<textarea>`)
- [ ] No `fontSize` prop on Text components (use `size` instead)
- [ ] No hardcoded hex colors (use semantic tokens like `$primary`, `$text`)
- [ ] No raw pixel values for spacing (use `$xs`, `$sm`, `$md`, `$lg`, `$xl`, `$2xl`, `$3xl`)
- [ ] All form inputs use design system components (Input, Select, TextArea, Radio)
- [ ] Brand colors (Vanilla Cream, Lemon Haze) used where appropriate for visual interest

### Enforcement

**ESLint Rules:**

- `react/forbid-component-props` - Blocks `fontSize` on Text components
- Future: `react/forbid-elements` - Will block raw HTML elements

**Type System:**

- TypeScript strict mode catches token typos
- Tamagui's type system prevents invalid prop combinations

## Development Workflow

### Commands

```bash
# Development
pnpm dev              # Start all apps
pnpm dev:web          # Start Next.js (localhost:3000)
pnpm dev:mobile       # Start Expo dev server

# Building
pnpm build            # Build all apps
pnpm typecheck        # TypeScript validation

# Database
pnpm db:generate      # Generate Prisma Client
pnpm db:migrate:dev   # Create and apply migration
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed database

# Code Quality
pnpm lint             # Lint all packages
pnpm format           # Format with Prettier

# Cleaning
pnpm clean-install    # Remove node_modules and reinstall
```

### Adding Dependencies

```bash
# Root dependencies (build tools)
pnpm add -w <package>

# Workspace dependencies
pnpm add <package> --filter <workspace>

# Examples:
pnpm add lodash --filter web
pnpm add @buttergolf/ui --filter mobile
```

### Creating New Packages

1. Create directory in `packages/`
2. Add `package.json` with `@buttergolf/` namespace
3. Configure TypeScript with extends from root
4. Add to workspace imports in consuming apps
5. Update Turborepo pipeline if needed

## File Naming Conventions

- **Components**: `PascalCase.tsx` (e.g., `Button.tsx`)
- **Hooks**: `camelCase.ts` with `use` prefix (e.g., `useAuth.ts`)
- **Utilities**: `kebab-case.ts` (e.g., `format-date.ts`)
- **Types**: `PascalCase.ts` or `types.ts`
- **Tests**: `*.test.ts` or `*.spec.ts`

## Code Style Guidelines

### TypeScript

- Always use strict mode
- Prefer interfaces over types for object shapes
- Use explicit return types for public APIs
- Avoid `any` - use `unknown` when type is truly unknown

### React

- Use function components exclusively
- Use named exports
- Destructure props in function signature
- Use hooks for state and side effects
- Avoid inline function definitions in JSX (extract to variables)

### Imports

- Group imports: external → internal packages → relative
- Sort alphabetically within groups
- Use named imports where possible
- Avoid default exports except for pages/screens

### Comments

- Use JSDoc for public APIs
- Explain "why" not "what"
- Keep comments up-to-date
- Remove commented-out code

## Platform-Specific Considerations

### Web (Next.js)

- Use App Router conventions
- Server Components by default
- Add `"use client"` only when necessary
- Use `next/image` for images (not in shared `packages/app/`)
- Leverage Server Actions for mutations
- Use `src/proxy.ts` for middleware (NOT `middleware.ts`)

### Mobile (Expo)

- Test on both iOS and Android
- Use Expo APIs for native features
- Handle safe area insets
- Consider offline functionality
- Test on physical devices when possible

### Shared (`packages/app/`)

- Must be platform-agnostic
- Use Tamagui components only
- No platform-specific imports without checks
- Pass data fetching as props (don't fetch directly)
- Use Solito for navigation

## Common Patterns

### Data Fetching

**Web (Server Components):**

```tsx
// app/page.tsx
import { db } from "@buttergolf/db";

export default async function Page() {
  const data = await db.course.findMany();
  return <CourseList data={data} />;
}
```

**Mobile (Client-side):**

```tsx
// App.tsx
const [data, setData] = useState([]);

useEffect(() => {
  fetch("/api/courses")
    .then((res) => res.json())
    .then(setData);
}, []);
```

**Shared Screen:**

```tsx
// packages/app/src/features/courses/course-list-screen.tsx
interface CourseListScreenProps {
  data: Course[];
  onFetchData?: () => Promise<Course[]>;
}

export function CourseListScreen({ data, onFetchData }: CourseListScreenProps) {
  return (
    <Column gap="$md">
      {data.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </Column>
  );
}
```

### Authentication (Clerk)

**Web:**

```tsx
import { currentUser } from "@clerk/nextjs/server";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  // ...
}
```

**Mobile:**

```tsx
import { useUser } from "@clerk/clerk-expo";

function Screen() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <Spinner />;
  if (!user) return <SignInScreen />;
  // ...
}
```

### Database Access

**🚨 CRITICAL: NEVER import from `@prisma/client` directly**

```tsx
// ❌ WRONG - Causes "Cannot find module '.prisma/client/default'" errors
import { ProductCondition } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// ✅ CORRECT - Always import from @buttergolf/db
import { prisma, ProductCondition } from "@buttergolf/db";
import type { Prisma } from "@buttergolf/db";
```

**Why:** pnpm uses symlinks and strict module resolution. Our custom Prisma output (`packages/db/generated/client`) only works when importing via `@buttergolf/db`.

```tsx
// Create
const course = await prisma.course.create({
  data: {
    name: "Pebble Beach",
    location: "California",
  },
});

// Read
const courses = await prisma.course.findMany({
  where: { active: true },
  include: { holes: true },
});

// Update
await prisma.course.update({
  where: { id: courseId },
  data: { name: "New Name" },
});

// Delete
await prisma.course.delete({
  where: { id: courseId },
});
```

## Performance Considerations

- Leverage Turborepo caching
- Use React Server Components on web
- Optimize images with Cloudinary transformations
- Lazy load routes and components
- Monitor bundle sizes
- Use memoization strategically

## Security Best Practices

- Validate all user inputs
- Sanitize database queries (Prisma handles this)
- Use environment variables for secrets
- Implement proper authentication checks
- Rate limit API endpoints
- Enable CORS appropriately
- Keep dependencies updated

## Deployment

### Web (Vercel)

- Automatic deployments from main branch
- Preview deployments for PRs
- Environment variables configured in Vercel dashboard
- Build command: `pnpm build --filter=web`

### Mobile

- EAS Build for production builds
- Over-the-air updates for minor changes
- App Store/Play Store submission process
- TestFlight/Internal Testing for beta

## Troubleshooting

### Common Issues

1. **Metro bundler issues**: Clear cache with `pnpm dev:mobile --clear`
2. **Next.js build errors**: Check `next.config.ts` transpilePackages
3. **Type errors in monorepo**: Run `pnpm db:generate` to regenerate Prisma client
4. **Dependency version conflicts**: Use `pnpm dedupe`
5. **Workspace resolution**: Ensure `workspace:*` protocol is used

### Getting Help

- Check existing documentation in `/docs`
- Review similar patterns in codebase
- Consult package-specific CLAUDE.md files
- Check Tamagui documentation for UI issues
- Review Solito docs for navigation issues

## Layout Pattern Documentation

**IMPORTANT**: The codebase recently completed a comprehensive layout migration. All routes now follow the minimal shim pattern for Row/Column components.

### Migration Documentation

For detailed information about layout patterns and component architecture:

- **[Layout Migration Complete](../docs/LAYOUT_MIGRATION_COMPLETE.md)** - Complete migration report with statistics and verification
- **[Component Library Audit](../docs/COMPONENT_LIBRARY_AUDIT.md)** - Full audit of all UI components with variant usage guidelines
- **[Listings Layout Fix](../docs/LISTINGS_LAYOUT_FIX_COMPLETE.md)** - Deep dive into the pattern that established best practices

### Quick Reference: Layout Patterns

**✅ DO:**

- Use `alignItems` for cross-axis alignment
- Use `justifyContent` for main-axis alignment
- Use tokens with `$` prefix (e.g., `gap="$md"`)
- Use Row/Column for semantic layout

**❌ DON'T:**

- Use removed `align` prop (use `alignItems` instead)
- Use removed `justify` prop (use `justifyContent` instead)
- Use gap without `$` prefix (always `gap="$md"`, never `gap="md"`)
- Use `as any` type assertions (if you need this, you're using the wrong prop)
- Use XStack/YStack directly (use Row/Column instead)

### Detection Script

To check for old patterns that may have been reintroduced:

```bash
# Check for Row/Column with old props
grep -r '<Row.*align="' apps/web/src/app --include="*.tsx"
grep -r '<Column.*align="' apps/web/src/app --include="*.tsx"
grep -r '<Row.*justify="' apps/web/src/app --include="*.tsx"

# Should return no results if codebase is clean
```

## Additional Resources

### Tamagui Documentation (PRIMARY REFERENCE)

**CRITICAL: Always reference Tamagui docs for component usage, styling patterns, and theming.**

- **Full LLM-Optimized Documentation**: https://tamagui.dev/llms-full.txt (complete single-file reference)
- **Quick Overview**: https://tamagui.dev/llms.txt (structured overview with links)
- **Core Concepts**: https://tamagui.dev/docs/intro/introduction

**Core Documentation:**

- [Animations](https://tamagui.dev/docs/core/animations.md): Animation system and utilities
- [Config V4](https://tamagui.dev/docs/core/config-v4.md): Version 4 configuration guide
- [Configuration](https://tamagui.dev/docs/core/configuration.md): General configuration options
- [Styled](https://tamagui.dev/docs/core/styled.md): Styled component system
- [Theme](https://tamagui.dev/docs/core/theme.md): Theming system
- [Tokens](https://tamagui.dev/docs/core/tokens.md): Design tokens and variables
- [Use Media](https://tamagui.dev/docs/core/use-media.md): Media query hooks
- [Use Theme](https://tamagui.dev/docs/core/use-theme.md): Theme hooks
- [Variants](https://tamagui.dev/docs/core/variants.md): Component variants system

**Component Documentation:**

- All components at: https://tamagui.dev/ui/[component-name]
- [Button](https://tamagui.dev/ui/button.md): Customizable button with variants and themes
- [Text](https://tamagui.dev/ui/text.md): Text display component
- [Stacks](https://tamagui.dev/ui/stacks.md): Layout stack components (XStack/YStack)

**Guides:**

- [Next.js Guide](https://tamagui.dev/docs/guides/next-js): Next.js integration
- [Theme Builder](https://tamagui.dev/docs/guides/theme-builder): Creating custom themes

### Other Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Expo Documentation](https://docs.expo.dev)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Solito Documentation](https://solito.dev)
