import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { addBreadcrumb } from "./breadcrumbs";

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
    console.log("[Notifications] Skipping push registration - no auth token");
    return null;
  }

  try {
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
      addBreadcrumb("turbomodule.notifications", "Permissions not granted", { finalStatus }, "warning");
      console.log("[Notifications] Permission not granted");
      return null;
    }

    // Get the Expo push token
    addBreadcrumb("turbomodule.notifications", "Getting Expo push token");
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    addBreadcrumb("turbomodule.notifications", "Push token obtained", { 
      tokenLength: pushToken.data?.length 
    });

    console.log("[Notifications] Got push token:", {
      tokenLength: pushToken.data?.length,
      tokenPrefix: pushToken.data?.substring(0, 20),
    });

    // Check if token has changed since last successful storage
    addBreadcrumb("turbomodule.securestore", "Reading stored push token");
    const storedToken = await SecureStore.getItemAsync("expo_push_token");
    if (storedToken === pushToken.data) {
      addBreadcrumb("turbomodule.notifications", "Push token unchanged");
      console.log("[Notifications] Push token unchanged in local storage");
      return pushToken.data;
    }

    // Store locally in secure store
    addBreadcrumb("turbomodule.securestore", "Storing new push token");
    await SecureStore.setItemAsync("expo_push_token", pushToken.data);
    addBreadcrumb("turbomodule.securestore", "Push token stored successfully");

    return pushToken.data;
  } catch (error) {
    addBreadcrumb("turbomodule.notifications", "Registration failed", { error: String(error) }, "error");
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
    const token = await SecureStore.getItemAsync("expo_push_token");
    return token || null;
  } catch (error) {
    addBreadcrumb("turbomodule.securestore", "Failed to get stored token", { error: String(error) }, "error");
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
    await SecureStore.deleteItemAsync("expo_push_token");
    addBreadcrumb("turbomodule.securestore", "Push token cleared");
    console.log("[Notifications] Cleared stored push token");
  } catch (error) {
    addBreadcrumb("turbomodule.securestore", "Failed to clear token", { error: String(error) }, "error");
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
      console.log("[Notifications] Notification received:", {
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
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log("[Notifications] Notification tapped:", {
        data: response.notification.request.content.data,
      });

      // Call custom handler if provided
      onNotificationResponseReceived?.(response);
    }
  );

  // Return cleanup function
  return () => {
    subscription.remove();
  };
}

/**
 * Register push token with backend API
 *
 * This should be called after getting a push token to sync it with the server
 */
export async function registerPushTokenWithBackend(
  pushToken: string,
  authToken: string,
  apiUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/users/push-tokens`, {
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

    console.log("[Notifications] Push token registered with backend");
    return true;
  } catch (error) {
    console.error("[Notifications] Error registering push token with backend:", error);
    return false;
  }
}

/**
 * Unregister push token from backend API (e.g., on logout)
 */
export async function unregisterPushTokenFromBackend(
  pushToken: string,
  authToken: string,
  apiUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/users/push-tokens`, {
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

    console.log("[Notifications] Push token unregistered from backend");
    return true;
  } catch (error) {
    console.error("[Notifications] Error unregistering push token:", error);
    return false;
  }
}
