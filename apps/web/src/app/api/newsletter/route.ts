import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { checkRateLimit, rateLimitResponse } from "@/middleware/rate-limit";

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const { isLimited, resetAt, headers } = await checkRateLimit(clientIp, {
      maxRequests: 10,
      windowMs: 60_000,
      keyFn: (ip) => `newsletter:${ip}`,
    });

    if (isLimited) {
      const response = rateLimitResponse(resetAt);
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    }

    const body = await request.json();
    const { email, source } = body as { email?: string; source?: string };

    if (!email || typeof email !== "string") {
      const response = NextResponse.json({ error: "Email is required" }, { status: 400 });
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    }

    const normalisedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalisedEmail)) {
      const response = NextResponse.json({ error: "Invalid email address" }, { status: 400 });
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    }

    const normalisedSource =
      typeof source === "string" && source.trim() ? source.trim() : "homepage";

    await prisma.newsletterSubscriber.upsert({
      where: { email: normalisedEmail },
      update: {
        source: normalisedSource,
        subscribedAt: new Date(),
      },
      create: {
        email: normalisedEmail,
        source: normalisedSource,
      },
    });

    const response = NextResponse.json({
      success: true,
      message: "You have successfully been subscribed.",
    });
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  } catch (error) {
    console.error("Newsletter signup error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
