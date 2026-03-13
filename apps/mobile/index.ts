// Tamagui v2 native runtime integrations — must be imported before the app.
// These are side-effect-only modules that call globalThis setup functions.
// Each import gracefully no-ops when its optional peer dependency is absent.

// Enable react-native-teleport as the portal backend (falls back to legacy shim
// when react-native-teleport is not installed).
import "@tamagui/native/setup-teleport";

// Register expo-linear-gradient as Tamagui's LinearGradient implementation on
// native. No-ops when expo-linear-gradient is not installed.
import "@tamagui/native/setup-expo-linear-gradient";

// Wire react-native-gesture-handler (Gesture, GestureDetector, ScrollView) into
// Tamagui's Sheet for native swipe-to-dismiss gestures.
import "@tamagui/native/setup-gesture-handler";

import { registerRootComponent } from "expo";

import App from "./App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
