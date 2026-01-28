import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

// GET /api/addresses - Get user's addresses
export async function GET(request: NextRequest) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkUserId = await getUserIdFromRequest(request);
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's addresses
    const addresses = await prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [
        { isDefault: "desc" }, // Default addresses first
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(addresses);
  } catch (error) {
    console.error("Error fetching addresses:", error);
    return NextResponse.json({ error: "Failed to fetch addresses" }, { status: 500 });
  }
}

// POST /api/addresses - Create new address
export async function POST(request: NextRequest) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkUserId = await getUserIdFromRequest(request);
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      firstName,
      lastName,
      street1,
      street2,
      city,
      state, // county for UK
      zip, // postcode for UK
      country = "GB", // UK default
      phone,
      isDefault,
    } = body;

    // Validate required fields (state/county is optional for UK)
    if (!street1 || !city || !zip) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate name - either combined name or first+last required
    const fullName = name || `${firstName || ""} ${lastName || ""}`.trim();
    if (!fullName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If this is being set as default, unset all other defaults
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    // Create new address
    const address = await prisma.address.create({
      data: {
        userId: user.id,
        name: fullName,
        firstName: firstName || null,
        lastName: lastName || null,
        street1,
        street2: street2 || null,
        city,
        state: state || null, // Optional for UK addresses
        zip,
        country,
        phone: phone || null,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json(address, { status: 201 });
  } catch (error) {
    console.error("Error creating address:", error);
    return NextResponse.json({ error: "Failed to create address" }, { status: 500 });
  }
}
