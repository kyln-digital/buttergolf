"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useEffect, type ReactNode } from "react";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import type { UserButtonWithMenuProps } from "./UserButtonWithMenu";

/**
 * Clerk auth components for the header.
 * 
 * Note: We previously tried lazy-loading SignedIn/SignedOut with ssr: false,
 * but this caused buttons to disappear because both components rendered null
 * during the dynamic import loading phase. Since ClerkProvider is already
 * loaded in the app layout, SignedIn/SignedOut are lightweight wrappers
 * that just check auth state - the heavy Clerk JS is loaded by ClerkProvider.
 * 
 * UserButton is still lazy-loaded since it's a more complex component.
 */

// Placeholder for auth buttons while Clerk loads
function AuthButtonsPlaceholder() {
  return (
    <div 
      style={{ 
        display: "flex",
        gap: "12px",
        alignItems: "center",
      }}
      aria-label="Loading authentication"
    >
      {/* Login button placeholder */}
      <div 
        style={{ 
          width: 80, 
          height: 40, 
          borderRadius: 9999, 
          backgroundColor: "rgba(244, 83, 20, 0.3)",
        }} 
      />
      {/* Sign-up button placeholder */}
      <div 
        style={{ 
          width: 90, 
          height: 40, 
          borderRadius: 9999, 
          backgroundColor: "rgba(237, 237, 237, 0.5)",
        }} 
      />
    </div>
  );
}

// Placeholder for UserButton while loading
function UserButtonPlaceholder() {
  return (
    <div 
      style={{ 
        width: 40, 
        height: 40, 
        borderRadius: "50%", 
        backgroundColor: "#e5e5e5",
      }} 
      aria-label="Loading user menu"
    />
  );
}

// Re-export Clerk components directly (no lazy loading needed)
export { SignedIn as LazySignedIn, SignedOut as LazySignedOut };

// Lazy-loaded UserButton wrapper that includes the full menu
// We need to import the full component since UserButton uses compound components
const LazyUserButtonInternal = dynamic<UserButtonWithMenuProps>(
  () => import("./UserButtonWithMenu"),
  { 
    ssr: false, // UserButton requires client-side rendering
    loading: () => <UserButtonPlaceholder />
  }
);

export function LazyUserButton({ size = "default" }: UserButtonWithMenuProps) {
  return (
    <Suspense fallback={<UserButtonPlaceholder />}>
      <LazyUserButtonInternal size={size} />
    </Suspense>
  );
}

/**
 * Wrapper component that shows auth buttons with a loading placeholder.
 * Uses useEffect to detect client-side mount and avoid hydration mismatches.
 * 
 * This solves the issue where Clerk's auth state is unknown during SSR,
 * so we show a placeholder on the server and swap to real buttons on the client.
 */
interface AuthButtonsSectionProps {
  children: ReactNode;
  placeholder?: ReactNode;
}

export function AuthButtonsSection({ children, placeholder }: AuthButtonsSectionProps) {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  if (!isMounted) {
    return <>{placeholder || <AuthButtonsPlaceholder />}</>;
  }
  
  return <>{children}</>;
}
