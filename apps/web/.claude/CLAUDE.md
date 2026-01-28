# ButterGolf Web - Claude Code Instructions

## Overview

This is the Next.js 16 web application for ButterGolf. It uses the App Router, Server Components, and integrates with shared packages from the monorepo.

## Framework & Version

- **Framework**: Next.js 16.0.1
- **Router**: App Router (not Pages Router)
- **Rendering**: Server Components by default
- **React**: 19.1.0

## Directory Structure

```
apps/web/
├── src/
│   ├── app/              # App Router pages & layouts
│   │   ├── (auth)/       # Auth route group
│   │   ├── api/          # API routes
│   │   └── layout.tsx    # Root layout
│   ├── components/       # Web-specific components
│   ├── lib/              # Utilities & helpers
│   ├── styles/           # Global styles (Tailwind v4)
│   └── proxy.ts          # Middleware (NOT middleware.ts)
├── public/               # Static assets
├── next.config.ts        # Next.js configuration
└── tailwind.config.ts    # Tailwind configuration
```

## Critical Next.js 16+ Conventions

### Middleware File Convention

**CRITICAL**: Next.js 16+ uses `src/proxy.ts` NOT `src/middleware.ts`

```typescript
// src/proxy.ts (CORRECT for Next.js 16+)
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

❌ **DO NOT** create `src/middleware.ts` - it won't work in Next.js 16+

### App Router Conventions

- **Server Components by default** - no need to specify
- **Client Components** - add `"use client"` directive at top
- **Layouts** - `layout.tsx` for nested layouts
- **Pages** - `page.tsx` for routes
- **Route Groups** - `(auth)/` for grouping without URL segments
- **Dynamic Routes** - `[slug]/page.tsx` for dynamic segments

## Component Patterns

### Server Components (Default)

```tsx
// app/courses/page.tsx
import { db } from "@buttergolf/db";
import { CourseCard } from "@/components/course-card";

export default async function CoursesPage() {
  // Fetch data directly in Server Component
  const courses = await db.course.findMany({
    where: { active: true },
    include: { holes: true },
  });

  return (
    <div>
      <h1>Golf Courses</h1>
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
```

### Client Components

```tsx
"use client"; // REQUIRED at top of file

import { useState } from "react";
import { Button } from "@buttergolf/ui";

export function BookingForm() {
  const [date, setDate] = useState("");

  return (
    <form>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Button onPress={() => console.log(date)}>Book Tee Time</Button>
    </form>
  );
}
```

### When to Use Client Components

Add `"use client"` when you need:

- React hooks (useState, useEffect, etc.)
- Event handlers (onClick, onChange, etc.)
- Browser APIs (window, document, etc.)
- Tamagui interactive components (Button with onPress)
- Context providers

### Shared Screens (from packages/app)

```tsx
// app/category/[slug]/page.tsx
import { db } from "@buttergolf/db";
import { CategoryScreen } from "@buttergolf/app/features/categories/category-screen";

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  // Fetch data in Server Component
  const category = await db.category.findUnique({
    where: { slug: params.slug },
    include: { courses: true },
  });

  if (!category) return <div>Not found</div>;

  // Pass data to shared screen
  return <CategoryScreen category={category} />;
}
```

## Data Fetching

### Server Components (Preferred)

```tsx
// ✅ CORRECT - Fetch in Server Component
export default async function Page() {
  const data = await db.course.findMany();
  return <CourseList courses={data} />;
}
```

### Server Actions (For Mutations)

```tsx
"use server"; // Mark as Server Action

import { db } from "@buttergolf/db";
import { revalidatePath } from "next/cache";

export async function createBooking(formData: FormData) {
  const courseId = formData.get("courseId") as string;
  const date = formData.get("date") as string;

  const booking = await db.booking.create({
    data: {
      courseId,
      date: new Date(date),
    },
  });

  revalidatePath("/bookings");
  return { success: true, booking };
}
```

```tsx
"use client";

import { createBooking } from "./actions";

export function BookingForm() {
  return (
    <form action={createBooking}>
      <input name="courseId" />
      <input name="date" type="date" />
      <button type="submit">Book</button>
    </form>
  );
}
```

### API Routes (When Needed)

```tsx
// app/api/courses/route.ts
import { db } from "@buttergolf/db";
import { NextResponse } from "next/server";

export async function GET() {
  const courses = await db.course.findMany();
  return NextResponse.json(courses);
}

export async function POST(request: Request) {
  const body = await request.json();
  const course = await db.course.create({
    data: body,
  });
  return NextResponse.json(course);
}
```

## Authentication (Clerk)

### Server-Side Auth

```tsx
// In Server Components
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <div>Welcome, {user.firstName}</div>;
}
```

### Client-Side Auth

```tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { Spinner } from "@buttergolf/ui";

