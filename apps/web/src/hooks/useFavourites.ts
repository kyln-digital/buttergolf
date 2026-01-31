"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * Hook to manage the user's complete favourites list
 * Fetches all favourited product IDs on mount and maintains a Set for fast lookups
 */
export function useFavourites() {
  const { user, isLoaded } = useUser();
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's favourites on mount
  useEffect(() => {
    async function fetchFavourites() {
      if (!isLoaded) return;

      if (!user) {
        setFavourites(new Set());
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch all favourites (no pagination needed for the Set)
        const response = await fetch("/api/favourites?limit=1000");

        // Handle 401 gracefully - user not authenticated yet (Clerk timing issue)
        if (response.status === 401) {
          setFavourites(new Set());
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch favourites");
        }

        const data = await response.json();
        const favouriteIds = new Set<string>(
          (data.products ?? []).map((p: { id: string }) => p.id)
        );

        setFavourites(favouriteIds);
      } catch (err) {
        console.error("Error fetching favourites:", err);
        setError(err instanceof Error ? err.message : "Failed to load favourites");
        setFavourites(new Set());
      } finally {
        setLoading(false);
      }
    }

    fetchFavourites();
  }, [user, isLoaded]);

  /**
   * Check if a product is favourited
   */
  const isFavourited = (productId: string): boolean => {
    return favourites.has(productId);
  };

  /**
   * Add a product to favourites (for optimistic updates from useFavouriteToggle)
   */
  const addToFavourites = (productId: string) => {
    setFavourites((prev) => new Set(prev).add(productId));
  };

  /**
   * Remove a product from favourites (for optimistic updates from useFavouriteToggle)
   */
  const removeFromFavourites = (productId: string) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
  };

  /**
   * Refresh favourites from server
   */
  const refresh = async () => {
    if (!user) return;

    try {
      const response = await fetch("/api/favourites?limit=1000");

      // Handle 401 gracefully - user not authenticated
      if (response.status === 401) {
        setFavourites(new Set());
        return;
      }

      if (!response.ok) throw new Error("Failed to refresh favourites");

      const data = await response.json();
      const favouriteIds = new Set<string>((data.products ?? []).map((p: { id: string }) => p.id));

      setFavourites(favouriteIds);
    } catch (err) {
      console.error("Error refreshing favourites:", err);
    }
  };

  return {
    favourites,
    isFavourited,
    addToFavourites,
    removeFromFavourites,
    refresh,
    loading,
    error,
    isAuthenticated: !!user,
  };
}
