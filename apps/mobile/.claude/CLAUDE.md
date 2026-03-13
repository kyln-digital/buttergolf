# ButterGolf Mobile - Claude Code Instructions

## Overview

This is the Expo mobile application for ButterGolf, supporting both iOS and Android platforms. It uses React Navigation (NOT Expo Router) and integrates with shared packages from the monorepo.

## Framework & Version

- **Framework**: Expo ~54.0.20
- **React Native**: 0.81.5
- **React**: 19.1.0
- **Navigation**: React Navigation (NOT Expo Router)
- **Bundler**: Metro

## CRITICAL: This is NOT Expo Router

**This app uses React Navigation with manual screen registration in App.tsx**

❌ **DO NOT**:

- Create `app/` directory for routing
- Expect file-based routing
- Use Expo Router APIs

✅ **DO**:

- Register all screens in `App.tsx`
- Use React Navigation Stack Navigator
- Define linking configuration manually
- Use Solito for cross-platform navigation

## Directory Structure

```
apps/mobile/
├── App.tsx              # Entry point (NOT app/ directory)
├── src/
│   ├── components/      # Mobile-specific components
│   ├── screens/         # Mobile-specific screens (if any)
│   ├── navigation/      # Navigation configuration
│   └── lib/             # Utilities & helpers
├── assets/              # Images, fonts, etc.
├── metro.config.js      # Metro bundler config
├── babel.config.js      # Babel config with Tamagui plugin
└── app.json             # Expo configuration
```

## Navigation Setup

### App.tsx Structure

```tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TamaguiProvider } from "tamagui";
import { config } from "@buttergolf/config";

// Import shared screens from @buttergolf/app
import { HomeScreen } from "@buttergolf/app/features/home/home-screen";
import { CategoryScreen } from "@buttergolf/app/features/categories/category-screen";

const Stack = createNativeStackNavigator();

// Linking configuration (maps URLs to screens)
const linking = {
  prefixes: ["buttergolf://"],
  config: {
    screens: {
      Home: "",
      Category: "category/:slug",
      // Add all routes here
    },
  },
};

export default function App() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <NavigationContainer linking={linking}>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Category" component={CategoryScreen} />
          {/* Register all screens here */}
        </Stack.Navigator>
      </NavigationContainer>
    </TamaguiProvider>
  );
}
```

### Adding a New Screen

1. **Import the shared screen** from `@buttergolf/app`:

   ```tsx
   import { NewScreen } from "@buttergolf/app/features/[feature]/new-screen";
   ```

2. **Add to linking config**:

   ```tsx
   const linking = {
     config: {
       screens: {
         NewScreen: { path: "new-route/:param" },
       },
     },
   };
   ```

3. **Register in Stack Navigator**:
   ```tsx
   <Stack.Screen name="NewScreen">
     {({ route }) => <NewScreen param={route.params?.param} onFetchData={fetchDataFunction} />}
   </Stack.Screen>
   ```

## Navigation Patterns

### Using Solito Links

```tsx
import { Link } from "solito/link";
import { Text } from "@buttergolf/ui";

export function Component() {
  return (
    <Link href="/category/golf-courses">
      <Text>View Courses</Text>
    </Link>
  );
}
```

### Programmatic Navigation

```tsx
import { useLink } from "solito/navigation";

export function Component() {
  const link = useLink({
    href: "/category/golf-courses",
  });

  return <Button onPress={link.onPress}>View Courses</Button>;
}
```

### React Navigation Hooks (When Needed)

```tsx
import { useNavigation } from "@react-navigation/native";

export function Component() {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate("Category", { slug: "golf-courses" });
  };

  return <Button onPress={handlePress}>Go</Button>;
}
```

## Component Patterns

### Screen Components

