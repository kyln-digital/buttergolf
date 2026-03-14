"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface ConditionalLayoutProps {
  children: ReactNode;
  /** Routes where children should be hidden */
  excludeRoutes?: string[];
  /** When provided, children are only shown on these routes (allowlist) */
  includeRoutes?: string[];
}

/**
 * Conditionally renders children based on the current route.
 * Use this to hide layout elements (header, footer, banners) on specific routes.
 *
 * @example
 * // Hide on specific routes
 * <ConditionalLayout excludeRoutes={['/coming-soon']}>
 *   <Header />
 * </ConditionalLayout>
 *
 * @example
 * // Show only on specific routes
 * <ConditionalLayout includeRoutes={['/', '/help-centre']}>
 *   <ChatWidget />
 * </ConditionalLayout>
 */
export function ConditionalLayout({
  children,
  excludeRoutes = [],
  includeRoutes,
}: Readonly<ConditionalLayoutProps>) {
  const pathname = usePathname();

  const matchesRoute = (routes: string[]) =>
    routes.some((route) => {
      if (route.endsWith("*")) {
        // Prefix match: '/admin/*' matches '/admin/users', '/admin/settings', etc.
        return pathname?.startsWith(route.slice(0, -1));
      }
      // Exact match
      return pathname === route;
    });

  // Allowlist: only render on specified routes
  if (includeRoutes && !matchesRoute(includeRoutes)) return null;

  // Denylist: hide on excluded routes
  if (matchesRoute(excludeRoutes)) return null;

  return <>{children}</>;
}
