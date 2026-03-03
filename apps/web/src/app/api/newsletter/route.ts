import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, source } = body as { email?: string; source?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalisedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalisedEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
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

    return NextResponse.json({
      success: true,
      message: "You have successfully been subscribed.",
    });
  } catch (error) {
    console.error("Newsletter signup error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
