# ButterGolf UI - Claude Code Instructions

## Overview

This is the cross-platform UI component library for ButterGolf, built with Tamagui. It provides consistent, performant components that work on both web and mobile platforms.

## Package Type

- **Type**: Source-first library (no build step)
- **Main**: `src/index.ts`
- **Exports**: `./src/index.ts`
- **Platform**: Cross-platform (web + mobile)

## Architecture

### Component Families

We have **8 hardened component families** (~1,500 lines of production code):

1. **Button** - Standard Tamagui Button with numeric size tokens
2. **Typography** - Text, Heading (h1-h6), Label
3. **Layout** - Row, Column, Container, Spacer
4. **Card** - 4 variants with compound components
5. **Input** - 3 sizes with validation states
6. **Badge** - 8 variants for status indicators
7. **Spinner** - Loading indicators
8. **Image & ScrollView** - Enhanced re-exports

### Directory Structure

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── button.tsx
│   │   ├── typography.tsx
│   │   ├── layout.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── spinner.tsx
│   │   └── image.tsx
│   └── index.ts              # Main exports
├── tamagui.config.ts         # Re-export of config
└── package.json
```

## Design System Tokens

### Color Token System

#### Semantic Tokens (USE IN APP CODE - 99% of cases)

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
$borderHover; // Hover state
$borderFocus; // Focus state

// Brand
$primary; // Primary brand color
$secondary; // Secondary brand color

// Status
$success; // Positive actions
$error; // Error states
$warning; // Warning states
$info; // Informational states
```

#### Brand Tokens (USE IN COMPONENT LIBRARY ONLY)

```tsx
// Primary colors
$spicedClementine: #F45314  // Main brand orange
$vanillaCream: #FFFAD2      // Light background
$burntOlive: #3E3B2C        // Dark accent
$lemonHaze: #EDECC3         // Subtle accent

// Neutrals
$cloudMist: #EDEDED         // Borders
$slateSmoke: #545454        // Secondary text
$ironstone: #323232         // Primary text
$pureWhite: #FFFFFF         // Base white
```

### Size Tokens (Numeric Scale)

**CRITICAL**: Tamagui uses **numeric tokens** ($1-$16) for sizing, NOT named tokens like "sm", "md", "lg".

#### Font Size Scale ($1-$16)

```tsx
$1: 11px   // Legal text
$2: 12px   // Captions
$3: 13px   // Small labels
$4: 14px   // Small body text
$5: 15px   // DEFAULT body text
$6: 16px   // Large body text
$7: 18px   // Subheadings
$8: 20px   // Large subheadings
$9: 22px   // Small headings
$10: 24px  // Medium headings
$11: 28px  // Large headings
$12: 32px  // XL headings
$13+: 40px+ // Hero text
```

#### Component Size Scale ($1-$16)

Same numeric scale controls component dimensions (height, padding, etc.)

### Spacing Tokens

```tsx
$xs: 4px
$sm: 8px
$md: 16px
$lg: 24px
$xl: 32px
$2xl: 48px
$3xl: 64px
```

### Radius Tokens

```tsx
$xs: 3px
$sm: 6px
$md: 10px
$lg: 14px
$xl: 18px
$2xl: 26px
$full: 9999px  // Perfect circles
```

## Component Usage Patterns

### Button Component

**ALWAYS use standard Tamagui Button with numeric size tokens and direct props**

```tsx
import { Button } from "@buttergolf/ui";

// ✅ CORRECT - Numeric size tokens with direct styling props
<Button
  size="$5"
  backgroundColor="$primary"
  color="$textInverse"
  paddingHorizontal="$6"
  borderRadius="$full"
>
  Primary Button
</Button>

<Button
  size="$4"
  backgroundColor="transparent"
  borderWidth={2}
  borderColor="$primary"
  color="$primary"
>
  Secondary Button
</Button>

<Button size="$4" chromeless>
  Ghost Button
</Button>

// ❌ WRONG - Don't use custom variants (we removed them)
<Button size="lg" tone="primary">Submit</Button>

// ❌ WRONG - Don't use named sizes
<Button size="medium">Submit</Button>
```

### Typography Components

**Use `size` prop with numeric tokens ($1-$16)**

