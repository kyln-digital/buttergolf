import { NextResponse } from "next/server";

/**
 * What a suspended account is told when it tries to do something suspension
 * blocks: list, publish, buy, message, make an offer. Browsing still works.
 */
export const SUSPENDED_MESSAGE =
  "Your account is suspended. Contact support@buttergolf.com if you think this is a mistake.";

export function suspendedResponse(): NextResponse {
  return NextResponse.json(
    { error: SUSPENDED_MESSAGE, code: "ACCOUNT_SUSPENDED" },
    { status: 403 }
  );
}

/** True when the user row carries a suspension. Accepts any shape with the column. */
export function isSuspended(user: { suspendedAt: Date | null } | null | undefined): boolean {
  return Boolean(user?.suspendedAt);
}