export function UserProfile() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return <Spinner />;
  if (!user) return <div>Please sign in</div>;

  return <div>Welcome, {user.firstName}</div>;
}
```

### Middleware Protection

```typescript
// src/proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/bookings(.*)", "/profile(.*)"]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

## Styling

### Tamagui (Primary Method)

```tsx
import { View, Text, Button } from "@buttergolf/ui";

export function Component() {
  return (
    <View backgroundColor="$background" padding="$md">
      <Text color="$text" size="$5">
        Hello World
      </Text>
      <Button size="$5" backgroundColor="$primary" color="$textInverse">
        Click Me
      </Button>
    </View>
  );
}
```

### Tailwind CSS v4 (For Web-Specific Styling)

```tsx
export function Component() {
  return (
    <div className="bg-vanillaCream p-4">
      <h1 className="text-ironstone text-2xl font-bold">Golf Courses</h1>
    </div>
  );
}
```

### CSS Modules (Avoid if Possible)

Only use for complex web-specific styling that can't be done with Tamagui or Tailwind.

## Component Import Patterns

```tsx
// ✅ CORRECT - Import from @buttergolf packages
import { Button, Text, View } from "@buttergolf/ui";
import { db } from "@buttergolf/db";
import { CategoryScreen } from "@buttergolf/app/features/categories/category-screen";

// ✅ CORRECT - Import web-specific components
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";

// ✅ CORRECT - Use Next.js Image for web
import Image from "next/image";

// ❌ WRONG - Don't use React Native Image on web
import { Image } from "react-native";
```

## Navigation

### Link Component

```tsx
import Link from "next/link";

export function Navigation() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/courses">Courses</Link>
      <Link href="/bookings">Bookings</Link>
    </nav>
  );
}
```

### Programmatic Navigation

```tsx
"use client";

import { useRouter } from "next/navigation";

export function Component() {
  const router = useRouter();

  const handleClick = () => {
    router.push("/bookings");
  };

  return <button onClick={handleClick}>Book Now</button>;
}
```

## Environment Variables

```bash
# .env.local (web-specific)

# Clerk Auth (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database (required)
DATABASE_URL=postgresql://...
POSTGRES_PRISMA_URL=...

# Stripe (required for payments)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudinary (for images)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Vercel (auto-populated in production)
VERCEL_URL=...
```

## Common Patterns

### Loading States

```tsx
// app/courses/loading.tsx
import { Spinner } from "@buttergolf/ui";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="$6" />
    </div>
  );
}
```

### Error Handling

```tsx
// app/courses/error.tsx
"use client";

import { Button } from "@buttergolf/ui";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <Button onPress={reset}>Try again</Button>
    </div>
  );
}
```

### Not Found

```tsx
// app/courses/[slug]/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h2>Course Not Found</h2>
      <Link href="/courses">View all courses</Link>
    </div>
  );
}
```

## Metadata & SEO

