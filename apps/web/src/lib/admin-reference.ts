import { Prisma, prisma, ClubKind } from "@buttergolf/db";
import { recordAdminAction, type AdminTargetType } from "@/lib/admin-audit";
import { AdminOrderError } from "@/lib/admin-orders";

/**
 * CRUD for the lookup tables listings draw from: brands, categories, club
 * models. Slugs are derived from names; anything referenced by a listing (or,
 * for brands, by a club model) can't be deleted.
 */

export type ReferenceKind = "brands" | "categories" | "club-models";

export function isReferenceKind(value: string): value is ReferenceKind {
  return value === "brands" || value === "categories" || value === "club-models";
}

const TARGET: Record<ReferenceKind, AdminTargetType> = {
  brands: "brand",
  categories: "category",
  "club-models": "clubModel",
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function requireName(value: unknown, max = 80): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 1 || name.length > max) {
    throw new AdminOrderError(`Name must be 1-${max} characters`);
  }
  return name;
}

function optionalText(value: unknown, max = 500): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new AdminOrderError("Expected text");
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function optionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AdminOrderError("Expected a whole number");
  }
  return value;
}

function isClubKind(value: unknown): value is ClubKind {
  return typeof value === "string" && Object.values(ClubKind).includes(value as ClubKind);
}

async function uniqueSlug(kind: "brands" | "categories", name: string, excludeId?: string) {
  const base = slugify(name) || "item";
  const table = kind === "brands" ? prisma.brand : prisma.category;
  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    // Both delegates expose the same findFirst shape for this query.
    const existing = await (table as typeof prisma.brand).findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw new AdminOrderError("Could not find a free slug for that name");
}

function conflict(error: unknown, message: string): never {
  if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
    throw new AdminOrderError(message, 409);
  }
  throw error;
}

export async function createReference(
  kind: ReferenceKind,
  actorId: string,
  body: Record<string, unknown>
) {
  let id: string;
  let summary: Prisma.InputJsonObject;

  try {
    if (kind === "brands") {
      const name = requireName(body.name);
      const brand = await prisma.brand.create({
        data: {
          name,
          slug: await uniqueSlug("brands", name),
          logoUrl: optionalText(body.logoUrl, 1000) ?? null,
          sortOrder: optionalInt(body.sortOrder) ?? 0,
        },
      });
      id = brand.id;
      summary = { name: brand.name, slug: brand.slug };
    } else if (kind === "categories") {
      const name = requireName(body.name);
      const category = await prisma.category.create({
        data: {
          name,
          slug: await uniqueSlug("categories", name),
          description: optionalText(body.description) ?? null,
          imageUrl: optionalText(body.imageUrl, 1000) ?? null,
          sortOrder: optionalInt(body.sortOrder) ?? 0,
        },
      });
      id = category.id;
      summary = { name: category.name, slug: category.slug };
    } else {
      const name = requireName(body.name, 120);
      if (typeof body.brandId !== "string") throw new AdminOrderError("Choose a brand");
      if (!isClubKind(body.kind)) throw new AdminOrderError("Choose a club kind");
      const brand = await prisma.brand.findUnique({
        where: { id: body.brandId },
        select: { id: true },
      });
      if (!brand) throw new AdminOrderError("Unknown brand");
      const model = await prisma.clubModel.create({
        data: { brandId: brand.id, name, kind: body.kind, isVerified: body.isVerified !== false },
      });
      id = model.id;
      summary = { name: model.name, kind: model.kind, brandId: brand.id };
    }
  } catch (error) {
    conflict(error, "Something with that name already exists");
  }

  await recordAdminAction(prisma, {
    actorId,
    action: `${TARGET[kind]}.create`,
    targetType: TARGET[kind],
    targetId: id,
    metadata: summary,
  });
  return { id };
}

