import { useEffect, useState, useCallback, useRef } from "react";

interface Message {
  id: string;
  orderId: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  content: string;
  createdAt: string;
  isRead: boolean;
}

interface UseMessageStreamReturn {
  isConnected: boolean;
  error: string | null;
}

/**
 * Hook to manage Server-Sent Events connection for real-time messages
 *
 * ★ Insight ─────────────────────────────────────
 * - Works cross-platform: native EventSource on web, polyfill on mobile
 * - Handles auto-reconnection and network changes
 * - Parses SSE stream and delivers messages via callback
 * - Web-only for now (mobile will use similar pattern in production)
 * ─────────────────────────────────────────────────
 */
export function useMessageStream(
  orderId: string,
  token: string | null,
  onMessage: (message: Message) => void
): UseMessageStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  // Store onMessage in a ref to avoid reconnections when callback changes
  // eslint-disable-next-line react-hooks/refs
  const onMessageRef = useRef(onMessage);
  // eslint-disable-next-line react-hooks/refs
  onMessageRef.current = onMessage;

  useEffect(() => {
    // Don't connect if missing required parameters
    if (!orderId || !token || typeof window === "undefined") {
      return;
    }

    // EventSource not available on React Native (would need react-native-sse polyfill)
    // For now, this hook is web-only
    if (!window.EventSource) {
      console.warn(
        "[useMessageStream] EventSource not available on this platform. " +
          "Real-time updates require web browser. Mobile uses polling fallback via useMessagePolling hook."
      );
      return;
    }

    try {
      // EventSource doesn't support custom headers, so pass token via query param
      // The server-side route will validate this token
      const url = `/api/orders/${orderId}/messages/stream?token=${encodeURIComponent(token)}`;

      // Create EventSource connection
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Handle connection open
      eventSource.addEventListener("open", () => {
        console.info("[useMessageStream] Connected");
        setIsConnected(true);
        setError(null);
      });

      // Handle message events
      eventSource.addEventListener("message", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);

          // Handle new message events
          if (data.type === "new_message" && data.message) {
            onMessageRef.current({
              id: data.message.id,
              orderId: data.message.orderId,
              senderId: data.message.senderId,
              senderName: data.message.senderName,
              senderImage: data.message.senderImage,
              content: data.message.content,
              createdAt: data.message.createdAt,
              isRead: data.message.isRead,
            });
          }
        } catch (err) {
          console.error("[useMessageStream] Failed to parse message:", err);
        }
      });

      // Handle connection errors
      eventSource.addEventListener("error", (err: Event) => {
        console.error("[useMessageStream] Connection error:", err);
        setIsConnected(false);
        setError("Connection lost. Reconnecting...");
        // EventSource automatically attempts to reconnect
      });

      return () => {
        console.info("[useMessageStream] Closing connection");
        eventSource.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      };
    } catch (err) {
      console.error("[useMessageStream] Error setting up SSE:", err);
      setError(err instanceof Error ? err.message : "Failed to setup message stream");
      return;
    }
  }, [orderId, token]);

  return { isConnected, error };
}

/**
 * Alternative hook for polling-based message fetching (fallback for platforms without SSE)
 * This is used as a fallback for environments that don't support EventSource
 */
export function useMessagePolling(
  orderId: string,
  token: string | null,
  onMessagesUpdate: (messages: Message[]) => void,
  pollingInterval: number = 5000
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!orderId || !token) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/orders/${orderId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const data = await response.json();
      onMessagesUpdate(data.messages);
      setError(null);
    } catch (err) {
      console.error("[useMessagePolling] Error fetching messages:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch messages");
    } finally {
      setIsLoading(false);
    }
  }, [orderId, token, onMessagesUpdate]);

  useEffect(() => {
    // Fetch immediately on mount
    fetchMessages();

    // Setup polling interval
    pollingRef.current = setInterval(fetchMessages, pollingInterval);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchMessages, pollingInterval]);

  return { isLoading, error, refetch: fetchMessages };
}