```tsx
// app/courses/[slug]/page.tsx
import { Metadata } from "next";
import { db } from "@buttergolf/db";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const course = await db.course.findUnique({
    where: { slug: params.slug },
  });

  return {
    title: course?.name ?? "Course",
    description: course?.description ?? "",
    openGraph: {
      title: course?.name ?? "Course",
      description: course?.description ?? "",
      images: [course?.imageUrl ?? ""],
    },
  };
}

export default async function CoursePage({ params }: { params: { slug: string } }) {
  // ... page content
}
```

## Image Optimization

### Next.js Image

```tsx
import Image from "next/image";

export function CourseCard({ course }) {
  return (
    <div>
      <Image
        src={course.imageUrl}
        alt={course.name}
        width={600}
        height={400}
        className="rounded-lg"
      />
    </div>
  );
}
```

### Cloudinary Integration

```tsx
import { CldImage } from "next-cloudinary";

export function CourseImage({ publicId, alt }) {
  return <CldImage src={publicId} alt={alt} width={600} height={400} crop="fill" gravity="auto" />;
}
```

## Performance Optimization

### Static Site Generation (SSG)

```tsx
// Generate static pages at build time
export async function generateStaticParams() {
  const courses = await db.course.findMany({
    select: { slug: true },
  });

  return courses.map((course) => ({
    slug: course.slug,
  }));
}
```

### Incremental Static Regeneration (ISR)

```tsx
export const revalidate = 3600; // Revalidate every hour

export default async function Page() {
  const courses = await db.course.findMany();
  return <CourseList courses={courses} />;
}
```

### Dynamic Rendering

```tsx
export const dynamic = "force-dynamic"; // Always dynamic

export default async function Page() {
  const courses = await db.course.findMany();
  return <CourseList courses={courses} />;
}
```

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run E2E tests
pnpm test:e2e
```

## Common Issues & Solutions

### Issue: "Hydration mismatch" errors

**Solution**: Ensure Server and Client Components render the same content initially. Avoid using browser-only APIs in Server Components.

### Issue: "Module not found" for @buttergolf packages

**Solution**:

1. Check `next.config.ts` has correct `transpilePackages`
2. Run `pnpm install` at root
3. Restart dev server

### Issue: Middleware not working

**Solution**: Use `src/proxy.ts` NOT `src/middleware.ts` (Next.js 16+ convention)

### Issue: Styles not loading

**Solution**:

1. Check `TamaguiProvider` is in root layout
2. Verify `next.config.ts` webpack aliases for react-native
3. Ensure Tailwind config is correct

### Issue: Database queries failing

**Solution**:

1. Run `pnpm db:generate` to regenerate Prisma Client
2. Check DATABASE_URL in `.env.local`
3. Ensure queries only run in Server Components or API routes
4. **CRITICAL**: Never import from `@prisma/client` directly - always use `@buttergolf/db`

### Issue: "Cannot find module '.prisma/client/default'" error

**Cause**: Direct imports from `@prisma/client` instead of `@buttergolf/db`

**Solution**:

```typescript
// ❌ WRONG - Causes build failures in pnpm monorepos
import { ProductCondition } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// ✅ CORRECT - Always import from @buttergolf/db
import { prisma, ProductCondition } from "@buttergolf/db";
import type { Prisma } from "@buttergolf/db";
```

## Build & Deployment

### Local Build

```bash
# Build the app
pnpm build

# Start production server
pnpm start
```

### Vercel Deployment

1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Set build command: `pnpm turbo run build --filter=web`
4. Set output directory: `apps/web/.next`
5. Deploy

### Environment Variables (Vercel)

Add all variables from `.env.local` to Vercel:

- Production, Preview, and Development environments
- Mark secrets as sensitive
- Use different keys for different environments

## Additional Resources

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [App Router Documentation](https://nextjs.org/docs/app)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Clerk Next.js Guide](https://clerk.com/docs/quickstarts/nextjs)
- [Tamagui with Next.js](https://tamagui.dev/docs/guides/next-js)