export async function updateReference(
  kind: ReferenceKind,
  id: string,
  actorId: string,
  body: Record<string, unknown>
) {
  const changes: Record<string, Prisma.InputJsonValue> = {};

  try {
    if (kind === "brands") {
      const brand = await prisma.brand.findUnique({ where: { id } });
      if (!brand) throw new AdminOrderError("Brand not found", 404);
      const data: Prisma.BrandUpdateInput = {};
      if (body.name !== undefined) {
        const name = requireName(body.name);
        if (name !== brand.name) {
          data.name = name;
          data.slug = await uniqueSlug("brands", name, brand.id);
          changes.name = { from: brand.name, to: name };
        }
      }
      const logoUrl = optionalText(body.logoUrl, 1000);
      if (logoUrl !== undefined && logoUrl !== brand.logoUrl) {
        data.logoUrl = logoUrl;
        changes.logoUrl = { from: brand.logoUrl, to: logoUrl };
      }
      const sortOrder = optionalInt(body.sortOrder);
      if (sortOrder !== undefined && sortOrder !== brand.sortOrder) {
        data.sortOrder = sortOrder;
        changes.sortOrder = { from: brand.sortOrder, to: sortOrder };
      }
      if (Object.keys(changes).length > 0) await prisma.brand.update({ where: { id }, data });
    } else if (kind === "categories") {
      const category = await prisma.category.findUnique({ where: { id } });
      if (!category) throw new AdminOrderError("Category not found", 404);
      const data: Prisma.CategoryUpdateInput = {};
      if (body.name !== undefined) {
        const name = requireName(body.name);
        if (name !== category.name) {
          data.name = name;
          data.slug = await uniqueSlug("categories", name, category.id);
          changes.name = { from: category.name, to: name };
        }
      }
      const description = optionalText(body.description);
      if (description !== undefined && description !== category.description) {
        data.description = description;
        changes.description = { from: category.description, to: description };
      }
      const imageUrl = optionalText(body.imageUrl, 1000);
      if (imageUrl !== undefined && imageUrl !== category.imageUrl) {
        data.imageUrl = imageUrl;
        changes.imageUrl = { from: category.imageUrl, to: imageUrl };
      }
      const sortOrder = optionalInt(body.sortOrder);
      if (sortOrder !== undefined && sortOrder !== category.sortOrder) {
        data.sortOrder = sortOrder;
        changes.sortOrder = { from: category.sortOrder, to: sortOrder };
      }
      if (Object.keys(changes).length > 0) await prisma.category.update({ where: { id }, data });
    } else {
      const model = await prisma.clubModel.findUnique({ where: { id } });
      if (!model) throw new AdminOrderError("Club model not found", 404);
      const data: Prisma.ClubModelUpdateInput = {};
      if (body.name !== undefined) {
        const name = requireName(body.name, 120);
        if (name !== model.name) {
          data.name = name;
          changes.name = { from: model.name, to: name };
        }
      }
      if (body.kind !== undefined) {
        if (!isClubKind(body.kind)) throw new AdminOrderError("Invalid club kind");
        if (body.kind !== model.kind) {
          data.kind = body.kind;
          changes.kind = { from: model.kind, to: body.kind };
        }
      }
      if (typeof body.isVerified === "boolean" && body.isVerified !== model.isVerified) {
        data.isVerified = body.isVerified;
        changes.isVerified = { from: model.isVerified, to: body.isVerified };
      }
      if (Object.keys(changes).length > 0) await prisma.clubModel.update({ where: { id }, data });
    }
  } catch (error) {
    conflict(error, "Something with that name already exists");
  }

  if (Object.keys(changes).length === 0) return { changed: false };

  await recordAdminAction(prisma, {
    actorId,
    action: `${TARGET[kind]}.update`,
    targetType: TARGET[kind],
    targetId: id,
    metadata: changes,
  });
  return { changed: true };
}

export async function deleteReference(kind: ReferenceKind, id: string, actorId: string) {
  let summary: Prisma.InputJsonObject;

  if (kind === "brands") {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true, clubModels: true } } },
    });
    if (!brand) throw new AdminOrderError("Brand not found", 404);
    if (brand._count.products > 0 || brand._count.clubModels > 0) {
      throw new AdminOrderError(
        `"${brand.name}" is used by ${brand._count.products} listings and ${brand._count.clubModels} club models`,
        409
      );
    }
    await prisma.brand.delete({ where: { id } });
    summary = { name: brand.name };
  } else if (kind === "categories") {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new AdminOrderError("Category not found", 404);
    if (category._count.products > 0) {
      throw new AdminOrderError(
        `"${category.name}" is used by ${category._count.products} listings`,
        409
      );
    }
    await prisma.category.delete({ where: { id } });
    summary = { name: category.name };
  } else {
    const model = await prisma.clubModel.findUnique({ where: { id }, include: { brand: true } });
    if (!model) throw new AdminOrderError("Club model not found", 404);
    await prisma.clubModel.delete({ where: { id } });
    summary = { name: model.name, brand: model.brand.name, kind: model.kind };
  }

  await recordAdminAction(prisma, {
    actorId,
    action: `${TARGET[kind]}.delete`,
    targetType: TARGET[kind],
    targetId: id,
    metadata: summary,
  });
  return { deleted: true };
}
