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
 * Uses Supabase Broadcast channels with a shared client singleton.
 * Channel per order for isolation. Supabase handles reconnection internally.
 */
export function createSupabaseEventSource(url: string): EventSourceLike {
  const match = url.match(/\/orders\/([^/]+)/);
  const orderId = match?.[1];

  if (!orderId) {
    throw new Error(`Cannot extract orderId from URL: ${url}`);
  }

  const supabase = getSupabaseClient();
  const channelName = `order-messages:${orderId}`;

  type Listener = (event: { data: string }) => void;
  const messageListeners: Listener[] = [];
  const errorListeners: Listener[] = [];

  const emitMessage = (data: string) => {
    for (const fn of messageListeners) fn({ data });
  };

  const emitError = () => {
    for (const fn of errorListeners) fn({ data: "" });
  };

  const channel = supabase.channel(channelName);

  channel
    .on("broadcast", { event: "new_message" }, ({ payload }) => {
      emitMessage(JSON.stringify(payload));
    })
    .on("broadcast", { event: "messages_read" }, ({ payload }) => {
      emitMessage(JSON.stringify(payload));
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
