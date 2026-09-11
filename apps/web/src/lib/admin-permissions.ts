/**
 * Who may do what in the admin portal. Pure — no Prisma, no Clerk — so the
 * rules are unit-testable and readable in one place.
 *
 * Two staff roles:
 * - SUPPORT: read everything, triage buyer issues, hide listings. Nothing that
 *   moves money or changes who someone is.
 * - ADMIN: everything.
 */

export type StaffRole = "SUPPORT" | "ADMIN";

export type AdminPermission =
  | "users.view"
  | "users.suspend"
  | "users.role"
  | "orders.view"
  | "orders.refund"
  | "orders.release"
  | "orders.hold"
  | "orders.shipment"
  | "issues.view"
  | "issues.triage"
  | "issues.resolve"
  | "listings.view"
  | "listings.hide"
  | "listings.edit"
  | "reference.manage"
  | "marketing.view"
  | "marketing.export"
  | "audit.view";

/** Everything SUPPORT may do. Anything not listed here is ADMIN-only. */
const SUPPORT_PERMISSIONS: ReadonlySet<AdminPermission> = new Set<AdminPermission>([
  "users.view",
  "orders.view",
  "issues.view",
  "issues.triage",
  "listings.view",
  "listings.hide",
  "marketing.view",
  "audit.view",
]);

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return role === "SUPPORT" || role === "ADMIN";
}

export function can(role: StaffRole, permission: AdminPermission): boolean {
  if (role === "ADMIN") return true;
  return SUPPORT_PERMISSIONS.has(permission);
}

/**
 * Clerk IDs that are ADMIN regardless of the database role. This is the
 * bootstrap: the first admin is set here, then promotes others from the UI.
 * Same parsing as the coming-soon bypass in proxy.ts.
 */
export function parseAdminUserIds(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** The effective role once the bootstrap list has been applied. */
export function effectiveRole(
  storedRole: string,
  clerkId: string,
  bootstrapIds: readonly string[]
): StaffRole | null {
  if (bootstrapIds.includes(clerkId)) return "ADMIN";
  return isStaffRole(storedRole) ? storedRole : null;
}
