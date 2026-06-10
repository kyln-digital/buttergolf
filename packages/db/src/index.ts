// Type-only import to avoid bundling @prisma/client in React Native.
// Import from the custom output location configured in schema.prisma

import type { PrismaClient } from "../generated/client";

// Determine if we're running in a React Native environment.
const isReactNative =
  typeof navigator !== "undefined" && (navigator as { product?: string }).product === "ReactNative";

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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: PrismaClientRuntime } = require("../generated/client") as {
    PrismaClient: new (options?: unknown) => PrismaClient;
  };

  const instance =
    globalForPrisma.prisma ??
    new PrismaClientRuntime({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = instance;

  return instance;
})();

export { prisma };
// Re-export Prisma types for type-safe database queries
// Import from custom output location

export type {
  Prisma,
  Order,
  Conversation,
  Message,
  Offer,
  CounterOffer,
} from "../generated/client";
// Re-export ALL enums as values (not type-only) so consumers can use them at
// runtime (e.g. OrderStatus.SHIPPED) - keep this list symmetrical.
export {
  ProductCondition,
  PaymentHoldStatus,
  PromotionType,
  PromotionStatus,
  OfferStatus,
  MessageType,
  ClubKind,
  ShipmentStatus,
  OrderStatus,
} from "../generated/client";
