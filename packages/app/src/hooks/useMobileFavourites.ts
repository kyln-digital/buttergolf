"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface UseMobileFavouritesOptions {
  /** Base API URL (e.g., http://localhost:3000) */
  apiUrl: string;
  /** Function to get auth token from Clerk */
  getToken: () => Promise<string | null>;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
}

interface FavouritesState {
  favourites: Set<string>;
  loading: boolean;
  error: string | null;
}

/**
 * Mobile-compatible favourites hook that works with the Next.js API.
 * 
 * Unlike the web version which uses Clerk's session directly,
 * this hook accepts the API URL and token getter as props
 * to work with React Native's different auth flow.
 */
export function useMobileFavourites({
  apiUrl,
  getToken,
  isAuthenticated,
}: UseMobileFavouritesOptions) {
  const [state, setState] = useState<FavouritesState>({
    favourites: new Set(),
    loading: true,
    error: null,
  });

  // Use refs for functions to avoid them triggering useEffect reruns
  const getTokenRef = useRef(getToken);
  const apiUrlRef = useRef(apiUrl);
  
  // Keep refs updated
  useEffect(() => {
    getTokenRef.current = getToken;
    apiUrlRef.current = apiUrl;
  });

  // Fetch user's favourites on mount and when auth changes
  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    async function fetchFavourites() {
      if (!isAuthenticated) {
        setState({ favourites: new Set(), loading: false, error: null });
        return;
      }

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const token = await getTokenRef.current();
        
        // Debug: Log token retrieval
        console.log("[useMobileFavourites] Token retrieval:", {
          hasToken: !!token,
          tokenLength: token?.length,
          tokenPrefix: token?.substring(0, 20),
          apiUrl: apiUrlRef.current,
        });
        
        if (!token || cancelled || abortController.signal.aborted) {
          console.log("[useMobileFavourites] No token or cancelled, returning empty");
          if (!cancelled && !abortController.signal.aborted) {
            setState({ favourites: new Set(), loading: false, error: null });
          }
          return;
        }

        const url = `${apiUrlRef.current}/api/favourites?limit=1000`;
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };
        
        console.log("[useMobileFavourites] Making request:", {
          url,
          hasAuthHeader: !!headers.Authorization,
          authHeaderLength: headers.Authorization?.length,
        });
        
        const response = await fetch(url, { 
          headers,
          signal: abortController.signal,
        });

        if (cancelled || abortController.signal.aborted) return;

        // Handle 401 gracefully
        if (response.status === 401) {
          setState({ favourites: new Set(), loading: false, error: null });
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch favourites");
        }

        const data = await response.json();
        const favouriteIds = new Set<string>(
          (data.products ?? []).map((p: { id: string }) => p.id)
        );

        if (!cancelled && !abortController.signal.aborted) {
          setState({ favourites: favouriteIds, loading: false, error: null });
        }
      } catch (err) {
        // Ignore abort errors - they're expected during cleanup
        if (err instanceof Error && err.name === "AbortError") {
          console.log("[useMobileFavourites] Fetch aborted (cleanup)");
          return;
        }
        console.error("Error fetching favourites:", err);
        if (!cancelled && !abortController.signal.aborted) {
          setState({
            favourites: new Set(),
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load favourites",
          });
        }
      }
    }

    fetchFavourites();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [isAuthenticated]); // Only depend on isAuthenticated

  /**
   * Check if a product is favourited
   */
  const isFavourited = useCallback(
    (productId: string): boolean => {
      return state.favourites.has(productId);
    },
    [state.favourites]
  );

  /**
   * Toggle favourite with optimistic update
   */
  const toggleFavourite = useCallback(
    async (productId: string): Promise<{ success: boolean; requiresAuth?: boolean }> => {
      if (!isAuthenticated) {
        return { success: false, requiresAuth: true };
      }

      const wasOptimisticAdd = !state.favourites.has(productId);

      // Optimistic update
      setState((prev) => {
        const next = new Set(prev.favourites);
        if (wasOptimisticAdd) {
          next.add(productId);
        } else {
          next.delete(productId);
        }
        return { ...prev, favourites: next };
      });

      try {
        const token = await getTokenRef.current();
        if (!token) {
          // Rollback
          setState((prev) => {
            const next = new Set(prev.favourites);
            if (wasOptimisticAdd) {
              next.delete(productId);
            } else {
              next.add(productId);
            }
            return { ...prev, favourites: next };
          });
          return { success: false, requiresAuth: true };
        }

        const currentApiUrl = apiUrlRef.current;
        const response = await fetch(
          wasOptimisticAdd
            ? `${currentApiUrl}/api/favourites`
            : `${currentApiUrl}/api/favourites/${productId}`,
          {
            method: wasOptimisticAdd ? "POST" : "DELETE",
            headers: {
              ...(wasOptimisticAdd ? { "Content-Type": "application/json" } : {}),
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            body: wasOptimisticAdd ? JSON.stringify({ productId }) : undefined,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update favourite");
        }

        return { success: true };
      } catch (error) {
        console.error("Error toggling favourite:", error);

        // Rollback optimistic update
        setState((prev) => {
          const next = new Set(prev.favourites);
          if (wasOptimisticAdd) {
            next.delete(productId);
          } else {
            next.add(productId);
          }
          return { ...prev, favourites: next };
        });

        return { success: false };
      }
    },
    [isAuthenticated, state.favourites]
  );

  /**
   * Add to favourites (for external use)
   */
  const addToFavourites = useCallback((productId: string) => {
    setState((prev) => {
      const next = new Set(prev.favourites);
      next.add(productId);
      return { ...prev, favourites: next };
    });
  }, []);

  /**
   * Remove from favourites (for external use)
   */
  const removeFromFavourites = useCallback((productId: string) => {
    setState((prev) => {
      const next = new Set(prev.favourites);
      next.delete(productId);
      return { ...prev, favourites: next };
    });
  }, []);

  /**
   * Refresh favourites from server
   */
  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const token = await getTokenRef.current();
      if (!token) return;

      const response = await fetch(`${apiUrlRef.current}/api/favourites?limit=1000`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        setState((prev) => ({ ...prev, favourites: new Set() }));
        return;
      }

      if (!response.ok) throw new Error("Failed to refresh favourites");

      const data = await response.json();
      const favouriteIds = new Set<string>(
        (data.products ?? []).map((p: { id: string }) => p.id)
      );

      setState((prev) => ({ ...prev, favourites: favouriteIds }));
    } catch (err) {
      console.error("Error refreshing favourites:", err);
    }
  }, [isAuthenticated]);

  return {
    favourites: state.favourites,
    isFavourited,
    toggleFavourite,
    addToFavourites,
    removeFromFavourites,
    refresh,
    loading: state.loading,
    error: state.error,
    isAuthenticated,
  };
}
