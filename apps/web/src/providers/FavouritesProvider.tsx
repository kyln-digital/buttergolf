"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useFavourites } from "@/hooks/useFavourites";

type FavouritesContextType = ReturnType<typeof useFavourites>;

const FavouritesContext = createContext<FavouritesContextType | null>(null);

/**
 * Provider that wraps the app and shares favourites state across all components
 * Place this in the root layout after ClerkProvider
 */
export function FavouritesProvider({ children }: { readonly children: ReactNode }) {
  const favouritesState = useFavourites();

  return (
    <FavouritesContext.Provider value={favouritesState}>{children}</FavouritesContext.Provider>
  );
}

/**
 * Hook to access favourites context from any component
 * Must be used within FavouritesProvider
 */
export function useFavouritesContext() {
  const context = useContext(FavouritesContext);

  if (!context) {
    throw new Error("useFavouritesContext must be used within FavouritesProvider");
  }

  return context;
}
