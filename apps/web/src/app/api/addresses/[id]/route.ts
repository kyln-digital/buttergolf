import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// PUT /api/addresses/[id] - Update address
export async function PUT(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
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

    // Check if address exists and belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!existingAddress) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    // If this is being set as default, unset all other defaults
    if (isDefault) {
      await prisma.address.updateMany({
        where: {
          userId: user.id,
          id: { not: params.id }, // Exclude current address
        },
        data: { isDefault: false },
      });
    }

    // Update address
    const address = await prisma.address.update({
      where: { id: params.id },
      data: {
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

    return NextResponse.json(address);
  } catch (error) {
    console.error("Error updating address:", error);
    return NextResponse.json({ error: "Failed to update address" }, { status: 500 });
  }
}

// DELETE /api/addresses/[id] - Delete address
export async function DELETE(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
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

    // Check if address exists and belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!existingAddress) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    // Check if address is used in any orders
    const ordersCount = await prisma.order.count({
      where: {
        OR: [{ fromAddressId: params.id }, { toAddressId: params.id }],
      },
    });

    if (ordersCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete address that is used in orders" },
        { status: 400 }
      );
    }

    // Delete address
    await prisma.address.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting address:", error);
    return NextResponse.json({ error: "Failed to delete address" }, { status: 500 });
  }
}
