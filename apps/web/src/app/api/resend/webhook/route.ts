import { NextResponse } from "next/server";
import { Resend } from "resend";

/**
 * Resend inbound-email webhook.
 *
 * buttergolf.com has no mailboxes. Resend receives everything addressed to the
 * domain and fires `email.received`; this handler forwards each message, body
 * and attachments intact, to a real inbox so addresses like
 * josh@buttergolf.com behave like a mailbox.
 *
 * Environment:
 * - RESEND_API_KEY              existing sending key
 * - RESEND_WEBHOOK_SECRET       signing secret of the Resend webhook (whsec_…)
 * - RESEND_INBOUND_FORWARD_TO   destination inbox
 * - RESEND_INBOUND_FORWARD_FROM optional; sender on a verified Resend domain
 */

const DEFAULT_FORWARD_FROM = "ButterGolf Inbox <notifications@notifications.buttergolf.com>";

// Domains Resend receives for. Forwarding back into one of these (or a
// subdomain of one) would loop.
const RECEIVING_DOMAINS = ["buttergolf.com", "notifications.buttergolf.com"];

/**
 * Accepts `local@domain` or `Name <local@domain>` and returns the bare,
 * lower-cased mailbox, or null unless the value is exactly one plausible
 * address. The domain check below must see the real domain, not `domain>`.
 */
function parseMailbox(value: string): string | null {
  const trimmed = value.trim();
  const angle = /^[^<>]*<([^<>]+)>$/.exec(trimmed);
  const address = (angle ? angle[1] : trimmed).trim().toLowerCase();
  if (!/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(address)) return null;
  return address;
}

function isReceivingDomain(domain: string): boolean {
  return RECEIVING_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

function forwardTarget(): string | null {
  const raw = process.env.RESEND_INBOUND_FORWARD_TO;
  if (!raw) return null;
  const address = parseMailbox(raw);
  if (!address) return null;
  const domain = address.slice(address.lastIndexOf("@") + 1);
  return isReceivingDomain(domain) ? null : address;
}

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) {
    return NextResponse.json({ error: "Resend webhook not configured" }, { status: 500 });
  }

  const forwardTo = forwardTarget();
  if (!forwardTo) {
    return NextResponse.json(
      {
        error: "RESEND_INBOUND_FORWARD_TO is unset, not a single mailbox, or on a receiving domain",
      },
      { status: 500 }
    );
  }

  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
  }

  // Verify against the raw body: re-serialising parsed JSON can change bytes.
  const payload = await req.text();
  const resend = new Resend(apiKey);

  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });
  } catch (err) {
    console.error("[resend-webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const emailId = event.data.email_id;
  const result = await resend.emails.receiving.forward(
    {
      emailId,
      to: forwardTo,
      from: process.env.RESEND_INBOUND_FORWARD_FROM?.trim() || DEFAULT_FORWARD_FROM,
    },
    // Resend retries on non-2xx; the key stops a retry sending a duplicate.
    { idempotencyKey: `inbound-forward-${emailId}` }
  );

  if (result.error) {
    console.error("[resend-webhook] forward failed", { emailId, error: result.error });
    return NextResponse.json({ error: "Forward failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, forwarded: result.data?.id });
}
