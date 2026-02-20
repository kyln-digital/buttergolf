# @buttergolf/ui

> Production-ready, cross-platform UI component library built with Tamagui

A comprehensive design system for ButterGolf, providing consistent, accessible, and themeable components for both web (Next.js) and mobile (Expo) applications.

## 🚀 Features

- **Cross-Platform**: Works seamlessly on web and mobile
- **Fully Typed**: Complete TypeScript support with type inference
- **Themeable**: Built-in light/dark themes with easy customization
- **Accessible**: WCAG compliant with proper ARIA attributes
- **Performant**: Optimized with Tamagui compiler for minimal bundle size
- **Responsive**: Media query support for responsive layouts
- **Semantic Tokens**: Consistent design language with semantic color and spacing tokens

## 📦 Installation

This package is part of the ButterGolf monorepo and uses the workspace protocol:

```json
{
  "dependencies": {
    "@buttergolf/ui": "workspace:*"
  }
}
```

## 🎨 Theme System

### Tamagui Configuration

**Important**: The Tamagui configuration source of truth lives in `@buttergolf/config`, not `@buttergolf/ui`.

```tsx
// ✅ Correct - Import config from @buttergolf/config
import { config } from "@buttergolf/config";
import { TamaguiProvider } from "@buttergolf/ui";

function App() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      {/* Your app */}
    </TamaguiProvider>
  );
}
```

```tsx
// ❌ Wrong - Config is not exported from @buttergolf/ui
import { config } from "@buttergolf/ui"; // Error: config is not exported!
```

````

### Using Themes

```tsx
import { TamaguiProvider, Theme } from '@buttergolf/ui'
import { config } from '@buttergolf/config'

function App() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      {/* Your app */}
    </TamaguiProvider>
  )
}

// Switch themes dynamically
function ThemedSection() {
  return (
    <Theme name="dark">
      <View backgroundColor="$background">
        <Text color="$color">Dark theme content</Text>
      </View>
    </Theme>
  )
}
````

### Color Tokens

The design system includes semantic color tokens that adapt to light/dark themes:

```tsx
// Brand colors
$primary; // Main brand color (green)
$primaryHover; // Hover state
$primaryPress; // Press state
$secondary; // Secondary brand color (amber)

// Semantic colors
$success; // Success state (teal)
$error; // Error state (red)
$warning; // Warning state (amber)
$info; // Info state (blue)

// Text colors
$text; // Primary text
$textSecondary; // Secondary text
$textMuted; // Muted text

// Background colors
$background; // Main background
$surface; // Surface/card background
$card; // Card background

// Border colors
$border; // Default border
$borderFocus; // Focused border
```

### Spacing Tokens

```tsx
$xs; // 4px
$sm; // 8px
$md; // 16px
$lg; // 24px
$xl; // 32px
$2xl; // 48px
$3xl; // 64px
```

## 🧩 Components

### Button

A versatile button component with multiple variants.

```tsx
import { Button } from '@buttergolf/ui'

// Sizes: sm, md, lg
<Button size="md" tone="primary">
  Click me
</Button>

// Tones: primary, secondary, outline, ghost, success, error
<Button tone="secondary">Secondary</Button>
<Button tone="outline">Outline</Button>

// States
<Button disabled>Disabled</Button>
<Button loading>Loading...</Button>

// Full width
<Button fullWidth>Full Width Button</Button>
```

**Props**:

- `size`: `'sm' | 'md' | 'lg'` - Button size (default: 'md')
- `tone`: `'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'error'` - Button style (default: 'primary')
- `fullWidth`: `boolean` - Make button full width
- `loading`: `boolean` - Show loading state
- `disabled`: `boolean` - Disable button

### Typography

#### Text

```tsx
import { Text } from '@buttergolf/ui'

// Sizes: xs, sm, md, lg, xl
<Text size="md">Regular text</Text>

// Colors: use semantic tokens directly for clarity
<Text color="$text">Default text</Text>
<Text color="$textMuted">Muted text</Text>
<Text color="$primary">Brand accent</Text>

// Weights: normal, medium, semibold, bold
<Text weight="bold">Bold text</Text>

// Alignment
<Text align="center">Centered text</Text>

// Truncation
<Text truncate>Very long text that will be truncated...</Text>
```

#### Heading

