import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@buttergolf/db";

// UK mobile phone regex (matches 07XXX XXX XXX format or with country code)
const UK_MOBILE_REGEX = /^(?:\+44|0)7\d{9}$/;

/**
 * PUT /api/user/phone
 * Save UK mobile phone number to user profile
 *
 * Request body: { phone: string } (can be 07XXX or +447XXX format)
 * Response: { success: true, phone: string } (E.164 format)
 */
export async function PUT(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { phone } = body;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Normalize the phone number (remove spaces, dashes)
    const normalizedPhone = phone.replace(/[\s-]/g, "");

    // Validate UK mobile format
    if (!UK_MOBILE_REGEX.test(normalizedPhone)) {
      return NextResponse.json(
        { error: "Invalid UK mobile number. Please use format 07XXX XXX XXX" },
        { status: 400 }
      );
    }

    // Convert to E.164 format for storage (+447XXXXXXXXX)
    const e164Phone = normalizedPhone.startsWith("+44")
      ? normalizedPhone
      : `+44${normalizedPhone.slice(1)}`;

    // Find user by Clerk ID and update phone
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { phone: e164Phone },
    });

    return NextResponse.json({
      success: true,
      phone: e164Phone,
    });
  } catch (error) {
    console.error("Error saving phone number:", error);
    return NextResponse.json({ error: "Failed to save phone number" }, { status: 500 });
  }
}

/**
 * GET /api/user/phone
 * Get phone number for current user
 */
export async function GET() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { phone: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      phone: user.phone,
    });
  } catch (error) {
    console.error("Error fetching phone number:", error);
    return NextResponse.json({ error: "Failed to fetch phone number" }, { status: 500 });
  }
}
