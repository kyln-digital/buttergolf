# ButterGolf App - Claude Code Instructions

## Overview

This package contains shared cross-platform screens and business logic for ButterGolf. It uses Solito for unified navigation between Next.js (web) and React Navigation (mobile).

## CRITICAL: Platform-Agnostic Code

**Everything in this package MUST work on both web and mobile platforms.**

## Architecture

### Feature-Based Structure

```
packages/app/
├── src/
│   ├── features/
│   │   ├── home/
│   │   │   ├── home-screen.tsx
│   │   │   └── components/
│   │   ├── courses/
│   │   │   ├── course-list-screen.tsx
│   │   │   ├── course-detail-screen.tsx
│   │   │   └── components/
│   │   ├── bookings/
│   │   │   ├── booking-list-screen.tsx
│   │   │   ├── booking-form-screen.tsx
│   │   │   └── components/
│   │   └── categories/
│   │       ├── category-list-screen.tsx
│   │       ├── category-detail-screen.tsx
│   │       └── components/
│   ├── navigation/
│   │   └── routes.ts          # Route definitions
│   ├── hooks/                  # Shared hooks
│   ├── types/                  # Shared types
│   └── index.ts               # Main exports
└── package.json
```

## Navigation with Solito

### Route Definition (Single Source of Truth)

```typescript
// src/navigation/routes.ts

export const routes = {
  home: "/",
  courses: "/courses",
  courseDetail: "/courses/[id]",
  bookings: "/bookings",
  bookingForm: "/bookings/new",
  categories: "/categories",
  categoryDetail: "/category/[slug]",
  profile: "/profile",
} as const;

export type RouteKey = keyof typeof routes;
export type Route = (typeof routes)[RouteKey];
```

### Using Solito Links

```tsx
import { Link } from "solito/link";
import { Text } from "@buttergolf/ui";

export function NavigationExample() {
  return (
    <Link href="/courses">
      <Text color="$primary">View All Courses</Text>
    </Link>
  );
}

// With parameters
<Link href="/courses/123">
  <Text>Course Details</Text>
</Link>

// With query params
<Link href={{ pathname: "/courses", query: { category: "golf" } }}>
  <Text>Golf Courses</Text>
</Link>
```

### Using Solito Navigation Hooks

```tsx
import { useLink } from "solito/navigation";
import { Button } from "@buttergolf/ui";

export function Component() {
  const linkProps = useLink({
    href: "/courses",
  });

  // useLink returns { href, onPress, accessibilityRole }
  // Spread onto Pressable/Button or use onPress directly
  return <Button onPress={linkProps.onPress}>View Courses</Button>;
}

// With parameters
const linkProps = useLink({
  href: `/courses/${courseId}`,
});

// With query params (object form)
const linkProps = useLink({
  href: {
    pathname: "/courses",
    query: { category: "golf" },
  },
});
```

### Reading Route Parameters

**IMPORTANT**: Use `createParam` for type-safe parameters (recommended pattern):

```tsx
// src/navigation/params.ts
import { createParam } from "solito";

// Create typed parameter hook
export const { useParam } = createParam<{ id: string }>();
```

```tsx
// In your screen component
import { useParam } from "../../navigation/params";

export function CourseDetailScreen() {
  const [id] = useParam("id");
  // id is type-safe string | undefined

  return <Text>Course ID: {id}</Text>;
}
```

**Alternative**: Use `useParams` from Solito (less type-safe):

```tsx
import { useParams } from "solito/navigation";

export function CourseDetailScreen() {
  const params = useParams();
  const courseId = params?.id as string;

  return <Text>Course ID: {courseId}</Text>;
}
```

## Screen Component Patterns

### Basic Screen Pattern

```tsx
// src/features/courses/course-list-screen.tsx

import { Column, Text, Button } from "@buttergolf/ui";
import { Link } from "solito/link";

interface Course {
  id: string;
  name: string;
  location: string;
}

interface CourseListScreenProps {
  courses: Course[];
  onRefresh?: () => void;
}

export function CourseListScreen({ courses, onRefresh }: CourseListScreenProps) {
  return (
    <Column gap="$md" padding="$lg">
      <Text size="$10" fontWeight="bold">
        Golf Courses
      </Text>

      {courses.map((course) => (
        <Link key={course.id} href={`/courses/${course.id}`}>
          <Column gap="$sm" padding="$md" backgroundColor="$surface">
            <Text size="$6" fontWeight="600">
              {course.name}
            </Text>
            <Text size="$4" color="$textSecondary">
              {course.location}
            </Text>
          </Column>
        </Link>
      ))}

      {onRefresh && <Button onPress={onRefresh}>Refresh</Button>}
    </Column>
  );
}
```

### Screen with Data Fetching Props

