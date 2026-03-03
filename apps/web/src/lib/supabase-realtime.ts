import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EventSourceLike } from "@buttergolf/app/src/features/messages/message-thread-screen";

// Module-level singleton — reused across reconnects to avoid leaking
// WebSocket transports. Each call to `createSupabaseEventSource` creates
// a new *channel* on this shared client.
let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables not configured");
  }

  _supabase = createClient(supabaseUrl, supabaseKey);
  return _supabase;
}

// ============================================================================
// CLIENT-SIDE: Supabase Realtime subscription (EventSourceLike adapter)
// ============================================================================

/**
 * Create a Supabase Realtime channel subscription that implements the
 * EventSourceLike interface consumed by MessageThreadScreen.
 *
 * Supports both conversation-based and legacy order-based URLs:
 * - /conversations/{conversationId}/messages → conversation:{conversationId}
 * - /orders/{orderId}/messages              → order-messages:{orderId} (legacy)
 *
 * Uses Supabase Broadcast channels with a shared client singleton.
 * Channel per conversation for isolation. Supabase handles reconnection internally.
 */
export function createSupabaseEventSource(url: string): EventSourceLike {
  // Try conversation-based URL first, then fall back to order-based
  const convMatch = url.match(/\/conversations\/([^/]+)/);
  const orderMatch = url.match(/\/orders\/([^/]+)/);

  let channelName: string;
  if (convMatch?.[1]) {
    channelName = `conversation:${convMatch[1]}`;
  } else if (orderMatch?.[1]) {
    channelName = `order-messages:${orderMatch[1]}`;
  } else {
    throw new Error(`Cannot extract conversationId or orderId from URL: ${url}`);
  }

  const supabase = getSupabaseClient();

  type Listener = (event: { data: string }) => void;
  const messageListeners: Listener[] = [];
  const errorListeners: Listener[] = [];

  const emitMessage = (data: string) => {
    for (const fn of messageListeners) fn({ data });
  };

  const emitBroadcastPayload = (eventType: string, payload: unknown) => {
    const base = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    emitMessage(
      JSON.stringify({
        ...base,
        type: typeof base.type === "string" ? base.type : eventType,
      })
    );
  };

  const emitError = () => {
    for (const fn of errorListeners) fn({ data: "" });
  };

  const channel = supabase.channel(channelName);

  channel
    .on("broadcast", { event: "new_message" }, ({ payload }) => {
      emitBroadcastPayload("new_message", payload);
    })
    .on("broadcast", { event: "messages_read" }, ({ payload }) => {
      emitBroadcastPayload("messages_read", payload);
    })
    .on("broadcast", { event: "offer_update" }, ({ payload }) => {
      emitBroadcastPayload("offer_update", payload);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        emitMessage(JSON.stringify({ type: "connected" }));
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        emitError();
      }
    });

  return {
    addEventListener(type: string, listener: Listener) {
      if (type === "message") messageListeners.push(listener);
      else if (type === "error") errorListeners.push(listener);
    },
    close() {
      supabase.removeChannel(channel);
    },
  };
}

// ============================================================================
// SERVER-SIDE: Broadcast to order channel via REST API
// ============================================================================

/**
 * Broadcast a real-time event to all subscribers of an order's message channel.
 *
 * Uses the Supabase Realtime REST API — a single HTTP POST, no persistent
 * WebSocket needed. Ideal for serverless functions (Vercel).
 *
 * Falls back silently when Supabase is not configured.
 */
export async function broadcastToOrder(
  orderId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn("[Supabase] Not configured, skipping broadcast");
    return;
  }

  const response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `realtime:order-messages:${orderId}`,
          event,
          payload,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase broadcast failed (${response.status}): ${text}`);
  }
}

// ============================================================================
// SERVER-SIDE: Broadcast to conversation channel via REST API
// ============================================================================

/**
 * Broadcast a real-time event to all subscribers of a conversation channel.
 *
 * This is the conversation-based equivalent of broadcastToOrder.
 * Channel: `conversation:{conversationId}`
 */
export async function broadcastToConversation(
  conversationId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn("[Supabase] Not configured, skipping broadcast");
    return;
  }

  const response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `realtime:conversation:${conversationId}`,
          event,
          payload,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase broadcast failed (${response.status}): ${text}`);
  }
}
