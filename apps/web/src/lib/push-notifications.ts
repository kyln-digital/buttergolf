/**
 * Send push notifications via Expo Push Service
 *
 * ★ Insight ─────────────────────────────────────
 * - Sends notifications to multiple Expo push tokens
 * - Non-blocking (fire-and-forget)
 * - Includes deep link to message thread in notification
 * - Handles errors gracefully without blocking the request
 * ─────────────────────────────────────────────────
 */

interface PushNotificationMessage {
  to: string[];
  sound: "default";
  title: string;
  body: string;
  data?: {
    orderId: string;
    [key: string]: unknown;
  };
}

export async function sendPushNotifications(
  pushTokens: string[],
  title: string,
  body: string,
  data?: { orderId: string; [key: string]: unknown }
): Promise<void> {
  if (!pushTokens || pushTokens.length === 0) {
    console.log("[Push] No push tokens to send to");
    return;
  }

  try {
    const message: PushNotificationMessage = {
      to: pushTokens,
      sound: "default",
      title,
      body,
      data,
    };

    console.log(`[Push] Sending notification to ${pushTokens.length} device(s)`);

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Push] Failed to send notification:", error);
      return;
    }

    const result = await response.json();
    console.log("[Push] Notification sent successfully:", {
      id: result.id,
      receipts: result.data?.length || 0,
    });
  } catch (error) {
    console.error("[Push] Error sending push notification:", error);
    // Don't throw - notifications are not critical
  }
}

/**
 * Send message notification to recipient
 *
 * Called when a new message is sent to notify the other user
 */
export async function sendMessageNotification(
  recipientPushTokens: string[],
  senderName: string,
  productTitle: string,
  messagePreview: string,
  orderId: string
): Promise<void> {
  await sendPushNotifications(
    recipientPushTokens,
    `New message from ${senderName}`,
    `${productTitle}: ${messagePreview.substring(0, 100)}${messagePreview.length > 100 ? "..." : ""}`,
    { orderId }
  );
}
