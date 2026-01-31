import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * POST /api/users/push-tokens
 * Register a new push token for the user
 *
 * ★ Insight ─────────────────────────────────────
 * - Stores Expo push token in User model for later notification delivery
 * - Prevents duplicate tokens (checks before adding)
 * - Called by mobile app on startup
 * ─────────────────────────────────────────────────
 */
export async function POST(req: Request) {
  try {
    // Note: getUserIdFromRequest returns Clerk's userId, which we store as clerkId in our database.
    // Using the variable name 'clerkId' clarifies that this value maps to the User.clerkId column.
    const clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, pushTokens: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid push token" }, { status: 400 });
    }

    // Add token if not already present
    const pushTokens = user.pushTokens || [];
    if (!pushTokens.includes(token)) {
      pushTokens.push(token);

      await prisma.user.update({
        where: { id: user.id },
        data: { pushTokens },
      });

      console.log(`[Push] Registered token for user ${clerkId}: ${token.substring(0, 20)}...`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Push] Error registering token:", error);
    return NextResponse.json({ error: "Failed to register push token" }, { status: 500 });
  }
}

/**
 * DELETE /api/users/push-tokens
 * Unregister a push token (e.g., on logout)
 */
export async function DELETE(req: Request) {
  try {
    // Note: getUserIdFromRequest returns Clerk's userId, which we store as clerkId in our database.
    // Using the variable name 'clerkId' clarifies that this value maps to the User.clerkId column.
    const clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, pushTokens: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid push token" }, { status: 400 });
    }

    // Remove token if present
    const pushTokens = (user.pushTokens || []).filter((t) => t !== token);

    await prisma.user.update({
      where: { id: user.id },
      data: { pushTokens },
    });

    console.log(`[Push] Unregistered token for user ${clerkId}: ${token.substring(0, 20)}...`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Push] Error unregistering token:", error);
    return NextResponse.json({ error: "Failed to unregister push token" }, { status: 500 });
  }
}
