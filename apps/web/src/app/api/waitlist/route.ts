import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { enforceIpRateLimit } from "@/middleware/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Unauthenticated public write - throttle to prevent spam/DB-fill abuse
    const limited = await enforceIpRateLimit(request, "waitlist", {
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await request.json();
    const { email } = body;

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.waitlist.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      // Don't reveal that email exists - just return success
      return NextResponse.json({ success: true, message: "You're on the list!" });
    }

    // Create waitlist entry
    await prisma.waitlist.create({
      data: {
        email: email.toLowerCase().trim(),
        source: "coming-soon",
      },
    });

    return NextResponse.json({ success: true, message: "You're on the list!" });
  } catch (error) {
    console.error("Waitlist signup error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