```tsx
// src/features/courses/course-detail-screen.tsx

import { useEffect, useState } from "react";
import { Column, Text, Spinner } from "@buttergolf/ui";
import { useParam } from "../../navigation/params"; // Using createParam

interface Course {
  id: string;
  name: string;
  description: string;
  holes: number;
}

interface CourseDetailScreenProps {
  // Option 1: Pass data directly
  course?: Course;

  // Option 2: Pass fetch function
  onFetchCourse?: (id: string) => Promise<Course>;
}

export function CourseDetailScreen({
  course: initialCourse,
  onFetchCourse,
}: CourseDetailScreenProps) {
  const [courseId] = useParam("id"); // Type-safe parameter reading

  const [course, setCourse] = useState<Course | null>(initialCourse || null);
  const [loading, setLoading] = useState(!initialCourse);

  useEffect(() => {
    if (initialCourse || !onFetchCourse) return;

    setLoading(true);
    onFetchCourse(courseId)
      .then(setCourse)
      .finally(() => setLoading(false));
  }, [courseId, onFetchCourse, initialCourse]);

  if (loading) {
    return <Spinner size="$6" />;
  }

  if (!course) {
    return <Text>Course not found</Text>;
  }

  return (
    <Column gap="$lg" padding="$lg">
      <Text size="$10" fontWeight="bold">
        {course.name}
      </Text>
      <Text size="$5" color="$text">
        {course.description}
      </Text>
      <Text size="$4" color="$textSecondary">
        {course.holes} holes
      </Text>
    </Column>
  );
}
```

## Platform Integration

### Web (Next.js)

```tsx
// apps/web/src/app/courses/[id]/page.tsx

import { db } from "@buttergolf/db";
import { CourseDetailScreen } from "@buttergolf/app/features/courses/course-detail-screen";

export default async function CoursePage({ params }: { params: { id: string } }) {
  // Fetch data in Server Component
  const course = await db.course.findUnique({
    where: { id: params.id },
    include: { holes: true },
  });

  if (!course) {
    return <div>Not found</div>;
  }

  // Pass data to shared screen
  return <CourseDetailScreen course={course} />;
}
```

### Mobile (Expo)

```tsx
// apps/mobile/App.tsx

import { useState, useEffect } from "react";
import { CourseDetailScreen } from "@buttergolf/app/features/courses/course-detail-screen";

function CourseDetailWrapper({ route }) {
  const [course, setCourse] = useState(null);

  useEffect(() => {
    fetch(`https://api.buttergolf.com/courses/${route.params.id}`)
      .then((res) => res.json())
      .then(setCourse);
  }, [route.params.id]);

  return <CourseDetailScreen course={course} />;
}

// In Stack Navigator
<Stack.Screen name="CourseDetail">
  {({ route }) => <CourseDetailWrapper route={route} />}
</Stack.Screen>;
```

## Component Patterns

### Using Tamagui Components

```tsx
import { Column, Row, Text, Button, Card, Input, Spinner } from "@buttergolf/ui";

export function Component() {
  return (
    <Column gap="$md" padding="$lg">
      <Card variant="elevated" padding="md">
        <Text size="$6" fontWeight="600">
          Title
        </Text>
        <Text size="$4" color="$textSecondary">
          Description
        </Text>
      </Card>

      <Input size="$5" placeholder="Enter text" />

      <Row gap="$sm">
        <Button size="$5" backgroundColor="$primary">
          Submit
        </Button>
        <Button size="$5" chromeless>
          Cancel
        </Button>
      </Row>
    </Column>
  );
}
```

### State Management

```tsx
import { useState } from "react";
import { Column, Input, Button, Text } from "@buttergolf/ui";

export function BookingFormScreen() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [players, setPlayers] = useState(1);

  const handleSubmit = () => {
    console.log({ date, time, players });
  };

  return (
    <Column gap="$md" padding="$lg">
      <Input size="$5" placeholder="Date" value={date} onChangeText={setDate} />
      <Input size="$5" placeholder="Time" value={time} onChangeText={setTime} />
      <Input
        size="$5"
        placeholder="Players"
        value={String(players)}
        onChangeText={(text) => setPlayers(Number(text))}
      />
      <Button onPress={handleSubmit}>Book Tee Time</Button>
    </Column>
  );
}
```

## Custom Hooks

### Creating Shared Hooks

```tsx
// src/hooks/use-courses.ts

import { useState, useEffect } from "react";

interface Course {
  id: string;
  name: string;
  location: string;
}

export function useCourses(fetchFn?: () => Promise<Course[]>) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fetchFn) return;

    setLoading(true);
    fetchFn()
      .then(setCourses)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [fetchFn]);

  return { courses, loading, error };
}
```

### Using Custom Hooks

```tsx
import { useCourses } from "@buttergolf/app/hooks/use-courses";
import { Column, Spinner, Text } from "@buttergolf/ui";

interface CourseListScreenProps {
  onFetchCourses?: () => Promise<Course[]>;
}

