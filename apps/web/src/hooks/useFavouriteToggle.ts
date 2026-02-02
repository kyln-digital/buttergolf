"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useFavouritesContext } from "../providers/FavouritesProvider";

/**
 * Hook to toggle a single product's favourite status with optimistic updates
 * Handles API calls, rollback on error, and shows toast notifications
 */
export function useFavouriteToggle(productId: string) {
  const { user } = useUser();
  const {
    isFavourited: isGloballyFavourited,
    addToFavourites,
    removeFromFavourites,
  } = useFavouritesContext();

  const [isUpdating, setIsUpdating] = useState(false);
  const isFavourited = isGloballyFavourited(productId);

  /**
   * Toggle favourite with optimistic update and rollback on error
   */
  const toggleFavourite = async () => {
    // Require authentication
    if (!user) {
      // Trigger sign-in modal (handled by parent component)
      return { requiresAuth: true };
    }

    // Prevent concurrent updates
    if (isUpdating) return { success: false };

    const wasOptimisticUpdate = !isFavourited;

    try {
      setIsUpdating(true);

      // Optimistic update
      if (wasOptimisticUpdate) {
        addToFavourites(productId);
      } else {
        removeFromFavourites(productId);
      }

      // API call
      const response = await fetch(
        wasOptimisticUpdate ? "/api/favourites" : `/api/favourites/${productId}`,
        {
          method: wasOptimisticUpdate ? "POST" : "DELETE",
          headers: wasOptimisticUpdate ? { "Content-Type": "application/json" } : {},
          body: wasOptimisticUpdate ? JSON.stringify({ productId }) : undefined,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update favourite");
      }

      return {
        success: true,
        action: wasOptimisticUpdate ? "added" : "removed",
      };
    } catch (error) {
      // Rollback optimistic update
      if (wasOptimisticUpdate) {
        removeFromFavourites(productId);
      } else {
        addToFavourites(productId);
      }

      console.error("Error toggling favourite:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    isFavourited,
    toggleFavourite,
    isUpdating,
  };
}
