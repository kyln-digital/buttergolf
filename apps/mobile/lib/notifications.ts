import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { addBreadcrumb } from "./breadcrumbs";
import { deferredFetch } from "./apiClient";
import {
  deferredSecureStoreGet,
  deferredSecureStoreSet,
  deferredSecureStoreDelete,
} from "./secureStore";

/**
 * Register for push notifications and store the push token
 *
 * ★ Insight ─────────────────────────────────────
 * - Gets the Expo push token for this device
 * - Stores in SecureStore (encrypted on device)
 * - Call this on app startup and when permissions change
 * - Returns token that should be sent to backend API
 * ─────────────────────────────────────────────────
 */
export async function registerForPushNotificationsAsync(
  token: string | null
): Promise<string | null> {
  // Skip if no auth token (user not logged in)
  if (!token) {
    console.info("[Notifications] Skipping push registration - no auth token");
    return null;
  }

  try {
    const isIosSimulator = Platform.OS === "ios" && Constants.isDevice !== true;

    // Get the project ID from app.json
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      addBreadcrumb("turbomodule.notifications", "No EAS project ID found", {}, "warning");
      console.warn(
        "[Notifications] No EAS project ID found. " +
          "Add 'extra.eas.projectId' to app.json or run 'eas build:configure' to set it up."
      );
      return null;
    }

    // Request notification permissions
    addBreadcrumb("turbomodule.notifications", "Getting existing permissions");
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      addBreadcrumb("turbomodule.notifications", "Requesting permissions");
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      addBreadcrumb(
        "turbomodule.notifications",
        "Permissions not granted",
        { finalStatus },
        "warning"
      );
      console.info("[Notifications] Permission not granted");
      return null;
    }

    if (isIosSimulator) {
      addBreadcrumb(
        "turbomodule.notifications",
        "Skipping Expo push token on iOS simulator",
        {},
        "warning"
      );
      console.info(
        "[Notifications] Skipping Expo push token on iOS simulator. Use a physical iOS device to receive push tokens."
      );
      return null;
    }

    // Get the Expo push token
    addBreadcrumb("turbomodule.notifications", "Getting Expo push token");
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    addBreadcrumb("turbomodule.notifications", "Push token obtained", {
      tokenLength: pushToken.data?.length,
    });

    console.info("[Notifications] Got push token:", {
      tokenLength: pushToken.data?.length,
      tokenPrefix: pushToken.data?.substring(0, 20),
    });

    // Check if token has changed since last successful storage
    addBreadcrumb("turbomodule.securestore", "Reading stored push token");
    const storedToken = await deferredSecureStoreGet("expo_push_token");
    if (storedToken === pushToken.data) {
      addBreadcrumb("turbomodule.notifications", "Push token unchanged");
      console.info("[Notifications] Push token unchanged in local storage");
      return pushToken.data;
    }

    // Store locally in secure store
    addBreadcrumb("turbomodule.securestore", "Storing new push token");
    await deferredSecureStoreSet("expo_push_token", pushToken.data);
    addBreadcrumb("turbomodule.securestore", "Push token stored successfully");

    return pushToken.data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isExpectedIosEntitlementError =
      Platform.OS === "ios" && errorMessage.includes("aps-environment");

    if (isExpectedIosEntitlementError) {
      addBreadcrumb(
        "turbomodule.notifications",
        "Expected iOS push entitlement limitation in development",
        { error: errorMessage },
        "warning"
      );
      console.info(
        "[Notifications] Push token unavailable for this iOS development build (missing aps-environment entitlement). Use a physical device build with push entitlements enabled."
      );
      return null;
    }

    addBreadcrumb(
      "turbomodule.notifications",
      "Registration failed",
      { error: String(error) },
      "error"
    );
    console.error("[Notifications] Error registering for push:", error);
    return null;
  }
}

/**
 * Get the stored push token from device
 */
export async function getStoredPushToken(): Promise<string | null> {
  try {
    addBreadcrumb("turbomodule.securestore", "Getting stored push token");
    const token = await deferredSecureStoreGet("expo_push_token");
    return token || null;
  } catch (error) {
    addBreadcrumb(
      "turbomodule.securestore",
      "Failed to get stored token",
      { error: String(error) },
      "error"
    );
    console.error("[Notifications] Error getting stored token:", error);
    return null;
  }
}

/**
 * Clear the stored push token (e.g., on logout)
 */
export async function clearStoredPushToken(): Promise<void> {
  try {
    addBreadcrumb("turbomodule.securestore", "Clearing stored push token");
    await deferredSecureStoreDelete("expo_push_token");
    addBreadcrumb("turbomodule.securestore", "Push token cleared");
    console.info("[Notifications] Cleared stored push token");
  } catch (error) {
    addBreadcrumb(
      "turbomodule.securestore",
      "Failed to clear token",
      { error: String(error) },
      "error"
    );
    console.error("[Notifications] Error clearing token:", error);
  }
}

/**
 * Setup notification handlers for foreground and background notifications
 *
 * Call this once on app startup to set up the handlers
 */
export function setupNotificationHandlers(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponseReceived?: (response: Notifications.NotificationResponse) => void
) {
  // Set notification handler (what happens when notification arrives while app is open)
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      console.info("[Notifications] Notification received:", {
        title: notification.request.content.title,
      });

      // Call custom handler if provided
      onNotificationReceived?.(notification);

      // Show notification in foreground
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });

  // Handle user tapping on notification
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    console.info("[Notifications] Notification tapped:", {
      data: response.notification.request.content.data,
    });

    // Call custom handler if provided
    onNotificationResponseReceived?.(response);
  });

  // Return cleanup function
  return () => {
    subscription.remove();
  };
}

/**
 * Register push token with backend API
 *
 * This should be called after getting a push token to sync it with the server.
 * Uses deferredFetch to prevent TurboModule race conditions during navigation.
 */
export async function registerPushTokenWithBackend(
  pushToken: string,
  authToken: string,
  apiUrl: string
): Promise<boolean> {
  try {
    addBreadcrumb("api", "Registering push token with backend");

    // We already have the auth token, so pass it directly in headers
    // rather than using getToken (avoids additional SecureStore call)
    const response = await deferredFetch(`${apiUrl}/api/users/push-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: pushToken }),
    });

    if (!response.ok) {
      throw new Error("Failed to register push token");
    }

    addBreadcrumb("api", "Push token registered with backend");
    console.info("[Notifications] Push token registered with backend");
    return true;
  } catch (error) {
    addBreadcrumb("api", "Failed to register push token", { error: String(error) }, "error");
    console.error("[Notifications] Error registering push token with backend:", error);
    return false;
  }
}

/**
 * Unregister push token from backend API (e.g., on logout)
 * Uses deferredFetch to prevent TurboModule race conditions during navigation.
 */
export async function unregisterPushTokenFromBackend(
  pushToken: string,
  authToken: string,
  apiUrl: string
): Promise<boolean> {
  try {
    addBreadcrumb("api", "Unregistering push token from backend");

    // We already have the auth token, so pass it directly in headers
    const response = await deferredFetch(`${apiUrl}/api/users/push-tokens`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: pushToken }),
    });

    if (!response.ok) {
      throw new Error("Failed to unregister push token");
    }

    addBreadcrumb("api", "Push token unregistered from backend");
    console.info("[Notifications] Push token unregistered from backend");
    return true;
  } catch (error) {
    addBreadcrumb("api", "Failed to unregister push token", { error: String(error) }, "error");
    console.error("[Notifications] Error unregistering push token:", error);
    return false;
  }
}
