/**
 * Logging Utilities for Error Tracking
 *
 * Provides structured logging with error IDs for Sentry integration.
 * Use these functions instead of console.error for production-ready error handling.
 *
 * TODO: Integrate with Sentry SDK when configured
 */

export interface LogContext {
  errorId: string;
  userId?: string | null;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Log an error with structured context for monitoring and debugging.
 *
 * @param message - Human-readable error description
 * @param error - The error object (if available)
 * @param context - Additional context (errorId, userId, etc.)
 *
 * @example
 * ```typescript
 * logError(
 *   "Failed to authenticate user request",
 *   error,
 *   {
 *     errorId: AUTH_CLERK_REQUEST_FAILED,
 *     userId: clerkId,
 *     requestId: req.headers.get('x-request-id')
 *   }
 * );
 * ```
 */
export function logError(message: string, error: unknown, context: LogContext): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Structured log output
  console.error(`[${context.errorId}] ${message}`, {
    message: errorMessage,
    stack: errorStack,
    ...context,
  });

  // TODO: Send to Sentry
  // Sentry.captureException(error, {
  //   tags: { errorId: context.errorId },
  //   contexts: { custom: context },
  // });
}

/**
 * Log debug information (won't be sent to Sentry in production).
 *
 * @param message - Debug message
 * @param data - Additional data to log
 *
 * @example
 * ```typescript
 * logDebug("User favourites fetched", { userId, count: favourites.length });
 * ```
 */
export function logDebug(message: string, data?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`[DEBUG] ${message}`, data);
  }
}

/**
 * Log a warning that doesn't require immediate action but should be monitored.
 *
 * @param message - Warning message
 * @param context - Additional context
 *
 * @example
 * ```typescript
 * logWarning("User not synced, returning empty favourites", { userId: clerkId });
 * ```
 */
export function logWarning(message: string, context?: Record<string, unknown>): void {
  console.warn(`[WARN] ${message}`, context);

  // TODO: Send to Sentry as warning level
  // Sentry.captureMessage(message, {
  //   level: 'warning',
  //   contexts: { custom: context },
  // });
}
