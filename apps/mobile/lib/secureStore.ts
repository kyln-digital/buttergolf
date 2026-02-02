import * as SecureStore from "expo-secure-store";
import { InteractionManager } from "react-native";
import { addBreadcrumb } from "./breadcrumbs";

/**
 * Deferred SecureStore operations that wait for navigation animations to complete.
 * This prevents TurboModule race conditions during screen transitions.
 *
 * WHY THIS EXISTS:
 * The TestFlight crash (EXC_CRASH SIGABRT in ObjCTurboModule::performVoidMethodInvocation)
 * was caused by SecureStore TurboModule calls racing with react-native-svg unmounting
 * during navigation transitions.
 *
 * HOW IT WORKS:
 * All SecureStore operations are wrapped in InteractionManager.runAfterInteractions(),
 * which queues the work until native animations (navigation transitions, gesture handlers)
 * complete. This ensures the TurboModule bridge is accessed only when the view hierarchy
 * is stable.
 *
 * USAGE:
 * Import these functions instead of using expo-secure-store directly:
 * ```typescript
 * import { deferredSecureStoreGet, deferredSecureStoreSet } from "./lib/secureStore";
 *
 * const value = await deferredSecureStoreGet("my_key");
 * await deferredSecureStoreSet("my_key", "my_value");
 * ```
 */

/**
 * Get an item from SecureStore, deferred until after navigation animations.
 *
 * @param key - The key to retrieve
 * @returns The stored value, or null if not found or on error
 */
export async function deferredSecureStoreGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(async () => {
      try {
        addBreadcrumb("turbomodule.securestore", `getItem: ${key}`);
        const value = await SecureStore.getItemAsync(key);
        addBreadcrumb("turbomodule.securestore", `getItem complete: ${key}`, { hasValue: !!value });
        resolve(value);
      } catch (error) {
        addBreadcrumb(
          "turbomodule.securestore",
          `getItem failed: ${key}`,
          { error: String(error) },
          "error"
        );
        resolve(null);
      }
    });
  });
}

/**
 * Set an item in SecureStore, deferred until after navigation animations.
 *
 * @param key - The key to store under
 * @param value - The value to store
 */
export async function deferredSecureStoreSet(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(async () => {
      try {
        addBreadcrumb("turbomodule.securestore", `setItem: ${key}`);
        await SecureStore.setItemAsync(key, value);
        addBreadcrumb("turbomodule.securestore", `setItem complete: ${key}`);
        resolve();
      } catch (error) {
        addBreadcrumb(
          "turbomodule.securestore",
          `setItem failed: ${key}`,
          { error: String(error) },
          "error"
        );
        resolve();
      }
    });
  });
}

/**
 * Delete an item from SecureStore, deferred until after navigation animations.
 *
 * @param key - The key to delete
 */
export async function deferredSecureStoreDelete(key: string): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(async () => {
      try {
        addBreadcrumb("turbomodule.securestore", `deleteItem: ${key}`);
        await SecureStore.deleteItemAsync(key);
        addBreadcrumb("turbomodule.securestore", `deleteItem complete: ${key}`);
        resolve();
      } catch (error) {
        addBreadcrumb(
          "turbomodule.securestore",
          `deleteItem failed: ${key}`,
          { error: String(error) },
          "error"
        );
        resolve();
      }
    });
  });
}