```tsx
import { Text, Heading, Label, Paragraph } from "@buttergolf/ui";

// ✅ CORRECT - Use size prop with numeric tokens
<Text size="$5" color="$text">Body text (15px)</Text>
<Text size="$4" color="$textSecondary">Small text (14px)</Text>
<Text size="$7" fontWeight="600">Subheading (18px)</Text>

<Heading level={1} size="$12">Page Title (32px)</Heading>
<Heading level={2} size="$10">Section Title (24px)</Heading>
<Heading level={3} size="$8">Subsection (20px)</Heading>

<Label htmlFor="email" size="$4">Email Address</Label>

<Paragraph size="$5">
  Body paragraph text with default styling
</Paragraph>

// ❌ WRONG - Don't use fontSize prop
<Text fontSize="$5">Wrong!</Text>

// ❌ WRONG - Don't use named sizes
<Text size="md">Wrong!</Text>
<Text size="$md">Wrong!</Text>  // $md is spacing, not font size
```

**Understanding `size` for Text:**

- The `size` prop on Text/SizableText/Paragraph uses Tamagui's standard numbered scale
- Each size maps to a specific font size and line height
- This is the official Tamagui pattern for typography sizing

### Layout Components

**Use native Tamagui props directly (gap, padding, alignItems, etc.)**

```tsx
import { Row, Column, Container, Spacer } from "@buttergolf/ui";

// ✅ CORRECT - Use native Tamagui props
<Column gap="$lg" padding="$md">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</Column>

<Row gap="$md" alignItems="center" justifyContent="space-between">
  <Text>Left</Text>
  <Button>Right</Button>
</Row>

<Container size="lg" paddingHorizontal="$md">
  <Text>Constrained content</Text>
</Container>

<Spacer size="$lg" />

// ❌ WRONG - Don't use YStack/XStack when semantic components exist
<YStack gap="$6">
  <Text>Content</Text>
</YStack>
```

**Note**: Row and Column preserve ALL native Tamagui props (alignItems, justifyContent, flexWrap, etc.)

### Card Component

**Use compound components pattern**

```tsx
import { Card } from "@buttergolf/ui";

// ✅ CORRECT - Compound components
<Card variant="elevated" padding="lg">
  <Card.Header>
    <Heading level={3}>Card Title</Heading>
    <Text color="$textSecondary">Subtitle</Text>
  </Card.Header>
  <Card.Body>
    <Text>Card content goes here</Text>
  </Card.Body>
  <Card.Footer align="right">
    <Button>Action</Button>
  </Card.Footer>
</Card>

// Variants: elevated, outlined, filled, ghost
<Card variant="outlined" padding="md">
  <Text>Outlined card</Text>
</Card>
```

### Input Component

```tsx
import { Input } from "@buttergolf/ui";

// ✅ CORRECT - Numeric size tokens
<Input
  size="$5"
  placeholder="Enter email"
  value={email}
  onChangeText={setEmail}
/>

<Input
  size="$5"
  error
  placeholder="Invalid email"
  helperText="Please enter a valid email"
/>

<Input
  size="$5"
  success
  placeholder="Valid email"
/>

<Input
  size="$4"
  disabled
  placeholder="Disabled input"
/>

<Input
  size="$5"
  fullWidth
  placeholder="Full width"
/>
```

### Badge Component

```tsx
import { Badge } from "@buttergolf/ui";

// Variants: primary, secondary, success, error, warning, info, neutral, ghost
<Badge variant="primary" size="$3">New</Badge>
<Badge variant="success" size="$3">Active</Badge>
<Badge variant="error" size="$3">Expired</Badge>
<Badge variant="warning" size="$3">Pending</Badge>
```

### Spinner Component

```tsx
import { Spinner } from "@buttergolf/ui";

<Spinner size="$4" />
<Spinner size="$6" color="$primary" />
```

## Creating New Components

### Pattern: Re-export from Tamagui

```tsx
// src/components/button.tsx
export { Button } from "@tamagui/button";
export type { ButtonProps } from "@tamagui/button";
```

### Pattern: Styled Component

```tsx
import { styled, View } from "tamagui";

export const Card = styled(View, {
  name: "Card", // Required for compiler optimization
  backgroundColor: "$surface",
  borderRadius: "$lg",
  padding: "$md",

  // Variants for fixed semantic options
  variants: {
    variant: {
      elevated: {
        shadowColor: "$shadowColor",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      outlined: {
        borderWidth: 1,
        borderColor: "$border",
      },
    },
    padding: {
      sm: { padding: "$sm" },
      md: { padding: "$md" },
      lg: { padding: "$lg" },
    },
  },

  defaultVariants: {
    variant: "elevated",
    padding: "md",
  },
});
```

### Pattern: Compound Components

