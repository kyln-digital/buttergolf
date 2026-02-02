import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { sendAutoReleaseReminderEmail } from "@/lib/email";

// Vercel Cron configuration
// Schedule: Run daily at 10:00 AM UTC
// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/payment-reminders",
//     "schedule": "0 10 * * *"
//   }]
// }

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max

// Days before auto-release to send reminders
const REMINDER_DAYS = [7, 3, 1];

/**
 * GET /api/cron/payment-reminders
 *
 * Send reminder emails to buyers about upcoming auto-release.
 *
 * Sends reminders at:
 * - 7 days before auto-release
 * - 3 days before auto-release
 * - 1 day before auto-release
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security (MANDATORY)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured - refusing to send reminders");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized cron request - invalid or missing secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("Starting payment reminder cron job...");

  const results: Array<{
    orderId: string;
    daysUntilRelease: number;
    status: "sent" | "failed" | "skipped";
    error?: string;
  }> = [];

  try {
    // Process each reminder day
    for (const daysUntilRelease of REMINDER_DAYS) {
      // Calculate target date (X days from now)
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysUntilRelease);

      // Find orders with auto-release on the target date
      // We look for orders where autoReleaseAt falls within the target day
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const ordersToRemind = await prisma.order.findMany({
        where: {
          paymentHoldStatus: "HELD",
          autoReleaseAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
          shipmentStatus: "DELIVERED",
        },
        include: {
          buyer: true,
          seller: true,
          product: true,
        },
      });

      console.log(`Found ${ordersToRemind.length} orders for ${daysUntilRelease}-day reminder`);

      for (const order of ordersToRemind) {
        try {
          // Skip if buyer doesn't have email
          if (!order.buyer?.email) {
            console.warn("Buyer missing email:", { orderId: order.id });
            results.push({
              orderId: order.id,
              daysUntilRelease,
              status: "skipped",
              error: "Buyer missing email",
            });
            continue;
          }

          // Send reminder email
          const emailResult = await sendAutoReleaseReminderEmail({
            buyerEmail: order.buyer.email,
            buyerName: order.buyer.firstName || "Customer",
            orderId: order.id,
            productTitle: order.product.title,
            daysUntilRelease,
            autoReleaseDate: order.autoReleaseAt!,
            sellerPayout: order.stripeSellerPayout || 0,
          });

          if (emailResult.success) {
            console.log("Reminder email sent:", {
              orderId: order.id,
              daysUntilRelease,
              emailId: emailResult.id,
            });
            results.push({
              orderId: order.id,
              daysUntilRelease,
              status: "sent",
            });
          } else {
            console.error("Failed to send reminder email:", {
              orderId: order.id,
              error: emailResult.error,
            });
            results.push({
              orderId: order.id,
              daysUntilRelease,
              status: "failed",
              error: emailResult.error,
            });
          }
        } catch (orderError) {
          console.error("Error processing order:", {
            orderId: order.id,
            error: orderError instanceof Error ? orderError.message : "Unknown error",
          });
          results.push({
            orderId: order.id,
            daysUntilRelease,
            status: "failed",
            error: orderError instanceof Error ? orderError.message : "Unknown error",
          });
        }
      }
    }

    const sentCount = results.filter((r) => r.status === "sent").length;
    const failedCount = results.filter((r) => r.status === "failed").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;

    console.log("Payment reminder cron job completed:", {
      total: results.length,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} reminder checks`,
      sentCount,
      failedCount,
      skippedCount,
      results,
    });
  } catch (error) {
    console.error("Payment reminder cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
