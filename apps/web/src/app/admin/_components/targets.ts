/** Where an audit-log target lives in the portal. */
export function targetHref(targetType: string, targetId: string): string | null {
  switch (targetType) {
    case "user":
      return `/admin/users/${targetId}`;
    case "order":
      return `/admin/orders/${targetId}`;
    case "issue":
      return `/admin/issues?issue=${targetId}`;
    case "product":
      return `/admin/listings?q=${targetId}`;
    case "brand":
    case "category":
    case "clubModel":
      return "/admin/reference";
    default:
      return null;
  }
}

export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function formatWhen(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function gbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

export function fullName(user: { firstName: string | null; lastName: string | null }): string {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "—";
}