```tsx
// Use shared screens from @buttergolf/app
import { CourseListScreen } from "@buttergolf/app/features/courses/course-list-screen";
import { useState, useEffect } from "react";

export function CoursesScreenWrapper() {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    // Fetch data from API
    fetch("https://api.buttergolf.com/courses")
      .then((res) => res.json())
      .then(setCourses);
  }, []);

  return <CourseListScreen courses={courses} />;
}
```

### Tamagui Components

```tsx
import { View, Text, Button, Column, Row } from "@buttergolf/ui";

export function Component() {
  return (
    <Column gap="$md" padding="$lg">
      <Text size="$7" fontWeight="bold" color="$text">
        Welcome to ButterGolf
      </Text>
      <Button size="$5" backgroundColor="$primary" color="$textInverse">
        Book a Tee Time
      </Button>
    </Column>
  );
}
```

### Platform-Specific Code

```tsx
import { Platform } from "react-native";
import { Text } from "@buttergolf/ui";

export function Component() {
  return <Text>{Platform.OS === "ios" ? "iOS Specific" : "Android Specific"}</Text>;
}
```

## Data Fetching

### Fetch from API

```tsx
import { useState, useEffect } from "react";

export function useCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://api.buttergolf.com/courses")
      .then((res) => res.json())
      .then((data) => {
        setCourses(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return { courses, loading };
}
```

### Using React Query (Recommended)

```tsx
import { useQuery } from "@tanstack/react-query";

export function useCourses() {
  return useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const res = await fetch("https://api.buttergolf.com/courses");
      return res.json();
    },
  });
}
```

## Authentication (Clerk)

### Setup in App.tsx

```tsx
import { ClerkProvider } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

export default function App() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <TamaguiProvider config={config}>{/* Navigation */}</TamaguiProvider>
    </ClerkProvider>
  );
}
```

### Using Auth in Components

```tsx
import { useUser, useAuth } from "@clerk/clerk-expo";
import { Spinner } from "@buttergolf/ui";

export function ProfileScreen() {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();

  if (!isLoaded) return <Spinner />;
  if (!user) return <Text>Please sign in</Text>;

  return (
    <Column gap="$md">
      <Text>Welcome, {user.firstName}</Text>
      <Button onPress={() => signOut()}>Sign Out</Button>
    </Column>
  );
}
```

## Styling

### Tamagui Only (No Tailwind)

```tsx
import { View, Text, Button } from "@buttergolf/ui";

export function Component() {
  return (
    <View backgroundColor="$background" padding="$md" borderRadius="$lg">
      <Text color="$text" size="$5">
        Hello Mobile World
      </Text>
      <Button size="$5" backgroundColor="$primary" color="$textInverse">
        Click Me
      </Button>
    </View>
  );
}
```

### Responsive Design

```tsx
import { useMedia } from "tamagui";

export function Component() {
  const media = useMedia();

  return (
    <View width="100%" padding={media.md ? "$lg" : "$md"}>
      <Text>Responsive content</Text>
    </View>
  );
}
```

## Native Features

### Camera

```tsx
import * as ImagePicker from "expo-image-picker";

export function useCamera() {
  const takePicture = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      return result.assets[0].uri;
    }
  };

  return { takePicture };
}
```

### Location

```tsx
import * as Location from "expo-location";

export function useLocation() {
  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Permission denied");
    }

    const location = await Location.getCurrentPositionAsync({});
    return location;
  };

  return { getLocation };
}
```

### Push Notifications

```tsx
import * as Notifications from "expo-notifications";

export function useNotifications() {
  const registerForPushNotifications = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      throw new Error("Permission denied");
    }

    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  };

  return { registerForPushNotifications };
}
```

## Environment Variables

```bash
# .env (mobile-specific)

# Clerk Auth (required)
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# API Endpoint (required)
EXPO_PUBLIC_API_URL=https://api.buttergolf.com

# Stripe (required for payments)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Environment
EXPO_PUBLIC_ENV=development
```

## Metro Configuration

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo
config.watchFolders = [workspaceRoot];

