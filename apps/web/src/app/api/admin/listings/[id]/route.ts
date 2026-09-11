import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@buttergolf/db";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/admin-audit";
import { can } from "@/lib/admin-permissions";
import { optionalString } from "@/lib/admin-route-utils";
import { readJsonObject } from "@/lib/json-body";

/**
 * PATCH /api/admin/listings/[id]
 *
 * Body is one of:
 *   { hidden: true, reason: string } | { hidden: false }        listings.hide (SUPPORT+)
 *   { title?, price?, categoryId?, brandId? }                    listings.edit (ADMIN)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin(request, "listings.view");
    if (guard.response) return guard.response;
    const { admin } = guard;

    const { id } = await params;
    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        price: true,
        hiddenAt: true,
        categoryId: true,
        brandId: true,
      },
    });
    if (!product) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // ── Hide / unhide ──
    if ("hidden" in body) {
      if (!can(admin.role, "listings.hide")) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
      const hidden = body.hidden === true;
      if (hidden) {
        const reason = optionalString(body.reason);
        if (!reason || reason.length < 5) {
          return NextResponse.json(
            { error: "Give a reason of at least 5 characters; the seller will see it" },
            { status: 400 }
          );
        }
        await prisma.$transaction(async (tx) => {
          await tx.product.update({
            where: { id: product.id },
            data: { hiddenAt: product.hiddenAt ?? new Date(), hiddenReason: reason },
          });
          await recordAdminAction(tx, {
            actorId: admin.id,
            action: "listing.hide",
            targetType: "product",
            targetId: product.id,
            metadata: { reason },
          });
        });
        return NextResponse.json({ ok: true, hidden: true });
      }

      if (!product.hiddenAt) return NextResponse.json({ ok: true, hidden: false });
      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: product.id },
          data: { hiddenAt: null, hiddenReason: null },
        });
        await recordAdminAction(tx, {
          actorId: admin.id,
          action: "listing.unhide",
          targetType: "product",
          targetId: product.id,
        });
      });
      return NextResponse.json({ ok: true, hidden: false });
    }

    // ── Edit ──
    if (!can(admin.role, "listings.edit")) {
      return NextResponse.json({ error: "Editing listings needs an ADMIN" }, { status: 403 });
    }

    const data: Prisma.ProductUpdateInput = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (body.title !== undefined) {
      const title = optionalString(body.title, 120);
      if (!title || title.length < 3) {
        return NextResponse.json({ error: "Title must be 3-120 characters" }, { status: 400 });
      }
      data.title = title;
      changes.title = { from: product.title, to: title };
    }
    if (body.price !== undefined) {
      const price = typeof body.price === "number" ? Math.round(body.price * 100) / 100 : NaN;
      if (!Number.isFinite(price) || price <= 0 || price > 100000) {
        return NextResponse.json(
          { error: "Price must be between £0.01 and £100,000" },
          { status: 400 }
        );
      }
      data.price = price;
      changes.price = { from: product.price, to: price };
    }
    if (typeof body.categoryId === "string" && body.categoryId !== product.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
      if (!category) return NextResponse.json({ error: "Unknown category" }, { status: 400 });
      data.category = { connect: { id: category.id } };
      changes.categoryId = { from: product.categoryId, to: category.id };
    }
    if (body.brandId !== undefined && body.brandId !== product.brandId) {
      if (body.brandId === null) {
        data.brand = { disconnect: true };
        changes.brandId = { from: product.brandId, to: null };
      } else if (typeof body.brandId === "string") {
        const brand = await prisma.brand.findUnique({ where: { id: body.brandId } });
        if (!brand) return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
        data.brand = { connect: { id: brand.id } };
        changes.brandId = { from: product.brandId, to: brand.id };
      }
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ ok: true, changed: false });
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: product.id }, data });
      await recordAdminAction(tx, {
        actorId: admin.id,
        action: "listing.edit",
        targetType: "product",
        targetId: product.id,
        metadata: changes as Prisma.InputJsonObject,
      });
    });

    return NextResponse.json({ ok: true, changed: true });
  } catch (error) {
    console.error("Admin listing update failed:", error);
    return NextResponse.json({ error: "Failed to update listing" }, { status: 500 });
  }
}