```tsx
import { createStyledContext } from "@tamagui/core";

const CardContext = createStyledContext({
  variant: "elevated" as const,
});

export const Card = styled(View, {
  name: "Card",
  context: CardContext,
  // ... styles
});

export const CardHeader = styled(View, {
  name: "CardHeader",
  context: CardContext,
  padding: "$md",
  borderBottomWidth: 1,
  borderBottomColor: "$border",
});

export const CardBody = styled(View, {
  name: "CardBody",
  context: CardContext,
  padding: "$md",
});

export const CardFooter = styled(View, {
  name: "CardFooter",
  context: CardContext,
  padding: "$md",
  borderTopWidth: 1,
  borderTopColor: "$border",

  variants: {
    align: {
      left: { justifyContent: "flex-start" },
      center: { justifyContent: "center" },
      right: { justifyContent: "flex-end" },
    },
  },
});

// Attach as compound components
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
```

## Critical Rules

### ✅ DO

- Use semantic color tokens in app code (`$text`, `$primary`, `$background`)
- Use numeric size tokens (`$1`-`$16`) for Text and components
- Use direct token props for styling (gap, padding, backgroundColor, etc.)
- Re-export from Tamagui packages when possible
- Use `styled()` factory for custom components
- Add `name` prop to styled components for optimization
- Use compound components for complex UI patterns
- Export both components and their types

### ❌ DON'T

- Don't use brand tokens in app code (reserve for component library)
- Don't use named size variants ("sm", "md", "lg") - use numeric tokens
- Don't use `fontSize` prop on Text - use `size` prop
- Don't create variants for props that exist natively on base component
- Don't use raw hex colors - always use tokens
- Don't create HTML button elements - use Tamagui Button
- Don't use numbered color tokens (`$color11`) - use semantic tokens
- Don't use default exports - use named exports only

## Token Usage Guidelines

| Context                | Use This                           | Not This                       | Reason                                 |
| ---------------------- | ---------------------------------- | ------------------------------ | -------------------------------------- |
| **App code (99%)**     | `$primary`, `$text`, `$background` | `$spicedClementine`, `#F45314` | Semantic tokens enable theme switching |
| **Component defaults** | `$ironstone`, `$vanillaCream`      | Direct hex values              | Brand tokens are foundation            |
| **Font sizes**         | `size="$5"` on Text                | `fontSize="$5"` or `size="md"` | Standard Tamagui pattern               |
| **Component sizes**    | `size="$4"` on Button              | `size="medium"`                | Numeric tokens are standard            |
| **Layout spacing**     | `gap="$md"`, `padding="$lg"`       | `gap="md"` (without $)         | Direct token references                |

## Understanding Size - Two Different Meanings

**CRITICAL**: The word "size" has TWO completely different meanings:

### 1️⃣ Font Size (Text/Typography)

```tsx
// ✅ CORRECT - size prop with numeric tokens
<Text size="$5">Body text (15px)</Text>
<Heading level={2} size="$10">Section (24px)</Heading>

// ❌ WRONG
<Text fontSize="$5">Wrong!</Text>  // Use size, not fontSize
<Text size="md">Wrong!</Text>       // No named sizes
```

### 2️⃣ Component Size (Button/Input/Badge)

```tsx
// ✅ CORRECT - size prop with numeric tokens
<Button size="$5">Click me</Button>
<Input size="$5" />
<Badge size="$3">NEW</Badge>

// ❌ WRONG
<Button size="medium">Wrong!</Button>  // No named sizes
```

Both use the same `size` prop name, but control different aspects:

- **Text**: Font size and line height
- **Components**: Height, padding, and dimensions

## Theme Support

### Using Theme Component for State-Based Styling

```tsx
import { Theme } from "tamagui";

// ✅ CORRECT - Use Theme for state-based styling
<Theme name={isActive ? "active" : null}>
  <Text>Menu Item</Text>  {/* Gets active theme colors */}
</Theme>

// Available sub-themes: active, error, success, warning
<Theme name="error">
  <Text>Error message</Text>
</Theme>

// ❌ WRONG - Don't use conditional variants
<Text color={isActive ? "primary" : "default"}>Menu</Text>
```

## Exporting Components

```tsx
// src/index.ts

// Button
export { Button } from "./components/button";
export type { ButtonProps } from "./components/button";

// Typography
export { Text, Heading, Label, Paragraph } from "./components/typography";
export type { TextProps, HeadingProps, LabelProps, ParagraphProps } from "./components/typography";

// Layout
export { Row, Column, Container, Spacer } from "./components/layout";
export type { RowProps, ColumnProps, ContainerProps, SpacerProps } from "./components/layout";

// Card
export { Card } from "./components/card";
export type { CardProps } from "./components/card";

// ... more exports
```

## Platform Compatibility

