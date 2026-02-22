# Contributing to ButterGolf

Thank you for your interest in contributing to ButterGolf! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** and clone it locally
2. **Install dependencies**: `pnpm install`
3. **Start development**: `pnpm dev:web` or `pnpm dev:mobile`

## Development Guidelines

### Code Style

We use ESLint and Prettier to maintain consistent code style:

```bash
# Lint your code
pnpm lint

# Format your code
pnpm format

# Type check
pnpm typecheck
```

### Tamagui and Design System

**This project uses Tamagui for cross-platform UI development.**

When working with UI components and styling, please follow our [Tamagui Best Practices](./docs/TAMAGUI_BEST_PRACTICES.md) guide.

**Key principles**:

- ✅ Always use theme tokens (`$colorName`, `$4` for spacing, etc.)
- ✅ Never use hardcoded colors or raw pixel values
- ✅ Import from `@buttergolf/ui` instead of direct `tamagui` imports
- ✅ Create variants for reusable styling patterns
- ✅ Test components on both web and mobile platforms

**Quick examples**:

```tsx
// ✅ Good - Using tokens
<YStack backgroundColor="$bg" padding="$4">
  <Text color="$text" fontSize="$5">Hello</Text>
</YStack>

// ❌ Bad - Hardcoded values
<YStack backgroundColor="#fbfbf9" padding={16}>
  <Text color="#0f1720" fontSize={16}>Hello</Text>
</YStack>
```

**Resources**:

- [Tamagui Best Practices Guide](./docs/TAMAGUI_BEST_PRACTICES.md)
- [Tamagui Documentation](https://tamagui.dev)
- [Component Usage Audit](./docs/TAMAGUI_USAGE_AUDIT.md)

### Database Changes

When modifying the database schema:

```bash
# Generate Prisma Client
pnpm db:generate

# Push changes (development)
pnpm db:push

# Create migration (production-ready)
pnpm db:migrate:dev --name your-migration-name
```

### Testing

Before submitting a PR:

```bash
# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Test your changes on both platforms
pnpm dev:web
pnpm dev:mobile
```

## Monorepo Structure

```
buttergolf/
├── apps/
│   ├── web/          # Next.js web app
│   └── mobile/       # Expo mobile app
├── packages/
│   ├── ui/           # Shared UI components (Tamagui)
│   ├── app/          # Shared app logic and screens
│   ├── config/       # Tamagui configuration
│   ├── db/           # Prisma database client
│   └── ...
└── docs/             # Documentation
```

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** following the guidelines above
3. **Test thoroughly** on both web and mobile (if UI changes)
4. **Run checks**: `pnpm typecheck && pnpm lint`
5. **Write clear commit messages** describing your changes
6. **Submit a PR** with a clear description of what and why

### PR Checklist

- [ ] Code follows style guidelines
- [ ] No hardcoded colors or spacing (uses Tamagui tokens)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Tested on web (if applicable)
- [ ] Tested on mobile (if applicable)
- [ ] Database migrations included (if schema changed)
- [ ] Documentation updated (if needed)

## Common Tasks

### Adding a New UI Component

1. Create component in `packages/ui/src/components/MyComponent.tsx`
2. Follow the [component creation guidelines](./docs/TAMAGUI_BEST_PRACTICES.md#component-creation)
3. Export from `packages/ui/src/index.ts`
4. Add examples and documentation

### Adding a New Screen

1. Create screen in `packages/app/src/features/my-feature/screen.tsx`
2. Use components from `@buttergolf/ui`
3. Test on both web and mobile
4. Add navigation if needed

### Updating the Theme

1. Edit `packages/config/src/tamagui.config.ts`
2. Add new color tokens to the `butterGolfColors` object
3. Document new tokens in [TAMAGUI_BEST_PRACTICES.md](./docs/TAMAGUI_BEST_PRACTICES.md)
4. Run `pnpm typecheck` to ensure no errors

## Questions?

- Check the [documentation](./docs/)
- Review the [Tamagui Best Practices](./docs/TAMAGUI_BEST_PRACTICES.md)
- Open an issue for discussion

## Code of Conduct

Be respectful and constructive in all interactions. We're all here to build great software together!

---

Thank you for contributing to ButterGolf! 🏌️‍♂️
