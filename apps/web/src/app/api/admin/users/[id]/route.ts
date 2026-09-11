import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/admin-audit";
import { can, isStaffRole, parseAdminUserIds } from "@/lib/admin-permissions";
import { readJsonObject } from "@/lib/json-body";
import { sendAccountSuspensionEmail } from "@/lib/email";

const ROLES = ["USER", "SUPPORT", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * PATCH /api/admin/users/[id]
 *
 * Body is one of:
 *   { role: "USER" | "SUPPORT" | "ADMIN" }      users.role (ADMIN)
 *   { suspend: true, reason: string }            users.suspend (ADMIN)
 *   { suspend: false }                           users.suspend (ADMIN)
 *
 * Nobody can act on their own account. Staff can't be suspended (demote
 * first). Deleted accounts are read-only.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin(request, "users.view");
    if (guard.response) return guard.response;
    const { admin } = guard;

    const { id } = await params;
    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        role: true,
        suspendedAt: true,
        isDeleted: true,
      },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.id === admin.id) {
      return NextResponse.json({ error: "You can't change your own account" }, { status: 400 });
    }
    if (target.isDeleted) {
      return NextResponse.json({ error: "This account was deleted" }, { status: 400 });
    }

    // ── Role change ──
    if ("role" in body) {
      if (!can(admin.role, "users.role")) {
        return NextResponse.json({ error: "Only an ADMIN can change roles" }, { status: 403 });
      }
      const role = body.role;
      if (!isRole(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      if (role === target.role) {
        return NextResponse.json({ ok: true, role });
      }
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: target.id }, data: { role } });
        await recordAdminAction(tx, {
          actorId: admin.id,
          action: "user.role",
          targetType: "user",
          targetId: target.id,
          metadata: { from: target.role, to: role },
        });
      });
      const bootstrap = parseAdminUserIds(process.env.ADMIN_USER_IDS).includes(target.clerkId);
      return NextResponse.json({
        ok: true,
        role,
        note:
          bootstrap && role !== "ADMIN"
            ? "This Clerk ID is in ADMIN_USER_IDS, so they remain ADMIN until it is removed from the environment."
            : undefined,
      });
    }

    // ── Suspension ──
    if ("suspend" in body) {
      if (!can(admin.role, "users.suspend")) {
        return NextResponse.json({ error: "Only an ADMIN can suspend accounts" }, { status: 403 });
      }
      const suspend = body.suspend === true;
      const isTargetStaff =
        isStaffRole(target.role) ||
        parseAdminUserIds(process.env.ADMIN_USER_IDS).includes(target.clerkId);

      if (suspend) {
        if (isTargetStaff) {
          return NextResponse.json(
            { error: "Staff accounts can't be suspended. Change the role to USER first." },
            { status: 400 }
          );
        }
        if (target.suspendedAt) {
          return NextResponse.json({ ok: true, suspended: true });
        }
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (reason.length < 5 || reason.length > 500) {
          return NextResponse.json(
            { error: "Give a reason between 5 and 500 characters; the user will see it" },
            { status: 400 }
          );
        }
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: target.id },
            data: { suspendedAt: new Date(), suspendedReason: reason },
          });
          await recordAdminAction(tx, {
            actorId: admin.id,
            action: "user.suspend",
            targetType: "user",
            targetId: target.id,
            metadata: { reason },
          });
        });
        sendAccountSuspensionEmail({
          email: target.email,
          name: target.firstName || "there",
          suspended: true,
          reason,
        }).catch((error) => console.error("Failed to send suspension email:", error));
        return NextResponse.json({ ok: true, suspended: true });
      }

      if (!target.suspendedAt) {
        return NextResponse.json({ ok: true, suspended: false });
      }
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: target.id },
          data: { suspendedAt: null, suspendedReason: null },
        });
        await recordAdminAction(tx, {
          actorId: admin.id,
          action: "user.unsuspend",
          targetType: "user",
          targetId: target.id,
        });
      });
      sendAccountSuspensionEmail({
        email: target.email,
        name: target.firstName || "there",
        suspended: false,
      }).catch((error) => console.error("Failed to send reinstatement email:", error));
      return NextResponse.json({ ok: true, suspended: false });
    }

    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  } catch (error) {
    console.error("Admin user update failed:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
