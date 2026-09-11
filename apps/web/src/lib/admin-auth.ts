import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  can,
  effectiveRole,
  parseAdminUserIds,
  type AdminPermission,
  type StaffRole,
} from "@/lib/admin-permissions";

/**
 * Staff identity for the admin portal.
 *
 * The role is the `users.role` column, except that Clerk IDs in
 * ADMIN_USER_IDS are always ADMIN (bootstrap). Deleted users are never staff,
 * whatever the column says.
 */
export interface AdminUser {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
}

const ADMIN_SELECT = {
  id: true,
  clerkId: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isDeleted: true,
} as const;

async function resolveAdmin(clerkId: string | null): Promise<AdminUser | null> {
  if (!clerkId) return null;

  const user = await prisma.user.findUnique({ where: { clerkId }, select: ADMIN_SELECT });
  if (!user || user.isDeleted) return null;

  const role = effectiveRole(user.role, clerkId, parseAdminUserIds(process.env.ADMIN_USER_IDS));
  if (!role) return null;

  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role,
  };
}

/** For server components under /admin. Null means "not staff". */
export async function getAdminForPage(): Promise<AdminUser | null> {
  const { userId } = await auth();
  return resolveAdmin(userId);
}

/** For API routes. Accepts cookies, Clerk Bearer tokens and mobile session tokens. */
export async function getAdminFromRequest(request: Request): Promise<AdminUser | null> {
  return resolveAdmin(await getUserIdFromRequest(request));
}

export type AdminGuard =
  | { admin: AdminUser; response?: undefined }
  | { admin?: undefined; response: NextResponse };

/**
 * Gate an admin API route. Usage:
 *
 *   const guard = await requireAdmin(request, "orders.refund");
 *   if (guard.response) return guard.response;
 *   const { admin } = guard;
 *
 * 401 when not signed in, 403 when signed in but not staff or lacking the
 * permission. The distinction matters little to a browser but keeps logs honest.
 */
export async function requireAdmin(
  request: Request,
  permission?: AdminPermission
): Promise<AdminGuard> {
  const clerkId = await getUserIdFromRequest(request);
  if (!clerkId) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = await resolveAdmin(clerkId);
  if (!admin) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (permission && !can(admin.role, permission)) {
    return {
      response: NextResponse.json(
        { error: "Your role does not allow this action" },
        { status: 403 }
      ),
    };
  }

  return { admin };
}
