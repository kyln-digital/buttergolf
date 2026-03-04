"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";

export interface CartItem {
  productId: string;
  title: string;
  price: number;
  imageUrl: string;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => Promise<void>;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  /** True once localStorage has been read — prevents flash of empty cart */
  isHydrated: boolean;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

/** 7 days in ms — discard stale carts after this */
const CART_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems, { isHydrated, clear: clearStorage }] = useLocalStorageState<CartItem[]>(
    "buttergolf-cart-v1",
    [],
    { debounceMs: 300, maxAgeMs: CART_MAX_AGE_MS }
  );

  const addItem = useCallback(
    async (item: Omit<CartItem, "quantity">) => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      setItems((currentItems) => {
        const existingItem = currentItems.find((i) => i.productId === item.productId);

        if (existingItem) {
          // Increase quantity if item already exists
          return currentItems.map((i) =>
            i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i
          );
        }

        // Add new item with quantity 1
        return [...currentItems, { ...item, quantity: 1 }];
      });
    },
    [setItems]
  );

  const removeItem = useCallback(
    (productId: string) => {
      setItems((currentItems) => currentItems.filter((item) => item.productId !== productId));
    },
    [setItems]
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        setItems((currentItems) => currentItems.filter((item) => item.productId !== productId));
        return;
      }

      setItems((currentItems) =>
        currentItems.map((item) => (item.productId === productId ? { ...item, quantity } : item))
      );
    },
    [setItems]
  );

  const clearCart = useCallback(() => {
    clearStorage();
  }, [clearStorage]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isHydrated,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
