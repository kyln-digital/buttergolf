// Type-only import to avoid bundling @prisma/client in React Native.
// Import from the custom output location configured in schema.prisma

import type { PrismaClient } from "../generated/client";

// Determine if we're running in a React Native environment.
const isReactNative =
  typeof navigator !== "undefined" && (navigator as any).product === "ReactNative";

// Compute prisma instance in an IIFE so we can export a const.
const prisma: PrismaClient = (() => {
  if (isReactNative) {
    // Provide a minimal stub so imports from '@buttergolf/db' don't crash mobile.
    // Consumers should call backend API endpoints instead of using prisma directly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaStub: any = new Proxy(
      {},
      {
        get() {
          throw new Error(
            "Prisma Client is not available in React Native. Use server API routes instead."
          );
        },
      }
    );
    return prismaStub as unknown as PrismaClient;
  }

  // PrismaClient is attached to the `global` object in development to prevent
  // exhausting your database connection limit.
  const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
  };

  // Import from custom output location to fix pnpm monorepo module resolution
  const { PrismaClient: PrismaClientRuntime } = require("../generated/client") as {
    PrismaClient: new (...args: any[]) => PrismaClient;
  };

  const instance =
    globalForPrisma.prisma ??
    new PrismaClientRuntime({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    } as any);

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = instance;

  return instance;
})();

export { prisma };
// Re-export Prisma types for type-safe database queries
// Import from custom output location

export type {
  Prisma,
  ClubKind,
  ShipmentStatus,
  OrderStatus,
  OfferStatus,
  Order,
} from "../generated/client";
// Re-export enums as values (not type-only) so they can be used at runtime
export {
  ProductCondition,
  PaymentHoldStatus,
  PromotionType,
  PromotionStatus,
} from "../generated/client";
export * from "@buttergolf/constants";