// Look for node_modules in both locations
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Disable hierarchical lookup (important for monorepos)
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

## Babel Configuration

```javascript
// babel.config.js
module.exports = {
  presets: ["babel-preset-expo"],
  plugins: [
    [
      "module-resolver",
      {
        root: ["./"],
        alias: {
          "@buttergolf/ui": "../../packages/ui/src",
          "@buttergolf/app": "../../packages/app/src",
        },
      },
    ],
    [
      "@tamagui/babel-plugin",
      {
        components: ["tamagui"],
        config: "../../packages/config/src/tamagui.config.ts",
      },
    ],
  ],
};
```

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## Building

### Development Build

```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```

### Production Build

```bash
# iOS
eas build --profile production --platform ios

# Android
eas build --profile production --platform android
```

### Submitting to App Stores

```bash
# Submit to App Store
eas submit --platform ios

# Submit to Play Store
eas submit --platform android
```

## Common Issues & Solutions

### Issue: "Module not found" for @buttergolf packages

**Solution**:

1. Check `metro.config.js` watchFolders and nodeModulesPaths
2. Check `babel.config.js` module-resolver aliases
3. Run `pnpm install` at root
4. Clear Metro cache: `pnpm dev:mobile --clear`

### Issue: Navigation not working

**Solution**:

1. Ensure screen is registered in `App.tsx` Stack Navigator
2. Check linking configuration has correct path
3. Use Solito's `Link` or `useLink` for navigation
4. Verify screen name matches linking config

### Issue: Styles not loading

**Solution**:

1. Check `TamaguiProvider` wraps entire app
2. Verify `babel.config.js` has `@tamagui/babel-plugin`
3. Clear cache and restart: `pnpm dev:mobile --clear`
4. Check imports are from `@buttergolf/ui`

### Issue: Environment variables not working

**Solution**:

1. Prefix with `EXPO_PUBLIC_` for client-side variables
2. Restart dev server after adding variables
3. Check `.env` is in `apps/mobile/` directory

### Issue: Build fails

**Solution**:

1. Run `eas build:configure` if first time
2. Check `app.json` configuration
3. Verify all environment variables in EAS
4. Check build logs on EAS dashboard

## Platform-Specific Considerations

### iOS

- Test on multiple device sizes (iPhone SE, 14, 14 Pro Max)
- Handle safe area insets properly
- Test on physical device for best results
- Configure app icons and splash screens in `app.json`

### Android

- Test on different Android versions (API 21+)
- Handle back button navigation
- Test on various screen sizes and densities
- Configure adaptive icons in `app.json`

## Performance Optimization

### Image Optimization

```tsx
import { Image } from "@buttergolf/ui";

export function OptimizedImage({ uri }) {
  return <Image source={{ uri }} style={{ width: 300, height: 200 }} resizeMode="cover" />;
}
```

### List Performance

```tsx
import { FlashList } from "@shopify/flash-list";

export function CourseList({ courses }) {
  return (
    <FlashList
      data={courses}
      renderItem={({ item }) => <CourseCard course={item} />}
      estimatedItemSize={200}
    />
  );
}
```

### Memoization

```tsx
import { memo } from "react";

export const CourseCard = memo(({ course }) => {
  return (
    <View>
      <Text>{course.name}</Text>
    </View>
  );
});
```

## Debugging

```bash
# Open React DevTools
# Press 'm' in terminal while dev server is running

# Open device menu (shake device or Cmd+D on iOS simulator)

# View logs
npx react-native log-ios
npx react-native log-android
```

## Additional Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Navigation](https://reactnavigation.org)
- [Solito Documentation](https://solito.dev)
- [Tamagui Documentation](https://tamagui.dev)
- [Clerk Expo Guide](https://clerk.com/docs/quickstarts/expo)
- [EAS Build](https://docs.expo.dev/build/introduction/)
