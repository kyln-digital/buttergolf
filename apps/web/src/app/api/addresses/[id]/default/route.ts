import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// PUT /api/addresses/[id]/default - Set address as default
export async function PUT(request: NextRequest, context: Params) {
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

    // Unset all other addresses as default
    await prisma.address.updateMany({
      where: {
        userId: user.id,
        id: { not: params.id },
      },
      data: { isDefault: false },
    });

    // Set this address as default
    const address = await prisma.address.update({
      where: { id: params.id },
      data: { isDefault: true },
    });

    return NextResponse.json(address);
  } catch (error) {
    console.error("Error setting default address:", error);
    return NextResponse.json({ error: "Failed to set default address" }, { status: 500 });
  }
}