export function CourseListScreen({ onFetchCourses }: CourseListScreenProps) {
  const { courses, loading, error } = useCourses(onFetchCourses);

  if (loading) return <Spinner size="$6" />;
  if (error) return <Text color="$error">{error.message}</Text>;

  return (
    <Column gap="$md">
      {courses.map((course) => (
        <Text key={course.id}>{course.name}</Text>
      ))}
    </Column>
  );
}
```

## Type Definitions

```typescript
// src/types/course.ts

export interface Course {
  id: string;
  name: string;
  location: string;
  description: string;
  holes: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseWithHoles extends Course {
  holes: Hole[];
}

export interface Hole {
  id: string;
  number: number;
  par: number;
  yardage: number;
  courseId: string;
}
```

## Exporting from Package

```typescript
// src/index.ts

// Screens
export { HomeScreen } from "./features/home/home-screen";
export { CourseListScreen } from "./features/courses/course-list-screen";
export { CourseDetailScreen } from "./features/courses/course-detail-screen";
export { BookingFormScreen } from "./features/bookings/booking-form-screen";

// Hooks
export { useCourses } from "./hooks/use-courses";
export { useBookings } from "./hooks/use-bookings";

// Types
export type { Course, Hole } from "./types/course";
export type { Booking } from "./types/booking";

// Routes
export { routes } from "./navigation/routes";
export type { RouteKey, Route } from "./navigation/routes";
```

## Critical Rules

### ✅ DO

- Use Tamagui components exclusively
- Use Solito for navigation (`Link`, `useLink`, `useParams`)
- Accept data as props or fetch functions
- Keep screens platform-agnostic
- Use semantic color tokens (`$text`, `$primary`, etc.)
- Use numeric size tokens (`$5`, `$6`, etc.)
- Export all screens, hooks, and types
- Use TypeScript for type safety

### ❌ DON'T

- Don't use Next.js-specific APIs (`next/image`, `next/navigation`)
- Don't use React Native-specific APIs without platform checks
- Don't fetch data directly in screens (pass as props)
- Don't access database directly (use API endpoints)
- Don't use HTML elements (`<div>`, `<button>`, etc.)
- Don't use web-only libraries
- Don't use mobile-only libraries without checks
- Don't use Expo Router (we use React Navigation + Solito)

## Platform-Specific Code (When Necessary)

```tsx
import { Platform } from "react-native";
import { Text } from "@buttergolf/ui";

export function Component() {
  return <Text>Platform: {Platform.OS === "web" ? "Web" : "Mobile"}</Text>;
}

// Conditional imports
const ImagePicker = Platform.OS !== "web" ? require("expo-image-picker").ImagePicker : null;
```

## Common Patterns

### List Screen

```tsx
export function ListScreen({ items, onItemPress }) {
  return (
    <Column gap="$md" padding="$lg">
      {items.map((item) => (
        <Button key={item.id} onPress={() => onItemPress(item)}>
          <Text>{item.name}</Text>
        </Button>
      ))}
    </Column>
  );
}
```

### Detail Screen

```tsx
export function DetailScreen({ item }) {
  return (
    <Column gap="$lg" padding="$lg">
      <Text size="$10" fontWeight="bold">
        {item.name}
      </Text>
      <Text size="$5">{item.description}</Text>
    </Column>
  );
}
```

### Form Screen

```tsx
export function FormScreen({ onSubmit }) {
  const [formData, setFormData] = useState({});

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Column gap="$md" padding="$lg">
      <Input
        size="$5"
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
      />
      <Button onPress={handleSubmit}>Submit</Button>
    </Column>
  );
}
```

### Loading State

```tsx
export function Screen({ data, loading }) {
  if (loading) {
    return <Spinner size="$6" />;
  }

  return <Text>{data.name}</Text>;
}
```

### Error State

```tsx
export function Screen({ error }) {
  if (error) {
    return (
      <Column gap="$md" padding="$lg">
        <Text color="$error" size="$6">
          Error: {error.message}
        </Text>
        <Button onPress={() => window.location.reload()}>Retry</Button>
      </Column>
    );
  }

  return <Text>Content</Text>;
}
```

## Best Practices

### Data Flow

1. **Web**: Fetch in Server Component, pass to shared screen
2. **Mobile**: Fetch in wrapper component, pass to shared screen
3. **Shared Screen**: Receives data as props, focuses on UI

### Component Composition

```tsx
// ✅ CORRECT - Composable screens
export function CourseListScreen({ courses }) {
  return (
    <Column>
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </Column>
  );
}

function CourseCard({ course }) {
  return (
    <Card>
      <Text>{course.name}</Text>
    </Card>
  );
}
```

### Type Safety

```tsx
// Always define prop interfaces
interface ScreenProps {
  data: Course[];
  onRefresh?: () => void;
  loading?: boolean;
}

export function Screen({ data, onRefresh, loading }: ScreenProps) {
  // Implementation
}
```

## Additional Resources

- [Solito Documentation](https://solito.dev)
- [Tamagui Documentation](https://tamagui.dev)
- [React Native Documentation](https://reactnative.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
