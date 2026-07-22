/**
 * Data Migration: Fix Existing Order Payment Hold Status
 *
 * Problem: The migration that added paymentHoldStatus defaults all orders to HELD.
 * But orders that were already paid out (stripePayoutStatus = 'completed') should
 * be marked as RELEASED to avoid:
 * 1. Duplicate payout attempts by the cron job
 * 2. Confusion in seller dashboards
 *
 * Solution: Update existing orders based on their actual state:
 * - If stripePayoutStatus = 'completed' → RELEASED
 * - If stripePayoutStatus = 'pending' and order is old (>14 days) → needs review
 * - If order is new → keep as HELD (correct state)
 *
 * Run this migration once after deploying the Vinted model changes.
 *
 * Usage: npx ts-node packages/db/prisma/migrations/fix-payment-hold-status.ts
 *        Or via: pnpm db:fix-payment-hold
 */

import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function main() {
  console.info("Starting data migration: Fix Payment Hold Status\n");

  // 1. Find all orders that have been paid out but show as HELD
  const paidOutButHeld = await prisma.order.findMany({
    where: {
      stripePayoutStatus: "completed",
      paymentHoldStatus: "HELD",
    },
    select: {
      id: true,
      createdAt: true,
      stripeTransferId: true,
    },
  });

  console.info(`Found ${paidOutButHeld.length} orders with completed payouts but HELD status`);

  if (paidOutButHeld.length > 0) {
    // Update them to RELEASED
    const updateResult = await prisma.order.updateMany({
      where: {
        stripePayoutStatus: "completed",
        paymentHoldStatus: "HELD",
      },
      data: {
        paymentHoldStatus: "RELEASED",
        paymentReleasedAt: new Date(), // Mark as released now (we don't know exact date)
      },
    });

    console.info(`Updated ${updateResult.count} orders to RELEASED status`);

    // Log the affected order IDs for audit trail
    console.info("\nAffected Order IDs:");
    paidOutButHeld.forEach((order) => {
      console.info(`  - ${order.id} (created: ${order.createdAt.toISOString()})`);
    });
  }

  // 2. Find orders that might need manual review
  // These are orders older than 14 days that are still showing as pending
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const oldPendingOrders = await prisma.order.findMany({
    where: {
      createdAt: { lt: fourteenDaysAgo },
      paymentHoldStatus: "HELD",
      stripePayoutStatus: { not: "completed" },
    },
    select: {
      id: true,
      createdAt: true,
      shipmentStatus: true,
      stripePayoutStatus: true,
    },
  });

  if (oldPendingOrders.length > 0) {
    console.info(`\n Found ${oldPendingOrders.length} old orders (>14 days) still in HELD status:`);
    console.info("These may need manual review:\n");
    oldPendingOrders.forEach((order) => {
      console.info(`  - ${order.id}`);
      console.info(`    Created: ${order.createdAt.toISOString()}`);
      console.info(`    Shipment: ${order.shipmentStatus}`);
      console.info(`    Payout Status: ${order.stripePayoutStatus || "null"}\n`);
    });
  }

  // 3. Summary
  const summary = await prisma.order.groupBy({
    by: ["paymentHoldStatus"],
    _count: { id: true },
  });

  console.info("\n=== Final Order Status Summary ===");
  summary.forEach((row) => {
    console.info(`${row.paymentHoldStatus}: ${row._count.id} orders`);
  });

  console.info("\nData migration complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
