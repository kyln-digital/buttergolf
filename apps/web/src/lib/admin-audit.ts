import { Prisma, prisma } from "@buttergolf/db";

/**
 * Append-only audit trail for the admin portal. Every mutating admin route
 * records one row, inside the same transaction as the change when there is
 * one, so the log can never claim something that didn't happen.
 */

export type AdminTargetType =
  | "user"
  | "order"
  | "issue"
  | "product"
  | "brand"
  | "category"
  | "clubModel";

export interface AdminActionInput {
  actorId: string;
  /** Dotted verb, e.g. "user.suspend", "order.refund", "listing.hide". */
  action: string;
  targetType: AdminTargetType;
  targetId: string;
  /** Anything useful for reading the log later: reason, amount, old/new values. */
  metadata?: Prisma.InputJsonValue;
}

type Db = Prisma.TransactionClient | typeof prisma;

export async function recordAdminAction(db: Db, input: AdminActionInput): Promise<void> {
  await db.adminAction.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
    },
  });
}