### Cross-Platform Components

All components in this package MUST work on both web and mobile:

```tsx
// ✅ CORRECT - Cross-platform
import { View, Text, Button } from "tamagui";

// ❌ WRONG - Platform-specific
import { Image } from "next/image"; // Web-only
import { FlatList } from "react-native"; // Mobile-only (unless wrapped)
```

### Platform Checks (When Necessary)

```tsx
import { Platform } from "react-native";

export const Component = styled(View, {
  name: "Component",
  padding: "$md",

  ...(Platform.OS === "web" && {
    cursor: "pointer",
  }),
});
```

## Performance Optimization

### Compiler Optimization

```tsx
// Always add name prop for compiler optimization
export const Card = styled(View, {
  name: "Card", // Required for Tamagui compiler
  // ... styles
});
```

### Memoization

```tsx
import { memo } from "react";

export const CourseCard = memo(({ course }) => {
  return (
    <Card>
      <Text>{course.name}</Text>
    </Card>
  );
});
```

## Special Effects

### GlassmorphismCard - iOS Liquid Glass Effect

A standardized component for applying iOS-style glassmorphism effects throughout the app.

```tsx
import { GlassmorphismCard, getGlassmorphismStyles } from "@buttergolf/ui";

// ✅ CORRECT - Using the GlassmorphismCard component
<GlassmorphismCard intensity="medium" padding="$md">
  <Text>Content with glassmorphism effect</Text>
</GlassmorphismCard>

// ✅ CORRECT - Using getGlassmorphismStyles helper for web-specific styling
<div
  style={{
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: "20px",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    ...getGlassmorphismStyles("medium"),
  }}
>
  <Text>Content</Text>
</div>
```

**Features:**

- Backdrop blur (frosted glass effect)
- Semi-transparent background
- Curved corners (`$2xl` = 26px radius)
- Inner shadows for dimensional appearance
- Subtle border with transparency

**Intensity Variants:**

- `light` - 20% opacity, subtle effect
- `medium` - 40% opacity, balanced (default)
- `strong` - 60% opacity, more opaque
- `dark` - 30% black opacity with lighter border

**Blur Variants:**

- `light` - 10px blur
- `medium` - 20px blur (default)
- `strong` - 30px blur

**When to Use:**

- Navigation bars that need to float over content
- Information overlays on images (product cards)
- Modal dialogs with see-through backgrounds
- Status bars and headers
- Floating action buttons or panels

**Example - Product Card Overlay:**

```tsx
<div style={{ position: "relative" }}>
  <img src={product.image} />
  <div
    style={{
      position: "absolute",
      bottom: "12px",
      left: "12px",
      right: "12px",
      backgroundColor: "rgba(255, 255, 255, 0.4)",
      borderRadius: "20px",
      padding: "16px",
      border: "1px solid rgba(255, 255, 255, 0.3)",
      ...getGlassmorphismStyles("medium"),
    }}
  >
    <Text>{product.title}</Text>
    <Text>£{product.price}</Text>
  </div>
</div>
```

**Example - Navigation Bar:**

```tsx
<Row backgroundColor="transparent" paddingVertical="$3">
  <Row
    maxWidth={1280}
    backgroundColor="rgba(255, 255, 255, 0.4)"
    borderRadius="$2xl"
    paddingHorizontal="$6"
    paddingVertical="$3"
    borderWidth={1}
    borderColor="rgba(255, 255, 255, 0.3)"
    style={{
      ...getGlassmorphismStyles("medium"),
    }}
  >
    {/* Nav items */}
  </Row>
</Row>
```

## Common Issues & Solutions

### Issue: TypeScript errors with variants

**Solution**: Don't create variants for props that exist natively on the base component. Use direct props instead.

```tsx
// ❌ WRONG - Creates intersection type errors
const Row = styled(XStack, {
  variants: {
    gap: {
      md: { gap: "$md" },
    },
  },
});

// ✅ CORRECT - Use native props directly
<XStack gap="$md">Content</XStack>;
```

### Issue: Components not rendering

**Solution**: Ensure TamaguiProvider wraps the app and config is imported correctly.

### Issue: Styles not applying

**Solution**:

1. Check token prefix ($) is included
2. Verify token exists in theme config
3. Check Tamagui babel plugin is configured

## Additional Resources

- [Tamagui Documentation](https://tamagui.dev)
- [Tamagui Themes](https://tamagui.dev/docs/intro/themes)
- [Tamagui Tokens](https://tamagui.dev/docs/intro/tokens)
- [Styled Factory](https://tamagui.dev/docs/core/styled)
