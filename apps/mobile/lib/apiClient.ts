import { InteractionManager } from "react-native";
import { addBreadcrumb } from "./breadcrumbs";

type GetTokenFn = () => Promise<string | null>;

/**
 * Creates an AbortError compatible with React Native.
 * DOMException doesn't exist in React Native, so we create a regular Error
 * with name="AbortError" which is what fetch implementations check for.
 */
function createAbortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

interface DeferredFetchOptions extends Omit<RequestInit, "signal"> {
  /** Function to get auth token - will be called after interactions complete */
  getToken?: GetTokenFn;
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Centralized API client that defers TurboModule access until after navigation animations.
 *
 * WHY THIS EXISTS:
 * The TestFlight crash (EXC_CRASH SIGABRT in ObjCTurboModule::performVoidMethodInvocation)
 * was caused by TurboModule calls (SecureStore for Clerk tokens) racing with react-native-svg
 * unmounting during navigation transitions.
 *
 * This client:
 * 1. Wraps ALL authenticated API calls in InteractionManager.runAfterInteractions()
 * 2. Defers auth token retrieval until navigation animations complete
 * 3. Prevents concurrent TurboModule access race conditions
 * 4. Adds breadcrumb logging for crash debugging
 *
 * USAGE:
 * Replace direct fetch() calls in screen wrappers with deferredFetch():
 *
 * ```typescript
 * // Before
 * const token = await getToken();
 * const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
 *
 * // After
 * const response = await deferredFetch(url, { getToken });
 * ```
 */
export async function deferredFetch(
  url: string,
  options: DeferredFetchOptions = {}
): Promise<Response> {
  const { getToken, signal, ...fetchOptions } = options;

  return new Promise((resolve, reject) => {
    // Check if already aborted
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        // Check again after interactions complete
        if (signal?.aborted) {
          reject(createAbortError());
          return;
        }

        addBreadcrumb("api", `Starting fetch: ${url}`);

        let headers: Record<string, string> = {
          Accept: "application/json",
          ...(fetchOptions.headers as Record<string, string>),
        };

        // Get auth token if provided (this is the TurboModule call we're deferring)
        if (getToken) {
          addBreadcrumb("turbomodule.securestore", "Getting auth token for API call");
          const token = await getToken();
          if (token) {
            headers = { ...headers, Authorization: `Bearer ${token}` };
            addBreadcrumb("turbomodule.securestore", "Auth token obtained", {
              tokenLength: token.length,
            });
          } else {
            addBreadcrumb("turbomodule.securestore", "No auth token available", {}, "warning");
          }
        }

        // Make the actual fetch
        const response = await fetch(url, {
          ...fetchOptions,
          headers,
          signal,
        });

        addBreadcrumb("api", `Fetch completed: ${url}`, {
          status: response.status,
          ok: response.ok,
        });

        resolve(response);
      } catch (error) {
        addBreadcrumb(
          "api",
          `Fetch error: ${url}`,
          { error: String(error) },
          "error"
        );
        reject(error);
      }
    });

    // Handle abort signal
    signal?.addEventListener("abort", () => {
      task.cancel();
      reject(createAbortError());
    });
  });
}

/**
 * Convenience wrapper for JSON POST requests
 */
export async function deferredPost<T>(
  url: string,
  body: unknown,
  options: DeferredFetchOptions = {}
): Promise<T> {
  const response = await deferredFetch(url, {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Convenience wrapper for JSON GET requests
 */
export async function deferredGet<T>(
  url: string,
  options: DeferredFetchOptions = {}
): Promise<T> {
  const response = await deferredFetch(url, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Convenience wrapper for DELETE requests
 */
export async function deferredDelete(
  url: string,
  options: DeferredFetchOptions = {}
): Promise<void> {
  const response = await deferredFetch(url, {
    ...options,
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }
}