```tsx
import { Heading } from '@buttergolf/ui'

// Levels: 1-6 (maps to h1-h6)
<Heading level={1}>Page Title</Heading>
<Heading level={2} color="primary">Section Title</Heading>
```

#### Label

```tsx
import { Label } from '@buttergolf/ui'

<Label htmlFor="email" required>
  Email Address
</Label>
<Input id="email" type="email" />
```

### Layout Components

Use the semantic shims that wrap Tamagui's stack primitives for readability.

#### Row (Horizontal Layout)

```tsx
import { Row } from "@buttergolf/ui";

<Row gap="$4" alignItems="center" justifyContent="space-between">
  <Text>Left</Text>
  <Button>Right</Button>
</Row>;
```

Row preserves all `XStack` props, so continue using native Tamagui layout props with token values.

#### Column (Vertical Layout)

```tsx
import { Column } from "@buttergolf/ui";

<Column gap="$6" alignItems="center">
  <Heading level={2}>Title</Heading>
  <Text>Content</Text>
  <Button>Action</Button>
</Column>;
```

#### Container

```tsx
import { Container } from "@buttergolf/ui";

<Container size="lg" padding="$md">
  <Text>Constrained content</Text>
</Container>;
```

#### Spacer

```tsx
import { Row, Spacer } from "@buttergolf/ui";

<Row>
  <Text>Left</Text>
  <Spacer />
  <Text>Right</Text>
</Row>;
```

### Card

A container component with multiple variants.

```tsx
import { Card, CardHeader, CardBody, CardFooter } from '@buttergolf/ui'

<Card variant="elevated" padding="lg">
  <CardHeader>
    <Heading level={3}>Card Title</Heading>
  </CardHeader>
  <CardBody>
    <Text>Card content goes here</Text>
  </CardBody>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

// Compound component syntax
<Card variant="outlined">
  <Card.Header noBorder>
    <Heading level={4}>No Border</Heading>
  </Card.Header>
  <Card.Body padding="lg">
    <Text>Content</Text>
  </Card.Body>
  <Card.Footer align="center">
    <Button>Centered Action</Button>
  </Card.Footer>
</Card>
```

**Variants**:

- `elevated`: Shadow elevation (default)
- `outlined`: Border with no shadow
- `filled`: Filled background
- `ghost`: Transparent background

### Input

A flexible input component with validation states.

```tsx
import { Input, Label } from '@buttergolf/ui'

<Column gap="sm">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    size="md"
    placeholder="Enter your email"
    fullWidth
  />
</Column>

// Error state
<Input error helperText="This field is required" />

// Success state
<Input success />

// Disabled
<Input disabled value="Disabled input" />
```

**Props**:

- `size`: `'sm' | 'md' | 'lg'` - Input size (default: 'md')
- `error`: `boolean` - Show error state
- `success`: `boolean` - Show success state
- `fullWidth`: `boolean` - Full width
- `disabled`: `boolean` - Disabled state

### Badge

Small label component for status indicators.

```tsx
import { Badge } from '@buttergolf/ui'

<Badge variant="success">Active</Badge>
<Badge variant="error" size="sm">3</Badge>
<Badge variant="info">New</Badge>

// Dot badge
<Badge variant="success" dot />
```

**Variants**:

- `primary`, `secondary`, `success`, `error`, `warning`, `info`, `neutral`, `outline`

### Spinner

Loading indicator component.

```tsx
import { Spinner } from '@buttergolf/ui'

<Spinner size="md" />
<Spinner size="lg" color="$primary" />
<Spinner size="sm" color="$success" />
```

## 📱 Responsive Design

Use media query props for responsive layouts:

```tsx
import { Column } from "@buttergolf/ui";

<Column
  width="100%"
  $sm={{ width: "50%" }} // Greater than small breakpoint
  $md={{ width: "33%" }} // Greater than medium breakpoint
>
  <Text>Responsive content</Text>
</Column>;
```

**Available breakpoints**:

- Min-width keys (bare names):
  - `$2xs`: `min-width: 340px`
  - `$xs`: `min-width: 460px`
  - `$sm`: `min-width: 640px`
  - `$md`: `min-width: 768px`
  - `$lg`: `min-width: 1024px`
  - `$xl`: `min-width: 1280px`
  - `$2xl`: `min-width: 1536px`
