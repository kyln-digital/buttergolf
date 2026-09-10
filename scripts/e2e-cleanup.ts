/**
 * Remove fixtures left behind by the e2e scripts.
 *
 * The deployed-environment scripts write to whatever database that deployment
 * uses, which is the real one. An unsold, non-draft fixture is a live listing
 * on the site, so every script that creates them calls this in a `finally`.
 *
 * Everything is keyed off `clerkId` starting with E2E_CLERK_PREFIX, so this
 * can only ever match rows the scripts made.
 *
 * Also runnable directly to clear anything a crashed run stranded:
 *   npx tsx scripts/e2e-cleanup.ts
 */
import { prisma } from "@buttergolf/db";

export const E2E_CLERK_PREFIX = "e2e-";

export interface CleanupSummary {
  users: number;
  products: number;
  orders: number;
  addresses: number;
}

export async function cleanupE2eFixtures(
  options: { quiet?: boolean } = {}
): Promise<CleanupSummary> {
  const users = await prisma.user.findMany({
    where: { clerkId: { startsWith: E2E_CLERK_PREFIX } },
    select: { id: true },
  });

  if (users.length === 0) {
    if (!options.quiet) console.log("cleanup: nothing to remove");
    return { users: 0, products: 0, orders: 0, addresses: 0 };
  }

  const ids = users.map((u) => u.id);

  // FK-safe order: orders reference products, addresses and users without
  // cascade, so they have to go first.
  const orders = await prisma.order.deleteMany({
    where: { OR: [{ sellerId: { in: ids } }, { buyerId: { in: ids } }] },
  });
  const products = await prisma.product.deleteMany({ where: { userId: { in: ids } } });
  const addresses = await prisma.address.deleteMany({ where: { userId: { in: ids } } });
  const deletedUsers = await prisma.user.deleteMany({
    where: { clerkId: { startsWith: E2E_CLERK_PREFIX } },
  });

  const summary = {
    users: deletedUsers.count,
    products: products.count,
    orders: orders.count,
    addresses: addresses.count,
  };

  if (!options.quiet) {
    console.log(
      `cleanup: removed ${summary.orders} orders, ${summary.products} products, ` +
        `${summary.addresses} addresses, ${summary.users} users`
    );
  }

  return summary;
}

/**
 * Run cleanup without letting a failure mask the test result that preceded it.
 */
export async function cleanupQuietly(): Promise<void> {
  try {
    await cleanupE2eFixtures();
  } catch (error) {
    console.error("cleanup failed — remove e2e-* rows manually:", error);
  }
}

// Direct invocation: `npx tsx scripts/e2e-cleanup.ts`
if (process.argv[1]?.endsWith("e2e-cleanup.ts")) {
  cleanupE2eFixtures()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
