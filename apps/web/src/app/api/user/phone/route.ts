import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@buttergolf/db";

// E.164 phone format regex (international phone numbers)
// Accepts formats: +<country code><number> (1-15 digits total after +)
// Examples: +447700900123, +14155551234, +33612345678
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * PUT /api/user/phone
 * Save phone number to user profile
 *
 * Request body: { phone: string } (E.164 format from react-phone-number-input)
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

    // Validate E.164 format (international standard)
    if (!E164_REGEX.test(normalizedPhone)) {
      return NextResponse.json(
        { error: "Invalid phone number format. Please enter a valid phone number." },
        { status: 400 }
      );
    }

    // Phone is already in E.164 format from react-phone-number-input
    const e164Phone = normalizedPhone;

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
