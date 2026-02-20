/**
 * Breadcrumb logging for TurboModule debugging
 *
 * These breadcrumbs help trace crash origins when TurboModules fail.
 * Format is structured for future Sentry integration.
 *
 * The crash in ObjCTurboModule::performVoidMethodInvocation was traced to
 * concurrent TurboModule calls (SecureStore, Notifications, Stripe) during
 * navigation. These breadcrumbs help identify which module triggers the abort.
 */

type BreadcrumbCategory =
  | "turbomodule.securestore"
  | "turbomodule.stripe"
  | "turbomodule.notifications"
  | "navigation"
  | "api";

interface Breadcrumb {
  category: BreadcrumbCategory;
  message: string;
  data?: Record<string, unknown>;
  level: "debug" | "info" | "warning" | "error";
  timestamp: number;
}

// Circular buffer of last 50 breadcrumbs for crash debugging
const breadcrumbs: Breadcrumb[] = [];
const MAX_BREADCRUMBS = 50;

/**
 * Add a breadcrumb to the trace buffer
 *
 * @param category - Category of the operation (e.g., 'turbomodule.securestore')
 * @param message - Human-readable description of the operation
 * @param data - Optional additional data to include
 * @param level - Severity level (default: 'info')
 */
export function addBreadcrumb(
  category: BreadcrumbCategory,
  message: string,
  data?: Record<string, unknown>,
  level: Breadcrumb["level"] = "info"
): void {
  const breadcrumb: Breadcrumb = {
    category,
    message,
    data,
    level,
    timestamp: Date.now(),
  };

  breadcrumbs.push(breadcrumb);
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }

  // Log to console in dev for immediate visibility
  // Standard React Native __DEV__ global
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const prefix = level === "error" ? "[ERROR]" : level === "warning" ? "[WARN]" : "[INFO]";
    console.log(`${prefix} [${category}] ${message}`, data || "");
  }
}

/**
 * Get all breadcrumbs (for crash reports or debugging)
 */
export function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbs];
}

/**
 * Clear all breadcrumbs (e.g., after successful operation or for testing)
 */
export function clearBreadcrumbs(): void {
  breadcrumbs.length = 0;
}

/**
 * Get breadcrumbs formatted for logging/crash reports
 */
export function formatBreadcrumbsForReport(): string {
  return breadcrumbs
    .map((b) => {
      const time = new Date(b.timestamp).toISOString();
      const dataStr = b.data ? ` ${JSON.stringify(b.data)}` : "";
      return `[${time}] [${b.level}] [${b.category}] ${b.message}${dataStr}`;
    })
    .join("\n");
}