- Max-width keys (explicit `max` prefix):
  - `$max2xs`: `max-width: 340px`
  - `$maxXs`: `max-width: 460px`
  - `$maxSm`: `max-width: 640px`
  - `$maxMd`: `max-width: 768px`
  - `$maxLg`: `max-width: 1024px`
  - `$maxXl`: `max-width: 1280px`
  - `$max2Xl`: `max-width: 1536px`

## 🎯 Best Practices

### 1. Use Semantic Tokens

✅ **Good**:

```tsx
<Button backgroundColor="$primary" color="$white">
  Click me
</Button>
```

❌ **Avoid**:

```tsx
<Button backgroundColor="#13a063" color="#ffffff">
  Click me
</Button>
```

### 2. Use Component Variants

✅ **Good**:

```tsx
<Button size="lg" tone="primary">Submit</Button>
<Text size="sm" color="$textMuted">Helper text</Text>
```

❌ **Avoid**:

```tsx
<Button paddingHorizontal="$5" backgroundColor="$primary">Submit</Button>
<Text fontSize="$3" color="$gray500">Helper text</Text>
```

### 3. Leverage Layout Components

✅ **Good**:

```tsx
<Column gap="md" align="stretch">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</Column>
```

❌ **Avoid**:

```tsx
<View flexDirection="column">
  <Text marginBottom="$md">Item 1</Text>
  <Text>Item 2</Text>
</View>
```

### 4. Use Compound Components

✅ **Good**:

```tsx
<Card variant="elevated">
  <Card.Header>
    <Heading level={3}>Title</Heading>
  </Card.Header>
  <Card.Body>
    <Text>Content</Text>
  </Card.Body>
</Card>
```

## 🔧 Extending Components

### Creating Custom Components

```tsx
import { styled, GetProps } from "@buttergolf/ui";
import { Button } from "@buttergolf/ui";

// Extend existing component
export const IconButton = styled(Button, {
  name: "IconButton",

  width: "$buttonMd",
  paddingHorizontal: 0,

  variants: {
    rounded: {
      true: {
        borderRadius: "$full",
      },
    },
  },
});

export type IconButtonProps = GetProps<typeof IconButton>;
```

### Adding Custom Variants

```tsx
import { styled, Text } from "@buttergolf/ui";

export const CustomText = styled(Text, {
  variants: {
    highlight: {
      true: {
        backgroundColor: "$yellow",
        paddingHorizontal: "$2",
      },
    },
  },
});
```

## 🐛 Troubleshooting

### TypeScript Errors with Styled Components

If you see type errors like "cannot be named without a reference", add these to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "declaration": false,
    "declarationMap": false,
    "skipLibCheck": true
  }
}
```

### Components Not Updating

If components don't reflect config changes:

1. Restart dev servers (config isn't hot-reloaded)
2. Clear Metro cache: `pnpm dev:mobile --clear`
3. Clear Next.js cache: `rm -rf .next`

### Missing Tokens

If tokens don't exist, they can be added to `packages/config/src/tamagui.config.ts`:

```tsx
const customTokens = createTokens({
  color: {
    // Add new colors here
    myCustomColor: "#hexvalue",
  },
});
```

## 📚 Related Documentation

- [Tamagui Documentation](https://tamagui.dev/docs)
- [Tamagui Theme Builder](https://tamagui.dev/theme)
- [Component Examples](https://tamagui.dev/ui/button)

## 🤝 Contributing

When adding new components:

1. Create component in `packages/ui/src/components/[ComponentName].tsx`
2. Use `styled()` API with semantic tokens
3. Include size and color variants
4. Add TypeScript types with `GetProps`
5. Export from `packages/ui/src/index.ts`
6. Update this README with usage examples

### Component Template

```tsx
import { styled, GetProps, View } from "tamagui";

export const MyComponent = styled(View, {
  name: "MyComponent",

  // Base styles
  backgroundColor: "$surface",
  padding: "$md",
  borderRadius: "$md",

  variants: {
    size: {
      sm: { padding: "$sm" },
      md: { padding: "$md" },
      lg: { padding: "$lg" },
    },

    variant: {
      default: { backgroundColor: "$surface" },
      primary: { backgroundColor: "$primary" },
    },
  } as const,

  defaultVariants: {
    size: "md",
    variant: "default",
  },
});

export type MyComponentProps = GetProps<typeof MyComponent>;
```

## 📄 License

Part of the ButterGolf monorepo. Private package.
