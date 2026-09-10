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

/**
 * Unique to this process. Fixtures are created under it and cleanup only
 * removes its own, so two runs in parallel — or a run alongside fixtures
 * someone made by hand — cannot delete each other's data.
 */
export const E2E_RUN_TOKEN = `${E2E_CLERK_PREFIX}${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 8)}-`;

export interface CleanupSummary {
  users: number;
  products: number;
  orders: number;
  addresses: number;
}

export async function cleanupE2eFixtures(
  options: { quiet?: boolean; prefix?: string } = {}
): Promise<CleanupSummary> {
  // Default to this run's own token. Pass E2E_CLERK_PREFIX explicitly to
  // sweep everything, which is what running this file directly does.
  const prefix = options.prefix ?? E2E_RUN_TOKEN;

  const users = await prisma.user.findMany({
    where: { clerkId: { startsWith: prefix } },
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
    where: { clerkId: { startsWith: prefix } },
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
  // Direct invocation sweeps every e2e fixture, not just this process's.
  cleanupE2eFixtures({ prefix: E2E_CLERK_PREFIX })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
